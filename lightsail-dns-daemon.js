const config = require(process.env.CONFIG_PATH || './config.json')
const os = require('os')
const AWS = require('aws-sdk')
const Promise = require('bluebird')
const sanitizeFileName = require('sanitize-filename')
const lightsail = new AWS.Lightsail(Object.assign({ region: 'us-east-1' }, config.credentials))

const getTimestamp = () =>
  `${
    sanitizeFileName(new Date().toUTCString().replace(/:/g, '-'))
      .replace(/ /g, '_')
      .replace(/,/g, '')
  }_pid-${process.pid}`

const log = msg => console.log(`>>> (${getTimestamp()}) ${msg}`)

// create daemon and exit if --fork is passed
if (process.argv.includes('--fork')) {
  const modulePath = process.argv[1]
  const args = [
    '--daemon',
  ]
  const options = {
    detached: true,
    stdio: 'ignore',
  }
  require('child_process').fork(modulePath, args, options)
  process.exit()
}

// daemon setup
if (process.argv.includes('--daemon')) {
  // ensure only one daemon
  (async () => {
    const allProcesses = await (require('ps-list')())
    const otherDaemons = allProcesses.filter(p =>
      p.name === 'node' &&
      p.cmd.includes('lightsail-dns-daemon.js --daemon') &&
      p.pid !== process.pid
    )
    otherDaemons.forEach(p => process.kill(p.pid, 'SIGTERM'))
  })()
  // redirect logs to file
  const fs = require('fs')
  if (!fs.existsSync('./logs')) {
    fs.mkdirSync('./logs')
  }
  const fileName = `./logs/${getTimestamp()}.log`
  const file = fs.createWriteStream(fileName)
  process.stdout.write = process.stderr.write = file.write.bind(file)
}

const getNatIpAddress = async () => {
  const interfaces = os.networkInterfaces()
  const finalInterfaceName = Object.keys(interfaces).reduce((currentFinalInterfaceName, interfaceName) => {
    const candidateInterfaceName = interfaces[interfaceName].reduce((currentInterfaceName, addr) => {
      if (addr.mac === config.interface.mac) {
        return interfaceName
      }
      return currentInterfaceName
    }, '')
    if (candidateInterfaceName !== '') {
      return candidateInterfaceName
    }
    return currentFinalInterfaceName
  }, '')
  if (finalInterfaceName === '') {
    throw new Error(`interface not found. config.interface.mac=${config.interface.mac}`)
  }
  const candidates = interfaces[finalInterfaceName].filter(addr =>
    addr.family === config.address.family &&
    addr.internal === false
  )
  const natAddress = candidates[0].address
  if (candidates.length > 1) {
    log(`many addresses found. choosing ${natAddress}`)
  }
  return natAddress
}

const getDnsIpAddressEntry = async () => {
  const response = await lightsail.getDomains().promise()
  const domain = response.domains.filter(domain => domain.name === config.hostname.domain)[0]
  const domainEntry = domain.domainEntries.filter(domainEntry => domainEntry.name === config.hostname.subdomain)[0]
  return domainEntry
}

const setDnsIpAddress = async params => {
  const { dnsAddressEntryId, dnsAddress, natAddress } = params
  log(`replacing ${dnsAddress} with ${natAddress} on the api...`)
  await lightsail.updateDomainEntry({
    domainName: config.hostname.domain,
    domainEntry: {
      id: dnsAddressEntryId,
      name: config.hostname.subdomain,
      target: natAddress,
      type: 'A',
    },
  }).promise()
}

const checkIfDnsIpDiffersFromNatIp = async () => {
  try {
    const dnsAddressEntry = await getDnsIpAddressEntry()
    const dnsAddressEntryId = dnsAddressEntry.id
    const dnsAddress = dnsAddressEntry.target
    const natAddress = await getNatIpAddress()
    if (dnsAddress !== natAddress) {
      await setDnsIpAddress({ dnsAddressEntryId, dnsAddress, natAddress })
    }
  } catch (e) {
    log(`rescheduling next check due to error:`)
    console.log(e)
  }
  setTimeout(checkIfDnsIpDiffersFromNatIp, config.interval * 1000)
}

checkIfDnsIpDiffersFromNatIp()

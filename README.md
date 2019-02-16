# lightsail-dns-daemon
A NodeJS daemon to update the NAT private IP address of the host in the AWS Lightsail DNS API

# Installing
Clone the repo and run `make setup`.

# Running
Run `node ./lightsail-dns-daemon.js --fork` to start the daemon, or remove the `--fork` flag to run in the foreground.

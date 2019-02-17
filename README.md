# lightsail-dns-daemon
A NodeJS daemon to update the NAT private IP address of the host in the AWS Lightsail DNS API

# Installing
Clone the repo and run `make setup`.

## Starting the daemon with the system
* On OSX: https://stackoverflow.com/a/6445525
* On Linux: https://www.tecmint.com/auto-execute-linux-scripts-during-reboot-or-startup/
* On Windows: https://www.google.com/

# Running
Run `node ./lightsail-dns-daemon.js --fork` to start the daemon, or remove the `--fork` flag to run in the foreground.

## Passing a JSON configuration file path
Use the environment variable `CONFIG_PATH` to pass the path to a JSON configuration file like [config.json](config.json).
Hint: `myConfig.json` is listed in `.gitignore`.

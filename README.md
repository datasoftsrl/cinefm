# CineFM

## What is it?

CineFM is a web based file manager, built around new tecnologies, such as
NodeJS, HTML5 and CSS3.

## Features

* Dual-pane view (similar to Norton Commander)
* Built with the Cinema world in mind, useful for ingesting movies into
projectors from various sources
* Tested on Debian Jessie
* Provide copy, folder creation and deletion (but no move/upload/download)
functions
* Possibility to chroot panel separatedly
* Possibility to limit write operations on either panel
* Copy progress (copy accomplished with rsync)

## Installation

Launch the following command:

```shell
$ curl -sL https://raw.githubusercontent.com/datasoftsrl/cinefm/master/install.sh | bash -
```

After installation is completed, remeber to edit configuration (by default at
`/opt/cinefm/config.yml`), remembering **not to use tabs**.

To start the file manager service, use this `systemd` command:

```shell
$ systemctl start cinefm
```

Now, server will be available at the previously specified port (by default
8080).

## Administration

CineFM service can be started, restarted and stopped with:

```shell
$ systemctl start cinefm
$ systemctl stop cinefm
$ systemctl restart cinefm
```

Further information on application status can be obtained with:

```shell
$ systemctl status cinefm
```

For more info, refer to *Logging* section.

## Logging

If a writable log folder is found (by default at `/var/log/cinefm/`), log is
written there in a file called `cinefm.log`.

if such folder is not found or is not writable, log will be sent directly on
`stderr` and shall be consulted using:

```shell
$ journalctl -xeb -u cinefm
```

## Automounting drives

There is an option to use `udev` to automount, for example, device `/dev/sdXn`
to `/mnt/disk-sdXn`, starting from a specified letter.

System can be installed and a starting letter can be choosed with:

```shell
$ curl -sL https://raw.githubusercontent.com/datasoftsrl/cinefm/master/udev-drives.py | python3 -
Automounting from /dev/sdX onwards, starting from letter (default: b): f
```

Now volumes starting from `/dev/sdf` will be mounted under `/mnt`.

### Note

On some systems (such as Debian 8 Jessie) above command won't give the user a
chance to insert lecter, but the program will abort with an error.

In such cases, download the script and execute it by hand with:

```shell
$ wget https://raw.githubusercontent.com/datasoftsrl/cinefm/master/udev-drives.py
$ python3 udev-drives.py
Automounting from /dev/sdX onwards, starting from letter (default: b): f

```

## License

Software is provided under [MIT License](https://opensource.org/licenses/MIT).

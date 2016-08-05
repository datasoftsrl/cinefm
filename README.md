# CineFM

## What is it?

CineFM is a web based file manager, built around new tecnologies¸ such as
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

After installation is completed, remeber to edit configuration at
`$HOME/.cinefm.json`.

To start the file manager service, use this `systemd` command:

```shell
$ systemctl start cinefm
```

Now, server will be available at the previously specified port (by default
8080).

## License

Software is provided under [MIT License](https://opensource.org/licenses/MIT).

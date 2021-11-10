#!/usr/bin/env bash

# redirect stdout
exec 5>&1
exec >/dev/null 2>/dev/null

RELEASE="/etc/os-release"
REPO="https://github.com/datasoftsrl/cinefm.git"
OLD_CWD=${PWD}
TARGET="/opt/cinefm"
BIN="/usr/local/bin/cinefm"

function error {
  echo "[!] "${1} >&5
}

function log {
  echo "### "${1} >&5
}

function ok {
  echo "------------------------------> Done." >&5
  echo >&5
}

function remind {
  echo >&5
  tput bold >&5
  tput blink >&5
  echo "Remeber to edit config at '${TARGET}/config.yml'." >&5
  tput sgr0 >&5
  echo >&5
}

# as root
if [[ $EUID -eq 0 ]]; then

  # check if linux
  if [ -f ${RELEASE} ]; then
    source ${RELEASE}

    # check if debian 8
    if [[ ${ID} == "debian" ]]; then

      log "Installing NodeJS version 6..."
      # if nodejs already installed
      dpkg -s nodejs
      if [[ $? -eq 1 ]]; then
        apt-get update
        apt-get install -y curl
        curl -sL https://deb.nodesource.com/setup_12.x | bash -
        apt-get install -y nodejs
      fi
      # check if nodejs has been installed
      type node
      if [[ $? -eq 1 ]]; then
        error "NodeJS has not been installed."
        exit 255
      fi
      # check if npm has been installed
      type npm
      if [[ $? -eq 1 ]]; then
        error "NPM has not been isntalled."
        exit 255
      fi
      ok

      log "Installing apt dependencies..."
      apt-get install -y git
      # check if git has been installed
      type git
      if [[ $? -eq 1 ]]; then
        error "Git has not been installed."
        exit 255
      fi
      ok

      log "Installing bower..."
      npm -g install bower
      # check if bower has been installed
      type bower
      if [[ $? -eq 1 ]]; then
        error "Bower has not been installed."
        exit 255
      fi
      ok

      log "Downloading repo into '/opt/cinefm'..."
      rm -rf ${TARGET}
      mkdir -p ${TARGET}
      git clone ${REPO} ${TARGET}
      ok

      log "Installing CineFM with dependencies..."
      cd ${TARGET}
      npm install "."
      bower --allow-root install
      mkdir -p "/var/log/cinefm"
      chown ${USER}:${USER} "/var/log/cinefm"
      ok

      log "Installing CineFM utility and CineFM systemd service..."
      cat <<EOF > ${BIN}
#\!/usr/bin/sh

OLD_PWD=\${PWD}
WD="/opt/cinefm"

cd \${WD}
/usr/bin/node /opt/cinefm/bin/cinefm.js
cd \${OLD_PWD}
EOF
      chmod 755 ${BIN}
      chmod +x "${TARGET}/udev-restart.sh"
      install -g root -o root -m 644 "cinefm.service" "/etc/systemd/system/"
      systemctl enable "cinefm.service"
      ok

      # remind of config.yml
      remind

      cd ${OLD_CWD}

    else
      error "Not a Debian system."
      exit 255
    fi

  else
    error "Cannot determine OS version. Aborting."
    exit 255
  fi

else
  error "Script shall be executed as root."
  exit 255
fi

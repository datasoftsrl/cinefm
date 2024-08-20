#!/usr/bin/env python3
# _*_ coding: utf-8 _*_

import sys
import os
import shutil
import string
import subprocess

START_LETTER = 'b'
UDEV_RULES_FILE = '/etc/udev/rules.d/99-custom-mount-drives.rules'
SERVICE_FILE = '/etc/systemd/system/systemd-udevd.service.d/override.conf'

def error(message):
  '''
  Prints an error message of type '[!] message'.
  '''
  print('[!] {}'.format(message), file=sys.stderr)
  sys.exit(255)

def add_udev_rule(start_letter=START_LETTER, path=UDEV_RULES_FILE):
  '''
  Write an udev rules file at file, to automount volumes starting
  from start_letter.
  '''
  # add start lecter to file
  rules = [
    '''#ACTION=="add", KERNEL=="sd[{0}-z][0-9]", RUN+="/bin/mkdir -p /mnt/disk-%k"''',
    '''#ACTION=="add", KERNEL=="sd[{0}-z][0-9]", RUN+="/bin/mount -t auto -o sync,dirsync,noexec,nosuid /dev/%k /mnt/disk-%k", OPTIONS+="last_rule"''',
    '''#ACTION=="remove", KERNEL=="sd[{0}-z][0-9]", RUN+="/bin/umount -l /mnt/disk-%k"''',
    '''#ACTION=="remove", KERNEL=="sd[{0}-z][0-9]", RUN+="/bin/rmdir /mnt/disk-%k", OPTIONS+="last_rule"'''
    '''ACTION=="add", KERNEL=="sd[{0}-z][0-9]", RUN+="/bin/mkdir -p /mnt/disk-%k"''',
    '''ACTION=="add", KERNEL=="sd[{0}-z][0-9]", RUN+="/usr/bin/systemd-mount --no-block --fsck=no /dev/%k /mnt/disk-%k"''',
    '''ACTION=="remove", KERNEL=="sd[{0}-z][0-9]", RUN+="/usr/bin/systemd-mount --umount /mnt/disk-%k"''',
    '''ACTION=="remove", KERNEL=="sd[{0}-z][0-9]", RUN+="/bin/rmdir /mnt/disk-%k"'''
  ]
  rules_string = '\n'.join(rules).format(start_letter)

  # write udev rule file
  try:
    with open(path, 'w') as rulesfile:
      rulesfile.write(rules_string)
      rulesfile.write(os.linesep)
  except IOError:
    error('error opening {}'.format(file))
  
  print('Written file {}'.format(path))

def add_mount_flags(path=SERVICE_FILE):
  '''
  Add override file to change systemd-udevd default behavior regarding private mounts.
  '''
  rules = [
    '[Service]',
    'MountFlags=shared',
    'PrivateMounts=no'
  ]
  rules_string = '\n'.join(rules)

  # add mount flags to the service file
  servicefile_dirname = os.path.dirname(path)
  os.makedirs(servicefile_dirname, exist_ok=True)
  try:
    with open(path, 'w') as servicefile:
      servicefile.write(rules_string)
      servicefile.write(os.linesep)
  except IOError:
    error('error opening {}'.format(file))

  print('Written file {}'.format(path))

def ask_for_letter():
  '''
  Ask for a letter from the standard input.
  '''
  while True:
    letter = input('Automounting from /dev/sdX onwards, starting from letter [default: {}]: '.format(START_LETTER)).lower()
    if len(letter) == 0:
      print('Starting from default /dev/sd{}'.format(START_LETTER))
      return START_LETTER
    if len(letter) == 1 and letter in string.ascii_lowercase:
      print('Starting from default /dev/sd{}'.format(letter))
      return letter

def reload_all():
  '''
  Reload udev service and udev rules.
  '''
  cmds = (
    ('systemctl', 'daemon-reload'),
    ('systemctl', 'restart', 'systemd-udevd'),
    ('udevadm', 'control', '--reload')
  )

  for cmd in cmds:
    print("Exec '{}'".format(' '.join(cmd)))
    subprocess.call(cmd)

if __name__ == '__main__':
  # check if root
  if os.geteuid() == 0:
    letter = ask_for_letter()
    add_mount_flags()
    add_udev_rule(letter)
    reload_all()
  else:
    error('script shall be executed as root')

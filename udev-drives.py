#!/usr/bin/env python3
# _*_ coding: utf-8 _*_

import sys, os
import textwrap, platform, subprocess

START_LETTER = 'b'
UDEV_RULE = '/etc/udev/rules.d/99-custom-mount-drives.rules'
SERVICE_FILE = '/lib/systemd/system/systemd-udevd.service'

def error(message):
  '''
  Prints an error message of type '[!] message'.
  '''
  print('[!] {}'.format(message), file=sys.stderr)

def add_udev_rule(start_letter=START_LETTER, file=UDEV_RULE):
  '''
  Write an udev rules file at file, to automount volumes starting
  from start_letter.
  '''
  # add start lecter to file
  rule = \
    '''\
    ACTION=="add", KERNEL=="sd[{0}-z][0-9]", RUN+="/bin/mkdir -p /mnt/disk-%k"
    ACTION=="add", KERNEL=="sd[{0}-z][0-9]", RUN+="/bin/mount -t auto -o sync,dirsync,noexec,nosuid /dev/%k /mnt/disk-%k", OPTIONS+="last_rule"
    ACTION=="remove", KERNEL=="sd[{0}-z][0-9]", RUN+="/bin/umount -l /mnt/disk-%k"
    ACTION=="remove", KERNEL=="sd[{0}-z][0-9]", RUN+="/bin/rmdir /mnt/disk-%k", OPTIONS+="last_rule"\
    '''.format(start_letter)

  # write udev rule file
  try:
    with open(file, 'w') as rulesfile:
      rulesfile.write(textwrap.dedent(rule))
  except IOError:
    error('error opening {}'.format(file))

def add_mount_flag(file=SERVICE_FILE):
  '''
  Add a 'MountFlags=shared' to file.
  '''
  try:
    with open(file, 'r') as servicefile:
      lines = servicefile.readlines()
  except IOError:
    error('error opening {}'.format(file))

  # search for a MountFlags config
  for line in lines:
    # if found exit
    if line.startswith('MountFlags'):
      return

  # else add it
  try:
    with open(file, 'a') as servicefile:
      servicefile.write('MountFlags=shared')
  except IOError:
    error('error opening {}'.format(file))


def ask_for_letter():
  '''
  Ask for a letter from the standard input.
  '''
  letter = ''
  while True:
    # read letter
    letter = input(
      'Automounting from /dev/sdX onwards, starting from letter (default: b): '
    )
    # b is the default
    if type(letter) == str and len(letter) == 0:
      letter = 'b'
      break
    if type(letter) == str and len(letter) == 1:
      break
    else:
      error('Invalid letter {}'.format(letter))
  return letter

def reload_all():
  '''
  Reload udev service and udev rules.
  '''
  subprocess.call(['systemctl', 'daemon-reload'])
  subprocess.call(['systemctl', 'restart', 'udev'])
  subprocess.call(['udevadm', 'control', '--reload'])

if __name__ == '__main__':
  # check if root
  if os.geteuid() == 0:
    # check if debian 8
    distro, version, _id = platform.dist()
    if distro == 'debian' and version.startswith('8'):
      letter = ask_for_letter()
      add_mount_flag()
      add_udev_rule(letter)
      reload_all()
    else:
      error('Not a Debian 8 (jessie) system')
  else:
    error('Script shall be executed as root')

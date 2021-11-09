'use strict'

const spawn = require('child_process').spawn;

const util = require('./util');

class WGet {
  constructor(host, user, passwd) {
    this.host = host || '127.0.0.1';
    this.user = user || 'anonymous';
    this.passwd = passwd || 'anonymous';

    this.cmd = 'wget';
  }

  _buildArgs(src, dst) {
    return [
      '-P', dst,
      '-r',
      '-nH', '-np',
      '--progress=bar:force:noscroll',
      '-q', '--show-progress',
      `--user=${this.user}`,
      `--password=${this.passwd}`,
      `${util.unslash(host)}${src}`,
    ];
  }

  /**
   * Emulates cp with ftp protocol and wget.
   *
   * < src: absolute src path
   * < dst: absolute dst path
   * < progCallback: callback function accepting (name, percent, speed)
   * < endCallback: callback function accepting (code, status, elapsed)
   */
  cp(src, dst, progCallback, endCallback) {
    if (!host) {
      throw "Error: host is null";
    }

    if (!src || !dst) {
      throw "Error: both src and dst must be specified";
    }

    const timeStart = Date.now();
    const wgetCmd = spawn(cmd, this._buildArgs(src, dst));

    wgetCmd.on('error', error => { throw error; });

    wgetCmd.stderr.on('data', data => {
      if (!data) {
        return;
      }

      const parsedOut = data.toString()
        .trim()
        .replace(/[\s\r]+/g,' ')
        .split(' ');

      const name = parsedOut[0];
      const percent = parseInt(parsedOut[1]) || 0;
      
      let speed = '00.0KB/s';
      const candidateSpeeds = parsedOut
        .filter(t => util.isString(t)
          && t.length
          && t.indexOf('B/s') > 0
          && t !== '--.-KB/s'
        );
      if (candidateSpeeds.length) {
        speed = candidateSpeeds[0]
          .replace('K', 'k')
          .replace('M', 'm')
          .replace('G', 'g');
      }

      progCallback(name, percent, speed);
    });

    wgetCmd.on('close', code => {
      const elapsed = util.dateDiff(Date.now(), timeStart).str;

      endCallback(code, `${code? 'KO' : 'OK'}`, elapsed);
    });
  }

}

module.exports = WGet;

'use strict'

var spawn = require('child_process').spawn;
var path = require('path');

var util = require('./util');

var host = null;
var user = 'anonymous';
var passwd = 'anonymous';

/**
 * Accept a login object with follogin parameters:
 * - host: hostname
 * - user: username
 * - passwd: password
 *
 * < login: object as descripted
 */
module.exports.set = function(login) {
  host = login.host;
  if (login.user) {
    user = login.user;
  }
  if (login.passwd) {
    passwd = login.passwd; 
  }
}

/**
 * Encapsulate a string into quotes.
 *
 * < string
 *
 * > encasulated string.
 */
function quote(str) {
  return '"' + str + '"';
}

/**
 * Emulates cp with ftp protocol and wget.
 *
 * < src: absolute src path
 * < dst: absolute dst path
 * < progCallback: callback function accepting (name, percent, speed)
 * < endCallback: callback function accepting (code, status, elapsed)
 */
module.exports.cp = function(src, dst, progCallback, endCallback) {
  if (host !== null && user != null && passwd != null) {
    if (src !== undefined && dst !== undefined) {
      var cmd = 'wget';
      var args = [
        '-P', dst,
        '-r',
        '-nH', '-np',
        '--progress=bar:force:noscroll',
        '-q', '--show-progress',
        '--user=' + user,
        '--password=' + passwd,
        util.unslash(host) + src
      ];

      var timeStart = Date.now();

      var wget = spawn(cmd, args);

      wget.on('error', function(error) {
        if (error) {
          throw error;
        }
      });

      wget.stderr.on('data', function(data) {
        if (data) {
          const out = data.toString();

          var parsedOut = out.trim().replace(/[\s\r]+/g,' ').split(' ');

          // name
          var name = parsedOut[0];
          // percent
          var percent = parseInt(parsedOut[1]) || 0;
          // speed
          var speed = '00.0KB/s';
          for (var i=parsedOut.length-1; i>=0; --i) {
            var value = parsedOut[i];

            if (
              typeof a == 'string'
                &&
              value.length > 0
                &&
              value.indexOf('B/s') > 0
            ) {
              if (value != '--.-KB/s') {
                speed = value;
              }
              break;
            }
          }
          speed = speed
            .replace('K', 'k')
            .replace('M', 'm')
            .replace('G', 'g');

          progCallback(name, percent, speed);
        }
      });

      wget.on('close', function(code) {
        // get status
        var stat = null;
        if (code == 0) {
          stat = 'OK';
        } else {
          stat = 'KO';
        }
        
        // get elapsed time
        var elapsed = util.dateDiff(Date.now(), timeStart).str;

        endCallback(code, stat, elapsed);
      });
    } else {
      throw "Error: src and dst must be specified";
    }
  } else {
    throw "Error: set function not called";
  }
}

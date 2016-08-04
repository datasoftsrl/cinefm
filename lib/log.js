(function() {
  'use strict'

  var fs = require('fs');
  var path = require('path');

  var util = require('./util');
  var config = require('./config');

  // log file descriptor
  var fd = null
  try {
    fd = fs.openSync(config('log-path'), 'a');
  } catch(e) {
    util.error('error opening log file at ' + config('log-path'));
    util.error('does ' + path.dirname(config('log-path')) + ' exists' +
      ' or have correct permissions?');
    process.exit(255);
  }

  /**
   * Appends a log message to file at log-path.
   *
   * < message: string to append
   */
  function log(message) {
    fs.appendFileSync(fd, util.today() + ': ' + message + '\n');
  }
  module.exports = log;

  /**
   * Produce a log message of type:
   *   user: method: /tmp/temp: error
   *
   * < user: ip:host of user
   * < method: file method
   * < paths: paths of files involved
   * < root: root to prepend to paths
   * < message: status
   */
  function action(user, method, paths, root, message) {
    var tmp = '';
    if (typeof paths != 'string') {
      paths.forEach(function(elem, i, array) {
        if (i == 0) {
          tmp += path.join(root, elem);
        } else {
          tmp += ', ' + path.join(root, elem);
        }
      });
    } else {
      tmp = path.join(root, paths);
    }

    log(user + ': ' + method + ': ' + tmp + ': ' + message);
  }
  module.exports.action = action;

  /**
   * Close log file descriptor.
   */
  module.exports.close = function() {
    fs.closeSync(fd);
  }

})();



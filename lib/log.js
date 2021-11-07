'use strict'

const fs = require('fs');
const path = require('path');

const util = require('./util');
const config = require('./config');

let logFd;
try {
  logFd = fs.openSync(config('log-path'), 'a');
} catch(e) {
  util.error(`error opening log file at ${config('log-path')}`);
  util.error(`does ${path.dirname(config('log-path'))} exist or have correct permissions?`);
  logFd = process.stderr.fd;
}

/**
 * Appends a log message to file at log-path.
 *
 * < message: string to append
 */
function log(message) {
  fs.appendFileSync(logFd, `${util.today()}: ${message}\n`);
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
  if (!Array.isArray(paths)) {
    paths = [paths];
  }

  const joinedPaths = paths
    .map(p => path.join(root, p))
    .join(', ');

  log(`${user}: ${method}: ${joinedPaths}: "${message}"`);
}

/**
 * Close log file descriptor.
 */
function close() {
  fs.closeSync(logFd);
}

module.exports = log;
module.exports.action = action;
module.exports.close = close;
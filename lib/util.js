'use strict'

var os = require('os');
var time = require('strftime');
var path = require('path');

/**
 * Update present values in objA with values in objB.
 *
 * < objA: an object
 * < objB: other object
 *
 * > intersection object with update values
 */
module.exports.update = function (objA, objB) {
  var ret = {};
  for (let k in objA) {
    if ((objB.hasOwnProperty(k)) && (objB[k] != objA[k])) {
      ret[k] = objB[k];
    } else {
      ret[k] = objA[k];
    }
  }
  return ret;
}

/**
 * Print out an error to the error stream.
 *
 * < message: string to print
 */
module.exports.error = function(message) {
  console.error('[!] ' + message);
}

/**
 * Return a string of type [DD/MM/YY @ HH:MM:SS] based on today data.
 *
 * > string [DD/MM/YY @ HH:MM:SS]
 */
module.exports.today = function() {
  var hostname = os.hostname();
  var proc;
  try {
    proc = path.basename(process.argv[1])
    .replace(path.extname(process.argv[1]), '');
  } catch (error) {
    proc = 'cinefm';
  }
  var pid = process.pid;
  var datetime = time('%b %e %H:%M:%S');

  return `${datetime} ${hostname} ${proc}[${pid}]`;
}

/**
 * Remove root from path.
 *
 * < path: path to remove root from
 * < root: path of root
 *
 * > path without root
 */
module.exports.unroot = function(path, root) {
  if (root == '/') {
    return path;
  }
  return path.replace(root, '');
}

/**
 * Remove trailing slash if it exists.
 *
 * < path: string to remove slash from
 *
 * > path with trailing slash removed
 */
module.exports.unslash = function(path) {
  var last = path.length - 1
  if (last != 0 && path.charAt(last) == '/') {
    return path.substring(0, last);
  }
  return path;
}

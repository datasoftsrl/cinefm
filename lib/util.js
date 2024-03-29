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
 * > union object with update values
 */
module.exports.update = function (objA, objB) {
  return Object.assign({}, objA, objB);
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
 * < lead: (false by default) also remove leading slash
 *
 * > path with trailing slash removed
 */
module.exports.unslash = function(path, lead=false) {
  var last = path.length - 1
  if (last != 0 && path.charAt(last) == '/') {
    return path.substring(0, last);
  }
  if (lead) {
    if (path.length > 0 && path.charAt(0) == '/') {
      return path.substring(1);
    }
  }
  return path;
}

module.exports.untag = function(str) {
  var tagBody = '(?:[^"\'>]|"[^"]*"|\'[^\']*\')*';

  var tagOrComment = new RegExp(
    '<(?:'
    // Comment body.
    + '!--(?:(?:-*[^->])*--+|-?)'
    // Special "raw text" elements whose content should be elided.
    + '|script\\b' + tagBody + '>[\\s\\S]*?</script\\s*'
    + '|style\\b' + tagBody + '>[\\s\\S]*?</style\\s*'
    // Regular name
    + '|/?[a-z]'
    + tagBody
    + ')>',
    'gi');
  function removeTags(html) {
    var oldHtml;
    do {
      oldHtml = html;
      html = html.replace(tagOrComment, '');
    } while (html !== oldHtml);
    return html.replace(/</g, '&lt;');
  }

  return removeTags(str);
}

/**
 * Return difference between to dates.
 *
 * < date1: less recent date (in ms)
 * < date2: more recent date (in ms)
 *
 * > object containing days, hours, mins and secs
 */
module.exports.dateDiff = function(date1, date2) {
  var ret = {};
  var diff = date1 - date2;

  ret.days = Math.floor(diff / (1000 * 60 * 60 * 24));
  diff -= ret.days * (1000 * 60 * 60 * 24);

  ret.hours = Math.floor(diff / (1000 * 60 * 60));
  diff -= ret.hours * (1000 * 60 * 60);

  ret.mins = Math.floor(diff / (1000 * 60));
  diff -= ret.mins * (1000 * 60);

  ret.secs = Math.floor(diff / (1000));
  diff -= ret.seconds * (1000);

  var str = '';
  if (ret.days) {
    str += ret.days + 'd, ';
  }
  if (ret.hours) {
    str += ret.hours + 'h, ';
  }
  if (ret.mins) {
    str += ret.mins + 'm, ';
  }
  if (ret.secs) {
    str += ret.secs + 's';
  }
  ret.str = str || '0s';

  return ret;
}

/**
 * Compares two dates.
 *
 * < date1: a Date
 * < date2: a Date
 *
 * > -1, 0, 1 depending if date1 is <, ==, > than date2
 */
module.exports.compareDates = function(date1, date2) {
  if (!date1 && !date2) return 0;
  if (!date1) return 1;
  if (!date2) return -1;

  return date1 - date2;
}

/**
 * Compares two strings.
 *
 * < string1: a string
 * < string2: a string
 *
 * > -1, 0, 1 depending if string1 is <, ==, > than string2
 */
module.exports.compareStrings = function(string1, string2) {
  return ('' + string2).localeCompare(string1);
}

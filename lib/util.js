'use strict'

const os = require('os');
const path = require('path');

const strftime = require('strftime');

/**
 * Update present values in objA with values in objB.
 *
 * < objA: an object
 * < objB: other object
 *
 * > union object with update values
 */
function update(objA, objB) {
  return Object.assign({}, objA, objB);
}

/**
 * Print out an error to the error stream.
 *
 * < message: string to print
 */
function error(message) {
  console.error(`[!] ${message}`);
}

/**
 * Return a string of type [DD/MM/YY @ HH:MM:SS] based on today data.
 *
 * > string [DD/MM/YY @ HH:MM:SS]
 */
function today() {
  let proc;
  try {
    proc = path
      .basename(process.argv[1])
      .replace(path.extname(process.argv[1]), '');
  } catch (error) {
    proc = 'cinefm';
  }
  const hostname = os.hostname();
  const pid = process.pid;
  const datetime = strftime('%b %e %H:%M:%S');

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
function unroot(path, root) {
  if (root === '/') {
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
function unslash(path, lead=false) {
  if (path.length) {
    let last = path.length - 1
    if (path.charAt(last) === '/') {
      return path.substring(0, last);
    }

    if (lead) {
      if (path.charAt(0) === '/') {
        return path.substring(1);
      }
    }
  }

  return path;
}

const _tagBodyRegex = '(?:[^"\'>]|"[^"]*"|\'[^\']*\')*';
const _tagOrCommentRegex = new RegExp(
  '<(?:'
  // Comment body.
  + '!--(?:(?:-*[^->])*--+|-?)'
  // Special "raw text" elements whose content should be elided.
  + '|script\\b' + _tagBodyRegex + '>[\\s\\S]*?</script\\s*'
  + '|style\\b' + _tagBodyRegex + '>[\\s\\S]*?</style\\s*'
  // Regular name
  + '|/?[a-z]'
  + _tagBodyRegex
  + ')>',
  'gi');
function untag(html) {
  let oldHtml;
  do {
    oldHtml = html;
    html = html.replace(_tagOrCommentRegex, '');
  } while (html !== oldHtml);

  return html.replace(/</g, '&lt;');
}

/**
 * Return difference between to dates.
 *
 * < date1: less recent date (in ms)
 * < date2: more recent date (in ms)
 *
 * > object containing days, hours, mins and secs
 */
const oneSecond = 1000;
const oneMinute = oneSecond * 60;
const oneHour = oneMinute * 60;
const oneDay = oneHour * 24;
function dateDiff(date1, date2) {
  let diff = date1 - date2;
  let ret = {};

  ret.days = Math.floor(diff / oneDay);
  diff -= ret.days * oneDay;

  ret.hours = Math.floor(diff / oneHour);
  diff -= ret.hours * oneHour;

  ret.mins = Math.floor(diff / oneMinute);
  diff -= ret.mins * oneMinute;

  ret.secs = Math.floor(diff / oneSecond);
  diff -= ret.secs * oneSecond;

  ret.msecs = diff;

  ret.str = diff ? `${ret.days}d, ${ret.hours}h, ${ret.mins}m, ${ret.secs}s, ${ret.msecs}ms` : '0ms';

  return ret;
}

/**
 * Retuns true if the obj is a string, false otherwise.
 * 
 * < obj: an object
 * 
 * > true if the obj is a string, false otherwise
 */
function isString(obj) {
  return (Object.prototype.toString.call(obj) === '[object String]');
}

module.exports = {
  update,
  error,
  today,
  unroot,
  unslash,
  untag,
  dateDiff,
  isString,
}
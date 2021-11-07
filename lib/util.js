'use strict'

const os = require('os');
const path = require('path');

const time = require('strftime');

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
  const datetime = time('%b %e %H:%M:%S');

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
function dateDiff(date1, date2) {
  let ret = {};
  let order = ['d', 'h', 'm', 's'];
  let diff = date1 - date2;

  ret.days = Math.floor(diff / (1000 * 60 * 60 * 24));
  diff -= ret.days * (1000 * 60 * 60 * 24);

  ret.hours = Math.floor(diff / (1000 * 60 * 60));
  diff -= ret.hours * (1000 * 60 * 60);

  ret.mins = Math.floor(diff / (1000 * 60));
  diff -= ret.mins * (1000 * 60);

  ret.secs = Math.floor(diff / (1000));
  diff -= ret.seconds * (1000);

  ret.str = order
    .filter(key => ret[key])
    .map(key => `${ret[key]}${key}`)
    .join(", ") || '0s';

  return ret;
}

module.exports = {
  update,
  error,
  today,
  unroot,
  unslash,
  untag,
  dateDiff,
}
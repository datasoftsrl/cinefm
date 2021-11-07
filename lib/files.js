'use strict'

const fs = require('fs');
const path = require('path');
var exec = require('child_process').execFileSync;

const readline = require('n-readlines');
const fsutils = require('nodejs-fs-utils');
const rsync = require('rsync');
const chokidar = require('chokidar');

const log = require('./log');
const util = require('./util');
const wget = require('./wget');

// populate a structure of type { uid: username }
function _getUsersMap() {
  let users = {};

  const lines = new readline('/etc/passwd');
  let line;
  while (line = lines.next()) {
    const tokens = line.toString('ascii').split(':', 4);
    users[tokens[2]] = tokens[0];
  }

  return users;
}
const USERS = _getUsersMap();

/**
 * Provided a stats object (result of stat func) return 'file', 'dir' or
 * link'.
 *
 * < stats: stats object
 *
 * > 'file', 'dir', 'link'
 */
function whatis(stats) {
  if (stats.isDirectory()) {
    return 'dir';
  }
  return 'file';
}

/**
 * Give the username which correponds to uid provided.
 *
 * < uid: user id
 *
 * > username
 */
function username(uid) {
  if (uid in USERS) {
    return USERS[uid];
  }
  return '-----';
}

/**
 * Given a size in bytes, return a properly converted size in kilo-, mega-
 * or gigabytes, only if type is file.
 *
 * < size: size in bytes
 * < type: 'file' or other string
 *
 * > properly converted size else empty string
 */
function formatSize(size, type) {
  if (type === 'file') {
    let divide;
    let unit;
    if (size >= 1000 && size < 1000000) { // kilobytes
      divide = 1000;
      unit = 'KB';
    } else if (size >= 1000000 && size < 1000000000) { // megabytes
      divide = 1000000;
      unit = 'MB';
    } else if (size >= 1000000000) { // gigabytes and beyond
      divide = 1000000000;
      unit = 'GB'
    } else {
      divide = 1;
      unit = 'B'
    }
    return `${(size / divide).toFixed(1)} ${unit}`;
  }
  return '-----';
}

/**
 * From a mode property of stats, return respective permissions.
 *
 * < node: attribute node of stats
 *
 * > permission of type rwxrwxrwx
 */
function perms(mode) {
  const mask = [
    // owner
    400, 200, 100,
    // group
    40, 20, 10,
    // others
    4, 2, 1
  ];

  return mask
    .map(m => mode & parseInt(m, 8)? 'r' : '-')
    .join('');
}

/**
 * Gives the content of a dir in the form:
 * { path, name, type, user, perms }
 * Optionally a property of type error will be added if any error
 * is encountered.
 *
 * < dir: directory to open
 * < back: include .. or not (default false)
 * < hidden: show hidden files (default false)
 *
 * > object as stated or string error
 */
function ls(dir, back, hidden) {
  // normalize and remove trailing / if necessary
  dir = util.unslash(path.normalize(dir));

  try {
    // check if dir exists
    const files = fs.readdirSync(dir);

    // metadata object, will contain list of
    // { path, name, type, user, perms }
    let metadata = [];

    // add .. if specified
    if (back) {
      metadata.push({
        path: path.dirname(dir),
        name: '..',
        type: 'dir',
        user: '-----',
        size: '-----',
        perms: '---------'
      });
    }

    // dir exists, now we lstat every file
    files.forEach(f => {
      // check if hidden files are to be displayed
      if (hidden || !f.startsWith('.')) {
        const fullPath = path.join(dir, f);

        let stats;
        try {
          stats = fs.statSync(fullPath);
        } catch(e) {
          log(`error during stat of ${fullPath} [${e}]`);
        }

        let m;
        if (stats) {
          m = {
            type: whatis(stats),
            user: username(stats.uid),
            size: formatSize(stats.size, whatis(stats)),
            perms: perms(stats.mode),
          }
        } else {
          // no stats so improvise
          m = {
            type: '-',
            user: '-----',
            size: '-----',
            perms: '---------',
          }
        }

        metadata.push({
          ...m,
          path: fullPath,
          name: f,
        });
      }
    });

    return metadata;

  } catch (error) {
    if (error) {
      switch (error.code) {
        case 'ENOENT':
          return `${dir} does not exist`;
        case 'EACCES':
          return `Not enough permissions to access ${dir}`;
      }
    }
    return `Error accessing ${dir}`;
  }
}

/**
 * Remove root from path property of files.
 * If file is a string (error), it returns it.
 *
 * < files: object return by ls
 * < root: root path
 *
 * > ls object with filtered path
 */
function filter(files, root) {
  if (Array.isArray(files)) {
    files.map(f => ({
      ...f,
      path: util.unroot(f.path, root)
    }));
  }

  return files;
}

/**
 * For dir, return free space available.
 *
 * < dir: path to check against
 *
 * > free space in GB (pure number)
 */
function free(dir) {
  try {
    // retrieve df stoud split in lines
    const stdout = exec(
      'df',
      [
        '--block-size=1M',
        dir
      ], {
      encoding: 'utf-8'
    }).trim().split('\n');
    // retrieve 'free' field
    const info = stdout[stdout.length - 1]
      .replace(/[\s\n\r]+/g, ' ')
      .split(' ');

    // transform in GB and trim to 2 decimal values
    return (info[3] / 1024).toFixed(2);
  } catch (error) {
    log(`error retrieving free space [${error}]`);
    return '-.--';
  }
}

/**
 * Creates a directory at path dir and optionally chmods it to 0777.
 *
 * < dir: path where to create directory
 * < dirNoRoot: for error reporting purposes
 * < chmod: whether to chmod to 0777 or not
 *
 * > message containing status
 */
function mkdir(dir, dirNoRoot, chmod) {
  try {
    // check if folder is writable
    fs.accessSync(path.dirname(dir), fs.constants.W_OK);
    // create dir following symlinks
    fsutils.mkdirs(
      dir,
      { symbolicLinks: false },
      err => {
        if (!err && chmod) {
          // chmod to 777
          fs.chmodSync(dir, parseInt('0777', 8));
        }
      }
    );

    return `${dirNoRoot}: created`;
  } catch (error) {
    if (error) {
      switch (error.code) {
        case 'EACCES':
          return `not enought permissions to create ${dirNoRoot}`;
      }
    }
    return `error trying to create ${dirNoRoot}`;
  }
}

/**
 * Removes all files in names.
 *
 * < names: array of files to remove (relative to root)
 * < root: to build absolute path
 *
 * > message: success/error status
 */
function rm(names, root) {
  let message = '';
  
  let current;
  try {
    names.forEach(name => {
      // populate current for visibility
      current = name;

      const abspath = path.join(root, name);
      // check for file writability
      fs.accessSync(abspath, fs.constants.W_OK);
      // actual deletion
      fsutils.removeSync(abspath, { symbolicLinks: false });

      message += `<p>${name}: deleted</p>\n`;
    });
  } catch (error) {
    if (error) {
      switch (error.code) {
        case 'EPERM':
          log(`not enough permission to delete ${current} [${error}]`);
          message += `<p>${current}: not enough permission to delete</p>\n`;
      }
    }
    message += `<p>${current}: not able to delete</p>\n`;
  }

  return message;
}

/**
 * Copies names array to dst.
 *
 * < names: arrays of filenames (relative to rootSrc)
 * < dst: path of dst folder (relative to rootDst)
 * < rootSrc: to build absolute path for names
 * < rootDst: to unroot dst (for error display)
 * < callbackProg: function to call for progress
 * < callbackStat: function to call for status
 */
function localCp(names, dst, rootSrc, rootDst, callbackProg, callbackStat) {
  const dstPath = path.join(rootDst, dst);

  names.forEach(name => {
    const srcPath = path.join(rootSrc, name);
    const srcNoRoot = name;
    const dstNoRoot = path.join(dst, path.basename(name));

    const rsyncCmd = new rsync()
      // archive (recursive, preserve link, perms, owner, group...)
      // compress
      .flags('a')
      // calculate percent before
      .set('no-i-r')
      // show overall progress
      .set('info', 'progress2')
      .source(srcPath)
      .destination(dstPath);

    let timeStart = Date.now();

    // contains size of copied data in megabytes
    let sizeBytes = 0;

    rsyncCmd.execute(
      // end of operation
      function(error, code, cmd) {
        console.log(error, code, cmd)
        if (callbackStat !== undefined) {
          // log object
          var log = {
            path: srcPath + ' -> ' + dstPath,
            message: 
              util.dateDiff(Date.now(), timeStart).str + ' - ' +
              sizeBytes + 'MB - '
          };

          if (error) {
            log.message += 'KO'
            callbackStat(
              srcNoRoot,
              'error',
              '<p>' + srcNoRoot + ' → ' + dstNoRoot + ': error</p>',
              log
            );
          } else {
            log.message += 'OK'
            // send finished notification
            callbackStat(
              srcNoRoot,
              'copied',
              '<p>' + srcNoRoot + ' → ' + dstNoRoot + ': copied</p>',
              log
            );
          }
        }
      },
      // stdout
      function(data) {
        if (callbackProg !== undefined) {
          // parse line into chunks by space
          var line = data
            .toString('utf-8')
            // replace all whitespace with space
            .replace(/[\s\n\r]+/g, ' ')
            .split(' ');

          // populate sizeBytes if percent is 100
          if (
            line[1] !== undefined
              && 
            line[1].length > 0
              &&
            parseInt(line[2]) == 100
          ) {
            // size given in bytes -> converted to megabytes
            sizeBytes = (
              parseInt(line[1].replace(/,/g, ''))
                /
              1048576
            ).toFixed(2);
          }

          // send { name, percent }
          // if percent is defined and is actually a percent
          if (
            (line[2] !== undefined && !isNaN(parseInt(line[2])))
              &&
            (line[3] !== undefined && line[3].length > 0)
              &&
            (line[4] !== undefined && line[4].length > 0)
          ) {
            callbackProg({
              name: srcNoRoot,
              percent: parseInt(line[2]),
              speed: line[3],
              eta: line[4]
            });
          }
        }
      },
      // stderr
      function(data) {
      }
    );
  });
}

function ftpCp(ftp, names, dst, rootSrc, rootDst, cbProg, cbStat) {
  var dstPath = path.join(rootDst, dst);
  names.forEach(function(elem, i, array) {
    var srcPath = path.join(rootSrc, elem);
    var srcFtp = util.unroot(elem, '/'+ftp.folder);
    var srcNoRoot = elem;
    var dstNoRoot = path.join(dst, path.basename(elem));
    
    var grandSize = exec('du', ['-shm', path.join(rootSrc, elem)])
      .toString().split('\t')[0];

    // configure wget
    wget.set({
      'host': ftp.host,
      'user': ftp.user,
      'passwd': ftp.passwd
    });

    // start the ftp copy
    wget.cp(srcFtp, dstPath,
      // progress
      function(name, percent, speed) {
        cbProg({
          name: name,
          percent: percent,
          speed: speed,
          eta: '--:--:--'
        });
      },
      // end
      function(code, stat, elapsed) {
        var log = {
          path: srcPath + ' -> ' + dstPath,
          message: elapsed + ' - ' + grandSize + 'MB - ' + stat + ' - ' +
            code
        }

        var message  = 'error';
        if (stat == 'OK') {
          // copy ok
          message = 'copied';
        }

        cbStat(
          srcNoRoot,
          message,
          '<p>' + srcNoRoot + ' →  ' + dstNoRoot + ': ' + message + '</p>',
          log
        );
      }
    );
  });
}

/**
 * Watch directory dir for new directories.
 *
 * < dir: directory to watch
 * < callback: called when a new dir appears
 */
var watched;
function watch(dir, callback) {
  // close previous session
  if (watched !== undefined) {
    watched.close();
  }

  // ignore root beacuse
  // well, because it causes eternal check
  if (dir != '/') {
    var watcher = chokidar.watch(dir, {
      ignored: /[\/\\]\./,
      ignoreInitial: true,
      persistent: true,
      depth: 1
    });

    // set watched for future closing
    watched = watcher;

    // watch for new directories
    watcher.on('addDir', function(path) {
      if (callback !== undefined) {
        callback(path);
      }
    });

    // watch for deleted directories
    watcher.on('unlinkDir', function(path) {
      if (callback !== undefined) {
        callback(path);
      }
    });

    watcher.on('error', function(error) {
      // do nothing
    });
  }
}

module.exports = {
  ls,
  filter,
  free,
  mkdir,
  rm,
  localCp,
  ftpCp,
  watch,
}
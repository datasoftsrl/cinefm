(function() {
  'use strict'

  var fs = require('fs');
  var path = require('path');
  var exec = require('child_process').execFileSync;

  var readline = require('n-readlines');
  var fsutils = require('nodejs-fs-utils');
  var _rsync = require('rsync');
  var chokidar = require('chokidar');

  var util = require('./util');
  var wget = require('./wget');

  // populate a structure of type { uid -> username }
  var users = {};
  var line;
  var lines = new readline('/etc/passwd');
  while (line = lines.next()) {
    var args = line.toString('ascii').split(':', 4);
    users[args[2]] = args[0];
  }

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
    if (users.hasOwnProperty(uid)) {
      return users[uid];
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
  function sizeform(size, type) {
    if (type !== undefined && type == 'file') {
      var divide = 0;
      var unit = '';
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
      
      return (size / divide).toFixed(1) + ' ' + unit;
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
    var perms = '';
    // owner
    perms += (mode & parseInt(400, 8)? 'r' : '-');
    perms += (mode & parseInt(200, 8)? 'w' : '-');
    perms += (mode & parseInt(100, 8)? 'x' : '-');
    // group
    perms += (mode & parseInt(40, 8)? 'r' : '-');
    perms += (mode & parseInt(20, 8)? 'w' : '-');
    perms += (mode & parseInt(10, 8)? 'x' : '-');
    // others
    perms += (mode & parseInt(4, 8)? 'r' : '-');
    perms += (mode & parseInt(2, 8)? 'w' : '-');
    perms += (mode & parseInt(1, 8)? 'x' : '-');

    return perms;
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
      var files = fs.readdirSync(dir);

      // metadata object, will contain list of
      // { path, name, type, user, perms }
      var metadata = [];

      // add .. if specified
      if (back !== undefined && back) {
        metadata.push({
          path: path.dirname(dir),
          name: '..',
          type: 'dir',
          user: '-----',
          size: '-----',
          perms: '---------'
        });
      }

      if (hidden === undefined) {
        hidden = false;
      }

      // dir exists, now we lstat every file
      files.forEach(function(elem, i, array) {
        // check if hidden files are to be displayed
        if (hidden || !elem.startsWith('.')) {
          var tmp = {};
          tmp.path = path.join(dir, elem);
          tmp.name = elem;
          try {
            var stats = fs.statSync(tmp.path);
            if (stats) {
              tmp.type = whatis(stats);
              tmp.user = username(stats.uid);
              tmp.size = sizeform(stats.size, tmp.type);
              tmp.perms = perms(stats.mode);
            } else {
              // treat no stat as an error
              throw 'Error';
            }
          } catch (error) {
            // fallback to 'I don't know' case'''
            console.log(error);
            tmp.type = '-';
            tmp.user = '-----';
            tmp.size = '-----';
            tmp.perms = '---------';
          }
          metadata.push(tmp);
        }
      });

      return metadata;

    } catch (error) {
      // if folder does not exist or no access
      if (error && error.code == 'ENOENT') {
        return dir + ' does not exist';
      } else if (error && error.code == 'EACCES') {
        return 'Not enough permissions to access ' + dir;
      }
      return 'Error accessing ' + dir;
    }
  }
  module.exports.ls = ls;

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
    if (typeof files == 'string') {
      return files;
    }
    files.forEach(function(elem, i, array) {
      elem.path = util.unroot(elem.path, root);
    });
    return files;
  }
  module.exports.filter = filter;

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
      var stdout = exec('df', ['--block-size=1M', dir], {
        encoding: 'utf-8'
      }).trim().split('\n');
      // retrieve 'free' field
      var info = stdout[stdout.length - 1].replace(/[\s\n\r]+/g,' ').split(' ');

      // transform in GB and trim to 2 decimal values
      return (info[3] / 1024).toFixed(2);
    } catch (e) {
      return '-.--';
    }
  }
  module.exports.free = free;

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
      fsutils.mkdirs(dir, {
        symbolicLinks: false
      }, function(err) {
        if (chmod && err == null) {
          // chmod to 777
          fs.chmodSync(dir, parseInt('0777', 8));
        }
      });
      return dirNoRoot + ': created';
    } catch (error) {
      if (error && error.code == 'EACCES') {
        return 'not enought permissions to create ' + dirNoRoot;
      }
      return 'error creating ' + dirNoRoot;
    }
  }
  module.exports.mkdir = mkdir;

  /**
   * Removes all files in names.
   *
   * < names: array of files to remove (relative to root)
   * < root: to build absolute path
   *
   * > message: success/error status
   */
  function rm(names, root) {
    var message = '';
    var current;
    try {
      names.forEach(function(elem, i, array) {
        // populate current for visibility
        current = elem;

        var abspath = path.join(root, elem);

        // check for file writability
        fs.accessSync(abspath, fs.constants.W_OK);

        fsutils.removeSync(abspath, {
          symbolicLinks: false
        });

        message += '<p>' + elem + ': deleted</p>\n';
      });
    } catch (error) {
      message += '<p>' + current + ': '
      if (error.code == 'EPERM') {
        message += 'not enough permission to delete</p>\n';
      } else {
        message += 'not able to delete</p>\n';
      }
    }
    return message;
  }
  module.exports.rm = rm;

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
  function cp(names, dst, rootSrc, rootDst, callbackProg, callbackStat) {
    var dstPath = path.join(rootDst, dst);
    names.forEach(function(elem, i, array) {
      var srcPath = path.join(rootSrc, elem);
      var srcNoRoot = elem;
      var dstNoRoot = path.join(dst, path.basename(elem));

      var rsync = new _rsync()
        // archive (recursive, preserve link, perms, owner, group...)
        // compress
        .flags('a')
        // calculate percent before
        .set('no-i-r')
        // show overall progress
        .set('info', 'progress2')
        .source(srcPath)
        .destination(dstPath);

      var timeStart = Date.now();

      // contains size of copied data in megabytes
      var sizeBytes = 0;

      var rsyncEx = rsync.execute(
        // end of operation
        function(error, code, cmd) {
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
  module.exports.cp = cp;

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
  module.exports.ftpCp = ftpCp;

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
  module.exports.watch = watch;

})();

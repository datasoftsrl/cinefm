'use strict'

var SocketProto = function(io) {
  var path = require('path');

  var log = require('./log');
  var config = require('./config');
  var files = require('./files');
  var util = require('./util');

  // a user has made a connection
  io.on('connection', function(socket) {
    var user = socket.handshake.address.split(':')[3];
    log(user + ': has connected');

    // send root files for left and right panel or error
    socket.emit('files', {
      files: files.filter(
          files.ls(config('root-left'), false, config('show-hidden')),
          config('root-left')
        ),
      panel: 'left',
      // path to set on pathbar
      pathbar: '/'
    });

    // watch for files on left root once
    files.watch(config('root-left'), function(path) {
      socket.emit('watch', {
        path: '/',
        added: path
      });
    });

    socket.emit('files', {
      files: files.filter(
          files.ls(config('root-right'), false, config('show-hidden')),
          config('root-right')
        ),
      panel: 'right',
      // path to set on pathbar
      pathbar: '/',
      // free space (only for right panel)
      free: files.free(config('root-right'))
    });

    // client has requested file on a panel
    socket.on('ls', function(data) {
      var dir = data.path;
      var panel = data.panel;
      var conf = config('root-' + panel);
      var hidden = config('show-hidden');

      var toEmit = {
        files: files.filter(
            // insert .. only if requested dir is not /
            files.ls(path.join(conf, dir), dir == '/'? false : true, hidden),
            conf
          ),
        panel: panel,
        // path to set on pathbar
        pathbar: dir
      }

      // if panel == right, set freespace
      if (panel == 'right') {
        toEmit.free = files.free(path.join(conf, dir));
      }

      socket.emit('files', toEmit);

      // if panel == left, watch for dirs
      if (panel == 'left') {
        files.watch(path.join(conf, dir), function(path) {
          socket.emit('watch', {
            path: dir,
            added: path
          });
        });
      }
    });

    // client has requested to create a dir
    socket.on('mkdir', function(data) {
      var panel = data.panel;
      var name = data.name;
      var prefix = data.path;
      var conf = config('root-' + panel);
      // if panel is read-only
      var ro = config('ro-' + panel);

      var message;
      if (ro) {
        // not modifiable -> error
        message = 'Panel ' + panel + ' is set as read-only';
      } else {
        // ok -> create dir
        message = files.mkdir(path.join(conf, prefix, name),
          path.join(prefix, name));
      }

      // send message to display
      socket.emit('result', {
        message: message,
        path: prefix,
        panel: panel
      });

      log.action(user, 'mkdir', path.join(prefix, name), conf, message);
    });

    // client has requested to delete some files
    socket.on('rm', function(data) {
      var panel = data.panel;
      var names = data.names;
      var prefix = data.prefix;
      var conf = config('root-' + panel);
      // if panel is read-only
      var ro = config('ro-' + panel);

      var message;
      if (ro) {
        // not modifiable -> error
        message = 'Panel ' + panel + ' is set as read-only';
      } else {
        // ok -> delete files
        message = files.rm(names, conf);
      }

      // send message to display
      socket.emit('result', {
        message: message,
        path: prefix,
        panel: panel
      });

      log.action(user, 'rm', names, conf,
        util.untag(message.replace(/[\n]+/g, ' ')));
    });

    // client has requested to copy some files
    socket.on('cp', function(data) {
      var panelDst = data.panelDst;
      var panelSrc = data.panelSrc;
      var names = data.names;
      var prefixSrc = data.prefixSrc
      var prefixDst = data.prefixDst;
      var rootSrc = config('root-' + panelSrc);
      var rootDst = config('root-' + panelDst);

      // if panelDst is read-only
      var ro = config('ro-' + panelDst);

      var message;
      if (ro) {
        message = 'Panel ' + panelDst + ' is set as read-only';
        socket.emit('result', {
          message: message,
          path: prefixDst,
          panel: panelDst
        });
      } else {
        files.cp(
          names, prefixDst, rootSrc, rootDst,
          // progress
          function(data) {
            socket.emit('cp-progress', data);
          },
          // status
          function(name, status, message, lg) {
            socket.emit('cp-status', {
              name: name,
              status: status,
              message: message
            });

            // refresh panel
            socket.emit('result', {
              panel: panelDst,
              path: prefixDst
            });

            // log
            log.action(user, 'cp', lg.path, '', lg.message);
          }
        );
      }
    });

    socket.on('disconnect', function() {
      log(user + ': has disconnected');
    });

  });
}

module.exports = SocketProto;

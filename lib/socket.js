'use strict'

const _path = require('path');

const log = require('./log');
const config = require('./config');
const files = require('./files');
const util = require('./util');

function _onlyIfNotReadOnly(panel, writableFn, readOnlyFn) {
  // if panel is read-only
  const ro = config(`ro-${panel}`);

  let ret;
  if (ro) {
    // not modifiable -> error
    ret = `Panel ${panel} is set read-only`;
    if (readOnlyFn) {
      readOnlyFn(message);
    }
  } else {
    // ok -> return result of function
    ret = writableFn();
  }

  return ret;
}

function _filteredUntag(message) {
  return util.untag(message
    // replace all \n except last with ' | '
    .replace(/[\n]+(?=.*\n)/g, ' | ')
    // delete last \n
    .replace('\n', '')
    // replace ':' with ' ->'
    .replace(/:/g, ' ->')
  );
}

function emitFiles(files, panel, pathbar, free=undefined) {
  // send root files for left and right panel or error
  let ret = {
    files,
    panel,
    // path to set on pathbar
    pathbar,
  };

  if (free && panel === 'right') {
    ret['free'] = free;
  }

  return ret;
}

function emitWatch(path, added) {
  return {
    path,
    added
  };
}

function emitResult(path, panel, message=undefined) {
  let ret = {
    path,
    panel
  };

  if (message) {
    ret['message'] = message;
  }

  return ret;
}

function emitCpStatus(name, status, message) {
  return {
    name,
    status,
    message
  }
}

function onLs(data, context) {
  const { path, panel } = data;
  const { socket } = context;
  const conf = config(`root-${panel}`);
  const hidden = config('show-hidden');

  socket.emit('files', emitFiles(
    files.filter(
      // insert .. only if requested dir is not /
      files.ls(_path.join(conf, path), path !== '/', hidden),
      conf
    ),
    panel,
    path,
    files.free(_path.join(conf, path)) || undefined,
  ));

  // if panel == left, watch for dirs
  if (panel === 'left') {
    files.watch(
      _path.join(conf, path),
      newPath => socket.emit('watch', emitWatch(path, newPath))
    );
  }
}

function onMkdir(data, context) {
  const { panel, name, path } = data;
  const { socket, user } = context;
  const conf = config(`root-${panel}`);

  // create dir if not read-only
  const message = _onlyIfNotReadOnly(panel, () => files.mkdir(
        _path.join(conf, path, name),
        _path.join(path, name),
        true
  ));

  // send message to display
  socket.emit('result', emitResult(path, panel, message));
  log.action(user, 'mkdir', _path.join(path, name), conf, message);
}

function onRm(data, context) {
  const { panel, names, prefix } = data;
  const { socket, user } = context;

  const conf = config(`root-${panel}`);

  // delete files if not read-only
  const message = _onlyIfNotReadOnly(panel, () => files.rm(names, conf));

  // send message to display
  socket.emit('result', emitResult(prefix, panel, message));
  log.action(user, 'rm', names, conf, _filteredUntag(message));
}

function _localCopy(copyContext, context) {
  const { names, prefixDst, rootSrc, rootDst, panelDst } = copyContext;
  const { socket, user } = context;
  
  files.localCp(
    names, prefixDst, rootSrc, rootDst,
    // progress
    data => socket.emit('cp-progress', data),
    // status
    (name, status, message, lg) => {
      socket.emit('cp-status', emitCpStatus(name, status, message));

      // refresh panel
      socket.emit('result', emitResult(prefixDst, panelDst));
      log.action(user, 'cp', lg.path, '', lg.message);
    }
  );
}

function _ftpCopy(ftp, copyContext, context) {
  const { names, prefixDst, rootSrc, rootDst, panelDst } = copyContext;
  const { socket, user } = context;
  
  files.ftpCp(
    ftp, names, prefixDst, rootSrc, rootDst,
    // progress
    data => socket.emit('ftpcp-progress', data),
    // status
    (name, status, message, lg) => {
      socket.emit('ftpcp-status', emitCpStatus(name, status, message));

      // refresh panel
      socket.emit('result', emitResult(prefixDst, panelDst));
      log.action(user, 'ftpCp', lg.path, '', lg.message);
    }
  );
}

function onCp(data, context) {
  const { socket } = context;
  const { panelDst, panelSrc, prefixSrc, prefixDst } = data;
  const rootSrc = config(`root-${panelSrc}`);
  const rootDst = config(`root-${panelDst}`);

  const hasFtp = config.has(`ftp-${panelSrc}`);
  const ftp = hasFtp
    ? config(`ftp-${panelSrc}`)
      .filter(e => util.unslash(prefixSrc, true) === e.folder)
    : [];

  const copyContext = {
    ...data,
    rootSrc,
    rootDst,
  }
  _onlyIfNotReadOnly(
    panelDst,
    () => hasFtp && ftp.length
      ? _ftpCopy(ftp, copyContext, context)
      : _localCopy(copyContext, context),
    message => socket.emit('result', emitResult(message, prefixDst, panelDst))
  );
}

function onDisconnect(context) {
  log(`${context.user}: has disconnected`);
}

function onInit(socket) {
  let context = {
    socket: socket,
    user: socket.handshake.address || socket.handshake.host,
  }

  log(`${context.user}: has connected`);

  // send root files for left and right panel or error
  socket.emit('files', emitFiles(
    files.filter(
      files.ls(config('root-left'), false, config('show-hidden')),
      config('root-left')
    ),
    'left',
    '/'
  ));

  // watch for files on left root once
  files.watch(
    config('root-left'),
    path => socket.emit('watch', emitWatch("/", path))
  );

  socket.emit('files', emitFiles(
    files.filter(
      files.ls(config('root-right'), false, config('show-hidden')),
      config('root-right')
    ),
    'right',
    '/',
    files.free(config('root-right')),
  ));
  
  return context;
}

function onConnection(socket) {
  const context = onInit(socket);

  // client has requested file on a panel
  socket.on('ls', data => onLs(data, context));

  // client has requested to create a dir
  socket.on('mkdir', data => onMkdir(data, context));

  // client has requested to delete some files
  socket.on('rm', data => onRm(data, context));

  // client has requested to copy some files
  socket.on('cp', data => onCp(data, context));

  socket.on('disconnect', () => onDisconnect(context));
}

module.exports = (io) => {
  // a user has made a connection
  io.on('connection', onConnection);
}

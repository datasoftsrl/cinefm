#!/usr/bin/env node

(function() {
  'use strict'

  var path = require('path');
  var PREFIX = path.dirname(__dirname);
  var config = require(PREFIX + '/lib/config');
  var log = require(PREFIX + '/lib/log');

  var TITLE = 'CineFM';
  var VERSION = require(PREFIX + '/package.json').version;
  module.exports.title = TITLE;
  module.exports.version = VERSION;

  var express = require('express');
  var app = express();
  var http = require('http').Server(app);
  var io = require('socket.io')(http);
  var nunjucks = require('nunjucks');

  console.log(TITLE + ' ' + VERSION);

  // tell nunjucks to look for template folder
  nunjucks.configure(PREFIX + '/templates', {
    autoescape: false,
    express: app
  });

  // inject static files
  app.use(express.static('static'));

  // path /
  app.get('/', function(req, res) {
    res.render('index.html', {
      title: TITLE,
      version: VERSION,
      poweroff: config('poweroff-button') || false
    });
  });

  // path /help.html
  app.get('/help.html', function(req, res) {
    res.render('help.html', {
      title: TITLE,
      version: VERSION,
      paragraphs: require(PREFIX + '/lib/help')
    });
  });

  require(PREFIX + '/lib/socket')(io);

  // start server
  http.listen(config('port'), function () {
    log(TITLE + ' ' + VERSION + ' started at port ' + config('port'));
  });

  console.log('Listening on port ' + config('port'));

})();

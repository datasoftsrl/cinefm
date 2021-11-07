#!/usr/bin/env node

'use strict'

const express = require('express');

const props = require('../lib/props');
const config = require('../lib/config');
const log = require('../lib/log');
const socket = require('../lib/socket');

const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const nunjucks = require('nunjucks');

console.log(`${props.title} ${props.version}`);

nunjucks.configure(`${__dirname}/../templates`, {
  autoescape: false,
  express: app
});

app.use(express.static('static'));

app.get('/', (_, res) => {
  res.render('index.html', {
    title: props.title,
    version: props.version,
    poweroff: config('poweroff-button') || false
  });
});

app.get('/help.html', (_, res) => {
  res.render('help.html', {
    title: props.title,
    version: props.version,
    paragraphs: require('../lib/help')
  });
});

socket(io);

http.listen(config('port'), () => {
  const logMessage = `${props.title} ${props.version} started at port ${config('port')}`;
  console.log(logMessage);
  log(logMessage)
});
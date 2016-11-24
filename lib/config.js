(function() {
  'use strict'

  var fs = require('fs');
  var util = require('./util');
  var yaml = require('yamljs');

  var defaultConfig = {
    'title': 'CineFM',
    'port': 8080,
    'root-left': '/',
    'root-right': '/',
    'ro-left': false,
    'ro-right': false,
    'show-hidden': false,
    'log-path': '/var/log/cinefm/cinefm.log',
    'poweroff-button': false
  };

  // get config yaml path
  var path = 'config.yml';

  var config = null;
  // get config else
  try {
    var newConfig = yaml.parseFile(path);

    // unslash eventual traling slash into root-*
    if ('root-left' in newConfig) {
      newConfig['root-left'] = util.unslash(newConfig['root-left']);
    }
    if ('root-right' in newConfig) {
      newConfig['root-right'] = util.unslash(newConfig['root-right']);
    }

    // update config to new values
    config = util.update(defaultConfig, newConfig);
  } catch (e) {
    // yaml is badly formatted
    util.error('unexistent or malformed file at ' + path + ', using default' +
      ' config\n    --> "' + e['message'] + "\"");

    // directly use defaultconfig
    config = defaultConfig;
  }

  /**
   * Save config file to specified path.
   */
  module.exports.save = function() {
    fs.writeFile(path, yaml.stringify(config), function (error) {
      if (error) {
        util.error("unable to save config to " + path);
      }
    });
  }

  /**
   * Get a config entry by key.
   *
   * < ket: key to search for
   *
   * > value corresponding to key
   */
  function get(key) {
    if (key) {
      if (config.hasOwnProperty(key)) {
        return config[key];
      } else {
        util.error('key ' + key + ' does not exist');
        process.exit(255);
      }
    }
  }
  module.exports = get;
})()

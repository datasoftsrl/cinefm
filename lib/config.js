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
    ['root-left', 'root-right'].forEach(function(el, i, arr) {
      if (el in newConfig) {
        newConfig[el] = util.unslash(newConfig[el]);
      }
    });

    // unslash eventual leading/trailing slash into ftp-*/folder
    ['ftp-left', 'ftp-right'].forEach(function(elem, i, array) {
      if (elem in newConfig) {
        newConfig[elem].forEach(function(el, y, arr) {
          el['folder'] = util.unslash(el['folder'], true);
        });
      }
    });

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
    util.error('key not specified');
    process.exit(255);
  }
  module.exports = get;

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
   * Checks if a key exists in config dict.
   *
   * < key: key to check against
   *
   * > true if exists, false otherwise.
   */
  module.exports.has = function(key){
    if (key) {
      if (config.hasOwnProperty(key)) {
        return true;
      }
      return false;
    }
    util.error('key not specified');
    process.exit(255);
  }

})()

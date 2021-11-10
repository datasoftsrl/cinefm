'use strict'

const CONFIG_PATH = 'config.yml';

const fs = require('fs');

const yaml = require('yamljs');

const defaultConfig = require('./defaultConfig');
const util = require('./util');

let config ;
try {
  let newConfig = yaml.parseFile(CONFIG_PATH);

  // unslash eventual traling slash into root-*
  ['root-left', 'root-right'].forEach(key => {
    if (key in newConfig) {
      newConfig[key] = util.unslash(newConfig[key]);
    }
  });

  // unslash eventual leading/trailing slash into ftp-*/folder
  ['ftp-left', 'ftp-right'].forEach(key => {
      if (key in newConfig) {
        newConfig[key].forEach(subkey => {
          subkey['folder'] = util.unslash(subkey['folder'], true);
        });
      }
    });

  config = util.update(defaultConfig, newConfig);
} catch (e) {
  util.error(`unexistent or malformed file at ${CONFIG_PATH}, using default config\n    --> "${e}"`);

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
  if (key in config) {
    return config[key];
  }
  util.error(`key ${key} does not exist`);
  process.exit(255);
}

/**
 * Save config file to specified path.
 */
function save() {
  fs.writeFile(path, yaml.stringify(config), error => {
    error && util.error(`unable to save config to ${CONFIG_PATH}`);
  });
}

/**
 * Checks if a key exists in config dict.
 *
 * < key: key to check against
 *
 * > true if exists, false otherwise.
 */
function has(key) {
  if (key in config) {
    return true;
  }
  return false;
}

module.exports = get;
module.exports.save = save;
module.exports.has = has;
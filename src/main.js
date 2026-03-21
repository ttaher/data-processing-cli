#!/usr/bin/env node

const os = require('node:os');

const { repl } = require('./repl');

const navigationState = {
  currentDirectory: os.homedir(),
  homeDirectory: os.homedir(),
};

repl(navigationState);
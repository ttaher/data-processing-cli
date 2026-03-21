const readline = require('node:readline');

const { handleNavigationCommand } = require('./navigation');
const { invalidInputError, parseInput } = require('./utils/argParser');
const { handleCountCommand } = require('./commands/count');
const { handleCsvToJsonCommand } = require('./commands/csvToJson');
const { handleDecryptCommand } = require('./commands/decrypt');
const { handleEncryptCommand } = require('./commands/encrypt');
const { handleHashCommand } = require('./commands/hash');
const { handleHashCompareCommand } = require('./commands/hashCompare');
const { handleJsonToCsvCommand } = require('./commands/jsonToCsv');
const { handleLogStatsCommand } = require('./commands/logStats');

const commandHandlers = {
  'count': handleCountCommand,
  'csv-to-json': handleCsvToJsonCommand,
  'decrypt': handleDecryptCommand,
  'encrypt': handleEncryptCommand,
  'hash': handleHashCommand,
  'hash-compare': handleHashCompareCommand,
  'json-to-csv': handleJsonToCsvCommand,
  'log-stats': handleLogStatsCommand,
};

function createPrompt() {
  return '> ';
}

function printCurrentDirectory(state) {
  console.log(`You are currently in ${state.currentDirectory}`);
}

async function dispatchCommand(state, command, args) {
  if (['up', 'cd', 'ls'].includes(command)) {
    await handleNavigationCommand(state, command, args);
    return;
  }

  const handler = commandHandlers[command];

  if (!handler) {
    throw invalidInputError();
  }

  await handler(state, args);
}

function repl(state) {
  let commandQueue = Promise.resolve();
  let goodbyePrinted = false;
  let inputClosed = false;
  let exitRequested = false;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: createPrompt(),
  });

  function promptIfOpen() {
    if (!inputClosed && !exitRequested) {
      rl.setPrompt(createPrompt());
      rl.prompt();
    }
  }

  console.log('Welcome to Data Processing CLI!');
  printCurrentDirectory(state);
  rl.prompt();

  rl.on('line', (line) => {
    commandQueue = commandQueue
      .then(async () => {
        if (exitRequested) {
          return;
        }

        const [command, ...args] = parseInput(line);

        if (!command) {
          return;
        }

        if (command === '.exit') {
          exitRequested = true;
          rl.close();
          return;
        }

        try {
          await dispatchCommand(state, command, args);
          printCurrentDirectory(state);
        } catch (error) {
          if (error && error.code === 'INVALID_INPUT') {
            console.log('Invalid input');
          } else {
            console.log('Operation failed');
          }
        }
      })
      .catch(() => {
        console.log('Operation failed');
      })
      .finally(() => {
        promptIfOpen();
      });
  });

  rl.on('SIGINT', () => {
    if (!exitRequested) {
      exitRequested = true;
      rl.close();
    }
  });

  rl.on('close', () => {
    inputClosed = true;
    commandQueue.finally(() => {
      if (!goodbyePrinted) {
        goodbyePrinted = true;
        console.log('Thank you for using Data Processing CLI!');
      }
    });
  });
}

module.exports = {
  dispatchCommand,
  printCurrentDirectory,
  repl,
};
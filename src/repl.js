const readline = require('node:readline');

const { navigationCommands } = require('./navigation');
const { parseInput } = require('./utils/argParser');

function createPrompt() {
  return '> ';
}

function printCurrentDirectory(state) {
  console.log(`You are currently in ${state.currentDirectory}`);
}

async function dispatchCommand(state, command, args) {
  if (['up', 'cd', 'ls'].includes(command)) {
    await navigationCommands(state, command, args);
    return;
  }

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
    console.log('Received input:', line);
    commandQueue = commandQueue.then(async () => {
      console.log('Processing command:', line);
      if (exitRequested) {
        console.log('Exit already requested, ignoring input');
        return;
      }

      const [command, ...args] = parseInput(line);
      console.log('Parsed command:', { command, args });
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
  repl
};
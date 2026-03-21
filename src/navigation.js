const fs = require('node:fs/promises');
const path = require('node:path');


const { invalidInputError, operationFailedError } = require('./utils/argParser');
const { resolvePath } = require('./utils/pathResolver');

function ensureNoExtraArgs(args) {
  if (args.length !== 0) {
    throw invalidInputError();
  }
}

async function up(state, args) {
  ensureNoExtraArgs(args);
  const nextDirectory = path.dirname(state.currentDirectory);
  state.currentDirectory = nextDirectory;
}

async function cd(state, args) {
  if (args.length !== 1) {
    throw invalidInputError();
  }

  const targetPath = args[0];
  try {
    const resolvedPath = resolvePath(targetPath, state.currentDirectory, state.homeDirectory);
    const stats = await fs.stat(resolvedPath);

    if (!stats.isDirectory()) {
      throw operationFailedError();
    }

    state.currentDirectory = resolvedPath;
  } catch (error) {
    if (error && error.code === 'INVALID_INPUT') {
      throw error;
    }

    throw operationFailedError();
  }
}
async function ls(state, args) {
  ensureNoExtraArgs(args);

  try {
    const entries = await fs.readdir(state.currentDirectory, { withFileTypes: true });
    for (const entry of entries) {
      const type = entry.isDirectory() ? 'folder' : 'file';
      console.log(`${entry.name} [${type}]`);
    }
  } catch {
    throw operationFailedError();
  }
}

async function handleNavigationCommand(state, command, args) {
  if (command === 'up') {
    await up(state, args);
    return;
  }

  if (command === 'cd') {
    await cd(state, args);
    return;
  }

  if (command === 'ls') {
    await ls(state, args);
  }
}

module.exports = {
  cd,
  handleNavigationCommand,
  ls,
  up,
};
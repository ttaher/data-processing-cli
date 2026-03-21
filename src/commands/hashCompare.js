const fs = require('node:fs');
const { createHash } = require('node:crypto');

const {
  ensureAllowedOptions,
  getStringOption,
  invalidInputError,
  operationFailedError,
  parseCommandArgs,
} = require('../utils/argParser');
const { resolvePath } = require('../utils/pathResolver');

const SUPPORTED_ALGORITHMS = new Set(['sha256', 'md5', 'sha512']);

async function calculateHash(inputPath, algorithm) {
  const hash = createHash(algorithm);
  const input = fs.createReadStream(inputPath);

  for await (const chunk of input) {
    hash.update(chunk);
  }

  return hash.digest('hex');
}

async function readHashFile(hashPath) {
  let content = '';

  for await (const chunk of fs.createReadStream(hashPath, { encoding: 'utf8' })) {
    content += chunk;
  }

  return content.trim().toLowerCase();
}

async function handleHashCompareCommand(state, args) {
  const parsedArgs = parseCommandArgs(args);
  ensureAllowedOptions(parsedArgs.options, ['algorithm', 'hash', 'input']);

  if (parsedArgs.positionals.length !== 0) {
    throw invalidInputError();
  }

  const inputPath = resolvePath(
    getStringOption(parsedArgs.options, 'input', { required: true }),
    state.currentDirectory,
    state.homeDirectory
  );
  const hashPath = resolvePath(
    getStringOption(parsedArgs.options, 'hash', { required: true }),
    state.currentDirectory,
    state.homeDirectory
  );
  const algorithm = getStringOption(parsedArgs.options, 'algorithm', { defaultValue: 'sha256' }).toLowerCase();

  if (!SUPPORTED_ALGORITHMS.has(algorithm)) {
    throw operationFailedError();
  }

  try {
    const [actualHash, expectedHash] = await Promise.all([
      calculateHash(inputPath, algorithm),
      readHashFile(hashPath),
    ]);

    console.log(actualHash.toLowerCase() === expectedHash ? 'OK' : 'MISMATCH');
  } catch {
    throw operationFailedError();
  }
}

module.exports = {
  handleHashCompareCommand,
};
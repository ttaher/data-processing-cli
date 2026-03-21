const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');

const {
  ensureAllowedOptions,
  getBooleanFlag,
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

async function saveHashFile(outputPath, hashValue) {
  await pipeline(Readable.from([`${hashValue}\n`]), fs.createWriteStream(outputPath));
}

async function handleHashCommand(state, args) {
  const parsedArgs = parseCommandArgs(args);
  ensureAllowedOptions(parsedArgs.options, ['algorithm', 'input', 'save']);

  if (parsedArgs.positionals.length !== 0) {
    throw invalidInputError();
  }

  const inputPath = resolvePath(
    getStringOption(parsedArgs.options, 'input', { required: true }),
    state.currentDirectory,
    state.homeDirectory
  );
  const algorithm = getStringOption(parsedArgs.options, 'algorithm', { defaultValue: 'sha256' }).toLowerCase();
  const shouldSave = getBooleanFlag(parsedArgs.options, 'save');

  if (!SUPPORTED_ALGORITHMS.has(algorithm)) {
    throw operationFailedError();
  }

  try {
    const hashValue = await calculateHash(inputPath, algorithm);
    console.log(`${algorithm}: ${hashValue}`);

    if (shouldSave) {
      await saveHashFile(`${inputPath}.${algorithm}`, hashValue);
    }
  } catch {
    throw operationFailedError();
  }
}

module.exports = {
  handleHashCommand,
};
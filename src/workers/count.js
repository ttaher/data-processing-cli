const fs = require('node:fs');

const {
  ensureAllowedOptions,
  getStringOption,
  invalidInputError,
  operationFailedError,
  parseCommandArgs,
} = require('../utils/argParser');
const { resolvePath } = require('../utils/pathResolver');

async function countFile(inputPath) {
  const input = fs.createReadStream(inputPath, { encoding: 'utf8' });
  let lines = 0;
  let words = 0;
  let characters = 0;
  let insideWord = false;
  let hasContent = false;
  let lastCharacter = '';

  for await (const chunk of input) {
    hasContent = true;
    characters += chunk.length;

    for (const character of chunk) {
      if (character === '\n') {
        lines += 1;
      }

      if (/\s/.test(character)) {
        insideWord = false;
      } else if (!insideWord) {
        words += 1;
        insideWord = true;
      }

      lastCharacter = character;
    }
  }

  if (hasContent && lastCharacter !== '\n') {
    lines += 1;
  }

  return {
    characters,
    lines,
    words,
  };
}

async function handleCountCommand(state, args) {
  const parsedArgs = parseCommandArgs(args);
  ensureAllowedOptions(parsedArgs.options, ['input']);

  if (parsedArgs.positionals.length !== 0) {
    throw invalidInputError();
  }

  const inputPath = resolvePath(
    getStringOption(parsedArgs.options, 'input', { required: true }),
    state.currentDirectory,
    state.homeDirectory
  );

  try {
    const counts = await countFile(inputPath);
    console.log(`Lines: ${counts.lines}`);
    console.log(`Words: ${counts.words}`);
    console.log(`Characters: ${counts.characters}`);
  } catch {
    throw operationFailedError();
  }
}

module.exports = {
  handleCountCommand,
};
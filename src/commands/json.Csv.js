const fs = require('node:fs');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');

const {
  ensureAllowedOptions,
  getStringOption,
  invalidInputError,
  operationFailedError,
  parseCommandArgs,
} = require('../utils/argParser');
const { resolvePath } = require('../utils/pathResolver');

async function readStreamToString(stream) {
  let content = '';

  for await (const chunk of stream) {
    content += chunk;
  }

  return content;
}

function escapeCsvValue(value) {
  const normalizedValue = value == null ? '' : String(value);

  if (!/[",\n\r]/.test(normalizedValue)) {
    return normalizedValue;
  }

  return `"${normalizedValue.replace(/"/g, '""')}"`;
}

async function convertJsonToCsv(inputPath, outputPath) {
  const jsonText = await readStreamToString(fs.createReadStream(inputPath, { encoding: 'utf8' }));
  const parsed = JSON.parse(jsonText);

  if (!Array.isArray(parsed)) {
    throw operationFailedError();
  }

  if (parsed.length === 0) {
    await pipeline(Readable.from(['']), fs.createWriteStream(outputPath));
    return;
  }

  const firstRecord = parsed[0];

  if (firstRecord === null || Array.isArray(firstRecord) || typeof firstRecord !== 'object') {
    throw operationFailedError();
  }

  const headers = Object.keys(firstRecord);
  const rows = [headers.map(escapeCsvValue).join(',')];

  for (const record of parsed) {
    if (record === null || Array.isArray(record) || typeof record !== 'object') {
      throw operationFailedError();
    }

    rows.push(headers.map((header) => escapeCsvValue(record[header])).join(','));
  }

  const csvContent = `${rows.join('\n')}\n`;
  await pipeline(Readable.from([csvContent]), fs.createWriteStream(outputPath));
}

async function handleJsonToCsvCommand(state, args) {
  const parsedArgs = parseCommandArgs(args);
  ensureAllowedOptions(parsedArgs.options, ['input', 'output']);

  if (parsedArgs.positionals.length !== 0) {
    throw invalidInputError();
  }

  const inputPath = resolvePath(
    getStringOption(parsedArgs.options, 'input', { required: true }),
    state.currentDirectory,
    state.homeDirectory
  );
  const outputPath = resolvePath(
    getStringOption(parsedArgs.options, 'output', { required: true }),
    state.currentDirectory,
    state.homeDirectory
  );

  try {
    await convertJsonToCsv(inputPath, outputPath);
  } catch {
    throw operationFailedError();
  }
}

module.exports = {
  handleJsonToCsvCommand,
};
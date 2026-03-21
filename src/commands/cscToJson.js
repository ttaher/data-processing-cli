const fs = require('node:fs');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');

const {
  ensureAllowedOptions,
  getStringOption,
  invalidInputError,
  operationFailedError,
  parseCommandArgs,
} = require('../utils/argParser');
const { resolvePath } = require('../utils/pathResolver');

class LineSplitter extends Transform {
  constructor() {
    super({ decodeStrings: false });
    this.buffer = '';
  }

  _transform(chunk, encoding, callback) {
    this.buffer += chunk;
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop();

    for (const line of lines) {
      this.push(line);
    }

    callback();
  }

  _flush(callback) {
    if (this.buffer) {
      this.push(this.buffer);
    }

    callback();
  }
}

class CsvToJsonTransform extends Transform {
  constructor() {
    super({ decodeStrings: false });
    this.hasOutputPrefix = false;
    this.headers = null;
    this.isFirstObject = true;
  }

  _transform(line, encoding, callback) {
    const lineText = String(line);
    const normalizedLine = this.headers ? lineText : lineText.replace(/^\uFEFF/, '');

    if (!normalizedLine.trim()) {
      callback();
      return;
    }

    if (!this.headers) {
      this.headers = parseCsvLine(normalizedLine);
      this.hasOutputPrefix = true;
      this.push('[\n');
      callback();
      return;
    }

    const values = parseCsvLine(normalizedLine);
    const record = {};

    for (let index = 0; index < this.headers.length; index += 1) {
      record[this.headers[index]] = values[index] ?? '';
    }

    const prefix = this.isFirstObject ? '  ' : ',\n  ';
    this.push(`${prefix}${JSON.stringify(record)}`);
    this.isFirstObject = false;
    callback();
  }

  _flush(callback) {
    if (!this.hasOutputPrefix) {
      this.push('[]\n');
      callback();
      return;
    }

    if (!this.isFirstObject) {
      this.push('\n');
    }

    this.push(']\n');
    callback();
  }
}

function parseCsvLine(line) {
  const values = [];
  let currentValue = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (inQuotes) {
      if (character === '"') {
        if (line[index + 1] === '"') {
          currentValue += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentValue += character;
      }

      continue;
    }

    if (character === ',') {
      values.push(currentValue);
      currentValue = '';
      continue;
    }

    if (character === '"') {
      inQuotes = true;
      continue;
    }

    currentValue += character;
  }

  values.push(currentValue);
  return values;
}

async function convertCsvToJson(inputPath, outputPath) {
  await pipeline(
    fs.createReadStream(inputPath, { encoding: 'utf8' }),
    new LineSplitter(),
    new CsvToJsonTransform(),
    fs.createWriteStream(outputPath)
  );
}

async function handleCsvToJsonCommand(state, args) {
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
    await convertCsvToJson(inputPath, outputPath);
  } catch {
    throw operationFailedError();
  }
}

module.exports = {
  handleCsvToJsonCommand,
};
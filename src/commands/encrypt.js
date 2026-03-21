const fs = require('node:fs');
const { createCipheriv, randomBytes, scrypt } = require('node:crypto');
const { promisify } = require('node:util');
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

const scryptAsync = promisify(scrypt);

class EncryptTransform extends Transform {
  constructor(key, salt, iv) {
    super();
    this.header = Buffer.concat([salt, iv]);
    this.headerWritten = false;
    this.cipher = createCipheriv('aes-256-gcm', key, iv);
  }

  _transform(chunk, encoding, callback) {
    try {
      if (!this.headerWritten) {
        this.push(this.header);
        this.headerWritten = true;
      }

      const encryptedChunk = this.cipher.update(chunk);

      if (encryptedChunk.length > 0) {
        this.push(encryptedChunk);
      }

      callback();
    } catch (error) {
      callback(error);
    }
  }

  _flush(callback) {
    try {
      if (!this.headerWritten) {
        this.push(this.header);
        this.headerWritten = true;
      }

      const finalChunk = this.cipher.final();

      if (finalChunk.length > 0) {
        this.push(finalChunk);
      }

      this.push(this.cipher.getAuthTag());
      callback();
    } catch (error) {
      callback(error);
    }
  }
}

async function deriveKey(password, salt) {
  return scryptAsync(password, salt, 32);
}

async function encryptFile(inputPath, outputPath, password) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(password, salt);

  await pipeline(
    fs.createReadStream(inputPath),
    new EncryptTransform(key, salt, iv),
    fs.createWriteStream(outputPath)
  );
}

async function handleEncryptCommand(state, args) {
  const parsedArgs = parseCommandArgs(args);
  ensureAllowedOptions(parsedArgs.options, ['input', 'output', 'password']);

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
  const password = getStringOption(parsedArgs.options, 'password', { required: true });

  try {
    await encryptFile(inputPath, outputPath, password);
  } catch {
    throw operationFailedError();
  }
}

module.exports = {
  handleEncryptCommand,
};
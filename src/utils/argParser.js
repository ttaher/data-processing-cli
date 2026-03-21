function parseInput(rawInput) {
  const matches = rawInput.match(/"([^"]*)"|'([^']*)'|\S+/g) || [];

  return matches.map((token) => token.replace(/^['"]|['"]$/g, ''));
}

function parseCommandArgs(tokens) {
  const options = {};
  const positionals = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    const equalSignIndex = token.indexOf('=');

    if (equalSignIndex !== -1) {
      const optionName = token.slice(2, equalSignIndex);
      const optionValue = token.slice(equalSignIndex + 1);
      options[optionName] = optionValue;
      continue;
    }

    const optionName = token.slice(2);
    const nextToken = tokens[index + 1];

    if (!nextToken || nextToken.startsWith('--')) {
      options[optionName] = true;
      continue;
    }

    options[optionName] = nextToken;
    index += 1;
  }

  return {
    options,
    positionals,
  };
}

function createCliError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function invalidInputError() {
  return createCliError('INVALID_INPUT', 'Invalid input');
}

function operationFailedError() {
  return createCliError('OPERATION_FAILED', 'Operation failed');
}

function ensureAllowedOptions(options, allowedOptions) {
  const allowed = new Set(allowedOptions);

  for (const optionName of Object.keys(options)) {
    if (!allowed.has(optionName)) {
      throw invalidInputError();
    }
  }
}

function getStringOption(options, optionName, config = {}) {
  const { defaultValue, required = false } = config;
  const value = options[optionName];

  if (value === undefined) {
    if (required) {
      throw invalidInputError();
    }

    return defaultValue;
  }

  if (value === true || value === '') {
    throw invalidInputError();
  }

  return value;
}

function getBooleanFlag(options, optionName) {
  const value = options[optionName];

  if (value === undefined) {
    return false;
  }

  if (value !== true) {
    throw invalidInputError();
  }

  return true;
}

module.exports = {
  ensureAllowedOptions,
  getBooleanFlag,
  getStringOption,
  invalidInputError,
  operationFailedError,
  parseCommandArgs,
  parseInput,
};
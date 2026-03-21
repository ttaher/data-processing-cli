
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

function parseInput(rawInput) {
  const matches = rawInput.match(/"([^"]*)"|'([^']*)'|\S+/g) || [];

  return matches.map((token) => token.replace(/^['"]|['"]$/g, ''));
}

module.exports = {
  parseInput,
  invalidInputError,
  operationFailedError
};
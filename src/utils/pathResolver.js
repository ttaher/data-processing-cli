const path = require('node:path');

function resolvePath(inputPath, currentDirectory, homeDirectory) {
  if (!inputPath || inputPath === '~') {
    return homeDirectory;
  }

  if (inputPath.startsWith('~')) {
    return path.resolve(homeDirectory, inputPath.slice(1));
  }

  if (path.isAbsolute(inputPath)) {
    return path.normalize(inputPath);
  }

  return path.resolve(currentDirectory, inputPath);
}

module.exports = {
  resolvePath,
};
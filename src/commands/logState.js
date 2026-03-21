const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { Worker } = require('node:worker_threads');

const {
  ensureAllowedOptions,
  getStringOption,
  invalidInputError,
  operationFailedError,
  parseCommandArgs,
} = require('../utils/argParser');
const { resolvePath } = require('../utils/pathResolver');

function runWorker(workerData) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, '../workers/logWorker.js'), { workerData });

    worker.once('message', resolve);
    worker.once('error', reject);
    worker.once('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}

async function findChunkBoundary(fileHandle, position, fileSize) {
  if (position <= 0) {
    return 0;
  }

  if (position >= fileSize) {
    return fileSize;
  }

  const buffer = Buffer.alloc(64 * 1024);
  let cursor = position;

  while (cursor < fileSize) {
    const length = Math.min(buffer.length, fileSize - cursor);
    const { bytesRead } = await fileHandle.read(buffer, 0, length, cursor);

    if (bytesRead === 0) {
      return fileSize;
    }

    const slice = buffer.subarray(0, bytesRead);
    const newlineIndex = slice.indexOf(0x0a);

    if (newlineIndex !== -1) {
      return cursor + newlineIndex + 1;
    }

    cursor += bytesRead;
  }

  return fileSize;
}

async function createChunks(filePath, workerCount) {
  const stats = await fsp.stat(filePath);
  const fileSize = stats.size;

  if (fileSize === 0) {
    return Array.from({ length: workerCount }, () => ({ end: -1, start: 0 }));
  }

  const boundaries = new Array(workerCount + 1).fill(0);
  const approximateChunkSize = Math.ceil(fileSize / workerCount);
  const fileHandle = await fsp.open(filePath, 'r');

  boundaries[0] = 0;
  boundaries[workerCount] = fileSize;

  try {
    let previousBoundary = 0;

    for (let index = 1; index < workerCount; index += 1) {
      const target = Math.min(fileSize, index * approximateChunkSize);
      const boundary = await findChunkBoundary(fileHandle, target, fileSize);
      boundaries[index] = Math.max(previousBoundary, boundary);
      previousBoundary = boundaries[index];
    }
  } finally {
    await fileHandle.close();
  }

  return Array.from({ length: workerCount }, (_, index) => ({
    end: boundaries[index + 1] - 1,
    start: boundaries[index],
  }));
}

function createEmptyStats() {
  return {
    levels: {
      ERROR: 0,
      INFO: 0,
      WARN: 0,
    },
    paths: {},
    responseTimeSum: 0,
    status: {
      '2xx': 0,
      '3xx': 0,
      '4xx': 0,
      '5xx': 0,
    },
    total: 0,
  };
}

function mergeStats(partials) {
  const merged = createEmptyStats();

  for (const partial of partials) {
    merged.total += partial.total;
    merged.responseTimeSum += partial.responseTimeSum;

    for (const [level, count] of Object.entries(partial.levels)) {
      merged.levels[level] = (merged.levels[level] || 0) + count;
    }

    for (const [statusBucket, count] of Object.entries(partial.status)) {
      merged.status[statusBucket] = (merged.status[statusBucket] || 0) + count;
    }

    for (const [requestPath, count] of Object.entries(partial.paths)) {
      merged.paths[requestPath] = (merged.paths[requestPath] || 0) + count;
    }
  }

  const topPaths = Object.entries(merged.paths)
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0]);
    })
    .slice(0, 10)
    .map(([requestPath, count]) => ({ count, path: requestPath }));

  return {
    avgResponseTimeMs: merged.total === 0 ? 0 : Number((merged.responseTimeSum / merged.total).toFixed(2)),
    levels: merged.levels,
    status: merged.status,
    topPaths,
    total: merged.total,
  };
}

async function writeResult(outputPath, result) {
  await pipeline(Readable.from([`${JSON.stringify(result, null, 2)}\n`]), fs.createWriteStream(outputPath));
}

async function handleLogStatsCommand(state, args) {
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
    const workerCount = Math.max(os.cpus().length, 1);
    const chunks = await createChunks(inputPath, workerCount);
    const partials = await Promise.all(
      chunks.map((chunk) =>
        runWorker({
          end: chunk.end,
          filePath: inputPath,
          start: chunk.start,
        })
      )
    );
    const result = mergeStats(partials);
    await writeResult(outputPath, result);
  } catch {
    throw operationFailedError();
  }
}

module.exports = {
  handleLogStatsCommand,
};
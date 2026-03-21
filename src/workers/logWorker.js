const fs = require('node:fs');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { parentPort, workerData } = require('node:worker_threads');

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

function getStatusBucket(statusCode) {
  const family = Math.floor(statusCode / 100);

  if (family >= 2 && family <= 5) {
    return `${family}xx`;
  }

  return null;
}

function processLogLine(line, stats) {
  if (!line.trim()) {
    return;
  }

  const parts = line.trim().split(/\s+/);

  if (parts.length < 7) {
    return;
  }

  const level = parts[1].toUpperCase();
  const statusCode = Number(parts[3]);
  const responseTime = Number(parts[4]);
  const requestPath = parts.slice(6).join(' ');

  stats.total += 1;
  stats.responseTimeSum += Number.isFinite(responseTime) ? responseTime : 0;
  stats.levels[level] = (stats.levels[level] || 0) + 1;

  const statusBucket = getStatusBucket(statusCode);

  if (statusBucket) {
    stats.status[statusBucket] = (stats.status[statusBucket] || 0) + 1;
  }

  if (requestPath) {
    stats.paths[requestPath] = (stats.paths[requestPath] || 0) + 1;
  }
}

async function analyzeLogChunk(filePath, start, end) {
  if (start > end) {
    return createEmptyStats();
  }

  const stats = createEmptyStats();
  const lineProcessor = new Transform({
    decodeStrings: false,
    transform(line, encoding, callback) {
      processLogLine(String(line), stats);
      callback();
    },
  });

  await pipeline(
    fs.createReadStream(filePath, { encoding: 'utf8', end, start }),
    new LineSplitter(),
    lineProcessor
  );

  return stats;
}

analyzeLogChunk(workerData.filePath, workerData.start, workerData.end)
  .then((result) => {
    parentPort.postMessage(result);
  })
  .catch((error) => {
    setImmediate(() => {
      throw error;
    });
  });
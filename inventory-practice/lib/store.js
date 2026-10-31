const fs = require('node:fs/promises');
const path = require('node:path');
const { HttpError } = require('./http');

// Check that a value can be an ID without losing integer precision.
function validId(value) {
  return Number.isSafeInteger(value) && value > 0;
}

// Keep one promise queue per service, so read-modify-write operations cannot overlap.
function createStore(file, validate) {
  let queue = Promise.resolve();

  // Validate stored data before use; never turn a bad file into an empty dataset.
  async function read() {
    try {
      const rows = JSON.parse(await fs.readFile(file, 'utf8'));
      if (!Array.isArray(rows)) throw new Error('Expected array');
      const ids = new Set();
      const productIds = new Set();
      for (const row of rows) {
        if (!row || !validId(row.id) || ids.has(row.id)) throw new Error('Invalid stored ID');
        validate(row);
        ids.add(row.id);
        if ('productId' in row) {
          if (productIds.has(row.productId)) throw new Error('Duplicate stored productId');
          productIds.add(row.productId);
        }
      }
      return rows;
    } catch {
      throw new HttpError(500, 'Storage unavailable or invalid. Check the data file; it was not reset.');
    }
  }

  // Atomically replace the file after a complete write, preserving the last good file on failure.
  async function write(rows) {
    const temporary = `${file}.tmp`;
    try {
      await fs.writeFile(temporary, JSON.stringify(rows, null, 2) + '\n', { flag: 'wx' });
      await fs.rename(temporary, file);
    } catch {
      // A temporary file is retained for diagnosis if an interrupted write left one behind.
      throw new HttpError(500, 'Storage write failed. Check permissions, disk space and .tmp files.');
    }
  }

  // Serialize reads too, so they see the completed result of any preceding mutation.
  function run(operation) {
    const task = queue.then(async () => operation(await read(), write));
    queue = task.catch(() => {});
    return task;
  }

  return { run };
}

// Resolve data relative to this project unless DATA_DIR explicitly selects disposable data.
function dataFile(name) {
  return path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), name);
}

module.exports = { createStore, dataFile, validId };

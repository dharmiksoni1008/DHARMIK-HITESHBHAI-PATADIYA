const fs = require('node:fs/promises');
const path = require('node:path');

// Reset only the fixed disposable manual-test directory; stop services before running.
async function reset() {
  const directory = path.join(__dirname, '..', '.scratch', 'manual');
  await fs.mkdir(directory, { recursive: true });
  for (const name of ['products', 'stock']) {
    await fs.writeFile(path.join(directory, `${name}.json`), '[]\n');
  }
  console.log('Reset .scratch/manual only. Use DATA_DIR=.scratch/manual in all service terminals.');
}
reset().catch(error => { console.error('Reset failed:', error.code || error.name); process.exitCode = 1; });

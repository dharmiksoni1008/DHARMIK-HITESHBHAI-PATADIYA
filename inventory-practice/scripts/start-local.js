const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const path = require('node:path');

// Launch all three local servers for cloud tasks; separate npm commands remain available.
function startLocal() {
  const environment = { ...process.env };
  for (const name of ['GATEWAY_SECRET', 'ADMIN_KEY']) {
    if (!environment[name]) environment[name] = randomBytes(32).toString('hex');
  }
  if (!process.env.ADMIN_KEY) {
    console.log('Using a temporary private admin key held only in memory. For browser editing, configure your own ADMIN_KEY and restart.');
  }
  const children = [];
  let stopping = false;

  // Stop only servers launched by this parent when it stops or a child fails.
  function stop(code = 0) {
    if (stopping) return;
    stopping = true;
    process.exitCode = code;
    for (const child of children) child.kill();
  }

  for (const service of ['products', 'stock', 'gateway']) {
    const child = spawn(process.execPath, [path.join(__dirname, '..', 'services', `${service}.js`)],
      { env: environment, stdio: 'inherit' });
    children.push(child);
    child.on('error', () => { console.error(`Could not launch ${service}.`); stop(1); });
    child.on('exit', () => { if (!stopping) { console.error(`${service} stopped.`); stop(1); } });
  }
  process.on('SIGINT', () => stop());
  process.on('SIGTERM', () => stop());
}
startLocal();

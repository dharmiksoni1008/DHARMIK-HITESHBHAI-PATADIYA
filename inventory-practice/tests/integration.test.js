const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');

const root = path.join(__dirname, '..');
const admin = randomBytes(24).toString('hex');
const secret = randomBytes(24).toString('hex');
let dataDir;
const children = new Set();

// Start an actual server and require its listening message before testing it.
function start(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file], { cwd: root,
      env: { ...process.env, ADMIN_KEY: admin, GATEWAY_SECRET: secret,
        DATA_DIR: dataDir, GATEWAY_TIMEOUT_MS: '150' }, stdio: ['ignore', 'pipe', 'pipe'] });
    children.add(child);
    let output = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error(`Startup timeout: ${output}`)); }, 4000);
    child.stdout.on('data', chunk => {
      output += chunk;
      if (output.includes('listening on')) { clearTimeout(timer); resolve(child); }
    });
    child.stderr.on('data', chunk => { output += chunk; });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => {
      clearTimeout(timer);
      children.delete(child);
      if (!output.includes('listening on')) reject(new Error(`Startup failed (${code}): ${output}`));
    });
  });
}

// Stop only a test-owned process and wait until its port is released.
async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill();
  await exited;
}

// Make a normal HTTP request through the gateway, unless explicitly testing direct access.
async function call(route, { method = 'GET', body, raw, key = admin, port = 3000, headers = {} } = {}) {
  const outgoing = { ...headers };
  if (key !== null) outgoing.Authorization = `Bearer ${key}`;
  if (body !== undefined) outgoing['Content-Type'] = 'application/json';
  const response = await fetch(`http://127.0.0.1:${port}${route}`, {
    method, headers: outgoing,
    body: raw === undefined ? (body === undefined ? undefined : JSON.stringify(body)) : raw,
    signal: AbortSignal.timeout(4000)
  });
  const text = await response.text();
  return { status: response.status, body: JSON.parse(text), headers: response.headers, text };
}

// Assert that an error has both the expected status and the common JSON shape.
function errorIs(result, status) {
  assert.equal(result.status, status);
  assert.equal(typeof result.body.error, 'string');
  assert.ok(result.body.error.length);
  assert.ok(!result.text.includes(secret));
  assert.ok(!result.text.includes(admin));
}

test('inventory HTTP workflow (disposable data, real servers)', async t => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'inventory-test-'));
  await fs.writeFile(path.join(dataDir, 'products.json'), '[]\n');
  await fs.writeFile(path.join(dataDir, 'stock.json'), '[]\n');
  t.after(async () => {
    for (const child of [...children]) await stop(child);
    await fs.rm(dataDir, { recursive: true, force: true });
  });
  let products = await start('services/products.js');
  let stock = await start('services/stock.js');
  await start('services/gateway.js');

  await t.test('empty datasets and public reads', async () => {
    for (const resource of ['products', 'stock']) {
      const result = await call(`/${resource}`, { key: null });
      assert.equal(result.status, 200);
      assert.deepEqual(result.body, []);
    }
  });
  await t.test('static page and scripts served through gateway', async () => {
    for (const asset of ['/', '/app.js', '/style.css']) {
      const response = await fetch(`http://127.0.0.1:3000${asset}`);
      assert.equal(response.status, 200);
      const text = await response.text();
      assert.ok(text.length > 100);
      assert.ok(!text.includes(secret));
      assert.ok(!text.includes(admin));
      if (asset === '/app.js') {
        assert.ok(!text.includes('3001'));
        assert.ok(!text.includes('3002'));
        assert.ok(!text.includes('innerHTML'));
      }
    }
  });
  for (const [resource, sample] of [['products', { name: 'Notebook', price: 3.5 }], ['stock', { productId: 1, quantity: 10 }]]) {
    await t.test(`${resource}: POST, collection GET, item GET, PUT and required PUT fields`, async () => {
      const created = await call(`/${resource}`, { method: 'POST', body: sample });
      assert.equal(created.status, 201);
      assert.deepEqual(created.body, { id: 1, ...sample });
      assert.equal(created.headers.get('location'), `/${resource}/1`);
      assert.deepEqual((await call(`/${resource}`)).body, [created.body]);
      assert.deepEqual((await call(`/${resource}/1`)).body, created.body);
      errorIs(await call(`/${resource}/1`, { method: 'PUT', body: {} }), 400);
      const update = resource === 'products' ? { name: '  Free item  ', price: 0 } : { productId: 1, quantity: 0 };
      const result = await call(`/${resource}/1`, { method: 'PUT', body: update });
      assert.equal(result.status, 200);
      assert.equal(resource === 'products' ? result.body.price : result.body.quantity, 0);
      if (resource === 'products') assert.equal(result.body.name, 'Free item');
    });
  }
  const invalidProducts = [ {}, { name: '', price: 1 }, { name: '  ', price: 1 },
    { name: 7, price: 1 }, { name: null, price: 1 }, { name: 'x' },
    { name: 'x', price: '1' }, { name: 'x', price: -1 }, { name: 'x', price: null },
    { name: 'x', price: true } ];
  for (const [i, body] of invalidProducts.entries()) {
    await t.test(`invalid product fields ${i + 1}`, async () => errorIs(await call('/products', { method: 'POST', body }), 400));
  }
  const invalidStock = [ {}, { productId: 0, quantity: 1 }, { productId: -1, quantity: 1 },
    { productId: 1.5, quantity: 1 }, { productId: '1', quantity: 1 },
    { productId: 1 }, { productId: 1, quantity: -1 }, { productId: 1, quantity: 0.5 },
    { productId: 1, quantity: '1' }, { productId: 1, quantity: null },
    { productId: 9007199254740992, quantity: 1 }, { productId: 1, quantity: 9007199254740992 } ];
  for (const [i, body] of invalidStock.entries()) {
    await t.test(`invalid stock fields ${i + 1}`, async () => errorIs(await call('/stock', { method: 'POST', body }), 400));
  }
  await t.test('invalid JSON, non-object JSON, overflow number and wrong media type', async () => {
    for (const resource of ['products', 'stock']) {
      for (const raw of ['{', '', 'null', '[]', '"text"']) {
        errorIs(await call(`/${resource}`, { method: 'POST', raw, headers: { 'Content-Type': 'application/json' } }), 400);
      }
      errorIs(await call(`/${resource}`, { method: 'POST', raw: '{}', headers: { 'Content-Type': 'text/plain' } }), 415);
      errorIs(await call(`/${resource}`, { method: 'POST', raw: '{}' }), 415);
    }
    errorIs(await call('/products', { method: 'POST', raw: '{"name":"x","price":1e999}', headers: { 'Content-Type': 'application/json' } }), 400);
  });
  await t.test('8 KiB request boundary and oversized body', async () => {
    const prefix = '{"name":"limit","price":0,"padding":"';
    const suffix = '"}';
    const raw = prefix + 'x'.repeat(8192 - prefix.length - suffix.length) + suffix;
    assert.equal((await call('/products', { method: 'POST', raw, headers: { 'Content-Type': 'application/json' } })).status, 201);
    errorIs(await call('/products', { method: 'POST', raw: raw + ' ', headers: { 'Content-Type': 'application/json' } }), 413);
    errorIs(await call('/stock', { method: 'POST', raw: 'x'.repeat(8193) }), 413);
  });
  await t.test('invalid and nonexistent IDs, unknown routes and methods', async () => {
    for (const resource of ['products', 'stock']) {
      for (const id of ['0', '-1', 'abc', '1.5', '9007199254740992']) errorIs(await call(`/${resource}/${id}`), 400);
      for (const method of ['GET', 'PUT', 'DELETE']) {
        const body = method === 'PUT' ? (resource === 'products' ? { name: 'x', price: 0 } : { productId: 3, quantity: 0 }) : undefined;
        errorIs(await call(`/${resource}/9999`, { method, body }), 404);
      }
      for (const [route, method] of [[`/${resource}`, 'DELETE'], [`/${resource}/1`, 'POST'], [`/${resource}/1`, 'PATCH']]) {
        const result = await call(route, { method });
        errorIs(result, 405);
        assert.ok(result.headers.get('allow'));
      }
      errorIs(await call(`/${resource}/1/extra`), 404);
    }
    for (const route of ['/unknown', '/produts', '/stocks', '/.env', '/data/products.json']) errorIs(await call(route), 404);
  });
  await t.test('admin required for every mutation and internal spoofing cannot bypass it', async () => {
    for (const resource of ['products', 'stock']) {
      for (const method of ['POST', 'PUT', 'DELETE']) {
        const route = method === 'POST' ? `/${resource}` : `/${resource}/1`;
        for (const key of [null, 'wrong']) errorIs(await call(route, { method, body: {}, key }), 401);
        errorIs(await call(route, { method, body: {}, key: null, headers: { 'x-gateway-secret': secret } }), 401);
      }
      assert.equal((await call(`/${resource}`, { headers: { 'x-gateway-secret': 'spoof' } })).status, 200);
    }
  });
  await t.test('both service ports reject absent and incorrect internal credentials', async () => {
    for (const [port, resource] of [[3001, 'products'], [3002, 'stock']]) {
      errorIs(await call(`/${resource}`, { port }), 401);
      errorIs(await call(`/${resource}`, { port, headers: { 'x-gateway-secret': 'wrong' } }), 401);
    }
  });
  await t.test('stock policy: duplicate conflict, unverified references and product deletion', async () => {
    errorIs(await call('/stock', { method: 'POST', body: { productId: 1, quantity: 2 } }), 409);
    const orphan = await call('/stock', { method: 'POST', body: { productId: 777, quantity: 0 } });
    assert.equal(orphan.status, 201);
    errorIs(await call(`/stock/${orphan.body.id}`, { method: 'PUT', body: { productId: 1, quantity: 1 } }), 409);
    assert.equal((await call('/products/1', { method: 'DELETE' })).status, 200);
    assert.equal((await call('/stock/1')).status, 200);
    assert.equal((await call('/stock/1', { method: 'DELETE' })).status, 200);
    errorIs(await call('/stock/1'), 404);
    errorIs(await call('/stock/1', { method: 'DELETE' }), 404);
  });
  await t.test('parallel writes keep all changes with distinct IDs', async () => {
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => call('/products', {
      method: 'POST', body: { name: `Concurrent ${i}`, price: i } })));
    assert.ok(results.every(result => result.status === 201));
    assert.equal(new Set(results.map(result => result.body.id)).size, 12);
    const all = (await call('/products')).body;
    assert.equal(all.filter(row => row.name.startsWith('Concurrent ')).length, 12);
  });
  await t.test('both datasets persist across service restart', async () => {
    const before = [(await call('/products')).body, (await call('/stock')).body];
    await stop(products); await stop(stock);
    products = await start('services/products.js'); stock = await start('services/stock.js');
    assert.deepEqual([(await call('/products')).body, (await call('/stock')).body], before);
  });
  await t.test('corrupt, invalid and missing storage are preserved and reported', async () => {
    for (const resource of ['products', 'stock']) {
      const file = path.join(dataDir, `${resource}.json`);
      const original = await fs.readFile(file, 'utf8');
      for (const bad of ['{broken', '{}', '[{"id":1}]']) {
        await fs.writeFile(file, bad);
        errorIs(await call(`/${resource}`), 500);
        const body = resource === 'products' ? { name: 'x', price: 0 } : { productId: 45, quantity: 0 };
        errorIs(await call(`/${resource}`, { method: 'POST', body }), 500);
        assert.equal(await fs.readFile(file, 'utf8'), bad);
      }
      await fs.rm(file);
      errorIs(await call(`/${resource}`), 500);
      await fs.writeFile(file, original);
      assert.equal((await call(`/${resource}`)).status, 200);
    }
  });
  await t.test('failed temporary write preserves both original data files and queue recovery', async () => {
    for (const resource of ['products', 'stock']) {
      const file = path.join(dataDir, `${resource}.json`);
      const original = await fs.readFile(file, 'utf8');
      await fs.mkdir(`${file}.tmp`);
      const body = resource === 'products' ? { name: 'write failure', price: 0 } : { productId: 888, quantity: 0 };
      errorIs(await call(`/${resource}`, { method: 'POST', body }), 500);
      assert.equal(await fs.readFile(file, 'utf8'), original);
      await fs.rmdir(`${file}.tmp`);
      assert.equal((await call(`/${resource}`, { method: 'POST', body })).status, 201);
    }
  });
  await t.test('stopped downstream returns 502, gateway stays alive and recovers', async () => {
    await stop(products);
    errorIs(await call('/products'), 502);
    assert.equal((await call('/stock')).status, 200);
    products = await start('services/products.js');
    assert.equal((await call('/products')).status, 200);
    await stop(stock);
    errorIs(await call('/stock'), 502);
    stock = await start('services/stock.js');
    assert.equal((await call('/stock')).status, 200);
  });
  await t.test('controlled timeout returns 504 within a bounded deadline and then recovers', async () => {
    await stop(products);
    const slow = await start('tests/slow-service.js');
    const began = Date.now();
    errorIs(await call('/products'), 504);
    assert.ok(Date.now() - began < 2000);
    assert.equal((await call('/stock')).status, 200);
    await stop(slow);
    products = await start('services/products.js');
    assert.equal((await call('/products')).status, 200);
  });
});

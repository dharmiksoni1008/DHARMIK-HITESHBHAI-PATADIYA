const { HttpError, sendJson, matches, requireSecret, readJson,
  resourceRoute, checkMethod, createServer } = require('./http');
const { createStore, dataFile } = require('./store');

// Start one independent CRUD service with a shared, small request-handling pattern.
function startService(resource, port, validate) {
  const secret = requireSecret('GATEWAY_SECRET');
  const store = createStore(dataFile(`${resource}.json`), validate);
  const server = createServer(async (req, res) => {
    if (!matches(req.headers['x-gateway-secret'], secret)) {
      throw new HttpError(401, 'Gateway authentication required.');
    }
    const route = resourceRoute(new URL(req.url, 'http://localhost').pathname, resource);
    if (!route) throw new HttpError(404, 'Route not found.');
    checkMethod(req, res, route.id);
    const input = ['POST', 'PUT'].includes(req.method) ? validate(await readJson(req)) : null;
    const result = await store.run(async (rows, write) => {
      const index = rows.findIndex(row => row.id === route.id);
      if (route.id !== null && index === -1) throw new HttpError(404, 'Record not found.');
      if (req.method === 'GET') return { status: 200, body: route.id === null ? rows : rows[index] };
      if (resource === 'stock' && input && rows.some(row => row.productId === input.productId && row.id !== route.id)) {
        throw new HttpError(409, 'A stock record already exists for this productId.');
      }
      if (req.method === 'POST') {
        const id = rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;
        if (!Number.isSafeInteger(id)) throw new HttpError(409, 'ID range exhausted.');
        const row = { id, ...input };
        rows.push(row);
        await write(rows);
        return { status: 201, body: row, location: `/${resource}/${id}` };
      }
      if (req.method === 'PUT') {
        rows[index] = { id: route.id, ...input };
        await write(rows);
        return { status: 200, body: rows[index] };
      }
      rows.splice(index, 1);
      await write(rows);
      return { status: 200, body: { message: 'Record deleted.' } };
    });
    sendJson(res, result.status, result.body, result.location ? { Location: result.location } : {});
  });
  server.listen(port, '127.0.0.1', () => console.log(`${resource} listening on ${port}`));
  return server;
}

module.exports = { startService };

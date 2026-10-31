// A disposable downstream fixture: it accepts requests but never sends a response.
// Stop the real product service first. This fixture cannot read or write inventory.
const http = require('node:http');
const server = http.createServer((req, res) => {
  req.resume();
  // Hold the request open until the gateway enforces its deadline.
});
server.listen(3001, '127.0.0.1', () => console.log('Slow fixture listening on 3001'));

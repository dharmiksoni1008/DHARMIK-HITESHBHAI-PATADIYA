const { HttpError } = require('../lib/http');
const { startService } = require('../lib/service');

// Require both product fields for POST and full replacement PUT; ignore extra fields.
function validateProduct(value) {
  if (typeof value.name !== 'string' || !value.name.trim()) {
    throw new HttpError(400, 'name must be a non-empty string.');
  }
  if (typeof value.price !== 'number' || !Number.isFinite(value.price) || value.price < 0) {
    throw new HttpError(400, 'price must be a finite number greater than or equal to zero.');
  }
  return { name: value.name.trim(), price: value.price };
}

startService('products', 3001, validateProduct);

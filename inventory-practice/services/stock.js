const { HttpError } = require('../lib/http');
const { validId } = require('../lib/store');
const { startService } = require('../lib/service');

// Require a positive product ID and an exact, non-negative integer quantity.
function validateStock(value) {
  if (!validId(value.productId)) throw new HttpError(400, 'productId must be a positive safe integer.');
  if (!Number.isSafeInteger(value.quantity) || value.quantity < 0) {
    throw new HttpError(400, 'quantity must be a non-negative safe integer.');
  }
  return { productId: value.productId, quantity: value.quantity };
}

startService('stock', 3002, validateStock);

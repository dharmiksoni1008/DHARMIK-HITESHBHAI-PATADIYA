// Look up one fixed form or output element.
function element(id) { return document.getElementById(id); }

// Show API messages as text, never as executable HTML.
function showMessage(text, isError = false) {
  element('message').textContent = text;
  element('message').dataset.error = String(isError);
}

// Call a relative gateway URL, attaching the entered key only to edits.
async function request(url, method = 'GET', body) {
  const headers = {};
  if (method !== 'GET') headers.Authorization = `Bearer ${element('admin-key').value}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(url, { method, headers,
    body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${result.error}`);
  return result;
}

// Add a plain text cell so names containing markup remain harmless.
function addCell(row, value) {
  const cell = document.createElement('td');
  cell.textContent = String(value);
  row.append(cell);
  return cell;
}

// Fill the corresponding form to make an existing record easy to update.
function editRecord(resource, record) {
  if (resource === 'products') {
    element('product-id').value = record.id;
    element('product-name').value = record.name;
    element('product-price').value = record.price;
    element('product-name').focus();
  } else {
    element('stock-id').value = record.id;
    element('stock-product').value = record.productId;
    element('stock-quantity').value = record.quantity;
    element('stock-product').focus();
  }
  showMessage(`Editing ${resource} record ${record.id}. Change the fields and press Save.`);
}

// Delete a selected record and refresh both lists after confirmation.
async function deleteRecord(resource, id) {
  if (!confirm(`Delete ${resource} record ${id}?`)) return;
  try {
    await request(`/${resource}/${id}`, 'DELETE');
    await refresh();
    showMessage(`Deleted ${resource} record ${id}.`);
  } catch (error) { showMessage(error.message, true); }
}

// Render a collection with edit and delete controls.
function render(resource, records) {
  const body = element(resource);
  body.replaceChildren();
  for (const record of records) {
    const row = document.createElement('tr');
    const values = resource === 'products'
      ? [record.id, record.name, record.price] : [record.id, record.productId, record.quantity];
    for (const value of values) addCell(row, value);
    const actions = addCell(row, '');
    for (const label of ['Edit', 'Delete']) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.setAttribute('aria-label', `${label} ${resource} record ${record.id}`);
      button.addEventListener('click', () => label === 'Edit'
        ? editRecord(resource, record) : deleteRecord(resource, record.id));
      actions.append(button);
    }
    body.append(row);
  }
  if (!records.length) {
    const row = document.createElement('tr');
    const cell = addCell(row, 'No records yet.');
    cell.colSpan = 4;
    body.append(row);
  }
}

// Fetch fresh server state for both collections.
async function refresh() {
  const [products, stock] = await Promise.all([request('/products'), request('/stock')]);
  render('products', products);
  render('stock', stock);
}

// Send a full POST or PUT from either form and report any server validation error.
async function saveRecord(event, resource) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('[type="submit"]');
  const id = element(resource === 'products' ? 'product-id' : 'stock-id').value;
  const body = resource === 'products'
    ? { name: element('product-name').value, price: Number(element('product-price').value) }
    : { productId: Number(element('stock-product').value), quantity: Number(element('stock-quantity').value) };
  submit.disabled = true;
  try {
    const record = await request(`/${resource}${id ? `/${id}` : ''}`, id ? 'PUT' : 'POST', body);
    form.reset();
    await refresh();
    showMessage(`Saved ${resource} record ${record.id}.`);
  } catch (error) { showMessage(error.message, true); }
  finally { submit.disabled = false; }
}

// Connect controls after the deferred script has loaded the page.
function initialise() {
  element('product-form').addEventListener('submit', event => saveRecord(event, 'products'));
  element('stock-form').addEventListener('submit', event => saveRecord(event, 'stock'));
  element('clear-key').addEventListener('click', () => {
    element('admin-key').value = '';
    showMessage('Admin key cleared.');
  });
  element('refresh').addEventListener('click', () => {
    refresh().then(() => showMessage('Lists refreshed.')).catch(error => showMessage(error.message, true));
  });
  refresh().then(() => showMessage('Inventory loaded.')).catch(error => showMessage(error.message, true));
}
initialise();

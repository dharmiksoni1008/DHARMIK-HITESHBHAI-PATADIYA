# Learn the project in small stages

Read the test strategy first. Predict a result, run the request, then explain why it happened. This is reference code for practice; make sure you can describe it before adapting it under your course rules.

## 1. Product service

`services/products.js` validates product fields and passes its resource name, port and validator to `lib/service.js`. The shared handler separates routes by method, gets a queued storage operation, finds a record and manually creates/replaces/deletes it. There is no CRUD package. `lib/http.js` provides small HTTP helpers; `lib/store.js` deals only with files and queuing.

Run all three server commands in README, then GET `/products` through the gateway. Trace the default sample `Notebook` back to `data/products.json`. Try `price: 0`, then `price: "0"`: JSON number and JSON string are different types. Both POST and PUT need name and price. Try an invalid update and verify the stored row is unchanged.

## 2. Stock service

`services/stock.js` uses the same HTTP operations but different rules. `Number.isSafeInteger` rejects fractional quantities, strings and unsafe integers. The shared handler checks stock duplicates inside the queue, so simultaneous creates for the same product cannot both pass.

Run stock tests after products. Create stock for product ID 777 even when no product has that ID. Explain why this succeeds under the selected policy, and why a real inventory system might require a different policy. Try duplicating that product ID and predict 409.

## 3. Gateway

Read `services/gateway.js` after the services. It maps each known resource to a fixed port; it is not an open proxy. `http.request` contacts the service with a rewritten internal header. A promise resolves when the response completes or the deadline/error path finishes. The `finished` flag prevents a timeout and later network error from sending two responses.

GET uses no admin key. Edits use `Authorization: Bearer <your admin key>`. The admin header is consumed at the gateway. The gateway key is used only server-to-server. Send a wrong internal header through 3000: the public read still works because the gateway replaces it. Send the same wrong header directly to 3001: it fails. These are separate credentials with separate purposes.

## 4. Browser

`public/index.html` declares forms and empty table bodies. `app.js` attaches event listeners, calls relative URLs, and builds table cells with `textContent`. CSS controls appearance only. The password input supplies the admin key for each edit without saving it. Edit fills fields; Save decides POST or PUT from whether ID is blank. Delete uses the record's ID and requests confirmation.

Use the forms to add, update and delete both resource types. Browser address-bar URLs perform GET; they cannot demonstrate POST/PUT/DELETE evidence. Try a name containing `<b>Notebook</b>`: the literal text must appear, without bold markup.

## 5. Validation and failure handling

An HTTP status is a short result category; the JSON error explains the specific failure. The service authenticates first, then validates route/method/body, and only then enters storage. The gateway authenticates edits before forwarding. `createServer` catches rejected request handlers so one bad request does not become an unhandled rejection.

Study `readBody`: it counts bytes and stops storing oversized input. `readJson` checks content type and catches JSON parse errors. `createStore` queues read-modify-write work, including duplicate checks. Try concurrent writes with the existing automated test. A single process queue does not protect against two processes writing the same files.

## 6. Tests

`integration.test.js` is the required repeatable check, using Node's built-in runner and real child servers. It generates credentials and temporary data, asserts status/body, and cleans up. `reset-data.js` is only for the manual cURL scratch directory. `slow-service.js` deliberately never responds: it demonstrates a timeout without unpredictable Internet failures.

Run `npm test`, then choose a few cURL cases and explain their expected results before running them. Record observed outputs. Python scripts are extra checks available in this cloud environment; they are not needed to run the application.

## 7. Explain and evaluate

Use the report outline to ask yourself: what actually worked, what failed, what changed, and what evidence proves it? Do not copy an invented first-person development story. Explain the distinction between gateway routing, access control, and JSON storage. Reproduce a request with the sequence diagram beside it.

Exercises: explain why PUT must include both fields; explain the queue in your own words; identify what happens if a product is deleted while stock remains; propose a pagination improvement without implementing it. Only make changes you understand and can test.

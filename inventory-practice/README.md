# Product Inventory Management System Using an API Gateway

A learning project for Web & Network Services: three small Node.js servers, manual CRUD, two JSON files and a plain browser page. Use this to understand and practise; follow your lecturer's AI policy before using any code in assessed work. No personal development report has been written for you.

The assignment PDF and report template were not provided. Requirements attributed to those documents in the pasted request have not been independently checked. Stock policy, built-in modules, credentials and file-queue design are implementation choices from the practice plan.

## Requirements and dependencies

- **Node.js 24.x** (tested with 24.19.0); npm is included with Node (tested 11.9.0).
- **No npm packages**, frameworks, database server, Axios, Docker or compilation needed. There is no dependency installation step or lockfile: `npm run` invokes the installed Node executable directly. Do not add dependencies just to run this project.
- Built-in runtime modules: `http` (servers/downstream calls), `fs/promises` (files), `path` (paths), `crypto` (credential comparisons). Built-in test modules: `node:test`, `assert/strict`, `os`, `child_process`, `events`, plus the runtime modules.
- Manual checks: a browser and cURL (`curl.exe` on Windows).
- Optional cloud-only checks: Python 3 and POSIX `curl` for `tests/curl-smoke.py`; Python Playwright and system Chromium for `tests/browser-smoke.py`. These are **test tools**, not application dependencies. The optional scripts use POSIX process groups and are not Windows scripts. The basic Node test suite needs none of them.

## Folder structure

```text
inventory-practice/
  package.json                 npm startup/test commands
  .env.example                 credential names, no real secrets
  data/products.json           sample products
  data/stock.json              sample stock
  lib/http.js                  JSON, auth, routing, body limits, error handling
  lib/store.js                 queued reads/writes and storage checks
  lib/service.js               small shared CRUD request handler
  scripts/start-local.js       optional three-server cloud launcher
  services/products.js         product fields and port 3001
  services/stock.js            stock fields and port 3002
  services/gateway.js          browser assets, admin check, forwarding on 3000
  public/index.html           forms, lists, credential input
  public/style.css            simple responsive layout
  public/app.js               relative fetch calls and safe text rendering
  tests/integration.test.js    actual HTTP checks with disposable data
  tests/reset-data.js          reset only .scratch/manual
  tests/slow-service.js        controlled timeout fixture
  tests/payloads/              UTF-8 JSON files for PowerShell cURL
  tests/curl-smoke.py          optional actual POSIX cURL smoke checks
  tests/browser-smoke.py       optional Chromium interaction check
  curl-tests.txt              sequential PowerShell test cases and expectations
  docs/test-strategy.md        plan written before implementation
  docs/learning-guide.md       stages, request flow and exercises
  docs/report-outline.md      outline and authentic evidence checklist
  docs/observed-results.md     measured outcomes and unverified items
  docs/architecture.mmd        architecture diagram source
  docs/sequence.mmd            sequence for a tested request
  docs/use-cases.mmd           optional use-case overview
```

## Configure and start in separate terminals

Use the existing checkout. Cloud tasks are already isolated: do not create a worktree unless explicitly requested.

1. Open a terminal **inside `inventory-practice`**. Check `node --version` shows v24.
2. Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell, `cp .env.example .env` in Bash).
3. Edit `.env` locally. Replace both example values with different private strings. `GATEWAY_SECRET` is shared by all three servers; `ADMIN_KEY` authorises gateway edits. Do not send the values in chat or put them in source control. Example placeholders are intentionally rejected at startup.
4. Open **three terminals**, each inside `inventory-practice`:

```text
Terminal 1: npm run products
Terminal 2: npm run stock
Terminal 3: npm run gateway
```

Each script loads `.env` via Node's `--env-file-if-exists` flag. Already-exported variables take precedence. Each process prints a listening message. After editing `.env`, restart all affected servers using Ctrl+C and the same commands. Start exactly one process per service.

5. On your own machine, open the gateway on port 3000 in your browser. In this cloud onboarding UI, local requests were used for checks; it does not provide a public browser preview.
6. Public lists need no key. Enter your `ADMIN_KEY` in the password field to edit. The key stays in that field; there is no login, cookie, browser storage or saved key. Clear it or reload when finished. Use Edit to fill a form, change values, and press Save. A blank ID means add; an ID means replace an existing record. Deletes ask for confirmation.
7. For a read with PowerShell: `curl.exe -i http://127.0.0.1:3000/products`. For edit tests follow `curl-tests.txt`: it prompts securely for the configured admin key and sends `Authorization: Bearer ...` from a terminal variable.

For learning, keep the three terminals so failures are visible. Ctrl+C stops the server in that terminal. An optional cloud convenience command, `npm run dev`, runs all three as child processes and stops them together. It reads `.env` the same way; missing keys are generated privately in memory. Without your own configured admin key, public reads work but you cannot enter the hidden generated key into the browser. Set your own ADMIN_KEY and restart for interactive edits. Do not run this launcher alongside the separate servers.

## API and data rules

| Resource | Collection | Individual | Fields required for POST and PUT |
| --- | --- | --- | --- |
| Products | GET/POST `/products` | GET/PUT/DELETE `/products/:id` | `name`: trimmed non-empty string; `price`: finite number ≥ 0 |
| Stock | GET/POST `/stock` | GET/PUT/DELETE `/stock/:id` | `productId`: positive safe integer; `quantity`: non-negative safe integer |

PUT is a **full replacement of the editable fields**, not a partial patch. Both fields are required. The server keeps the ID. Extra input fields, including a submitted `id`, are ignored. IDs are positive safe integers generated as largest existing ID + 1. Deleting the largest ID permits reuse; an empty dataset begins at 1. IDs are unique among current records, not permanent historical identifiers. Product names may repeat. Query strings do not filter results. Exact paths have no trailing slash.

There is at most one stock record per `productId`; POST or PUT conflicts return 409. Stock does not call the product service to verify references. Product deletion succeeds and leaves stock unchanged. Delete that stock explicitly if appropriate. This is an intentionally weak consistency policy, suitable for demonstrating why independent services need carefully chosen boundaries. It has no distributed transactions.

Success: GET and PUT 200, POST 201 with relative Location header, DELETE 200 with `{"message":"Record deleted."}`. Empty lists are `[]` with 200. Service status codes and JSON bodies are preserved by the gateway, including validation/storage errors.

Errors use `{"error":"description"}`:

| Status | Meaning |
| --- | --- |
| 400 | malformed JSON, wrong fields/types or invalid ID |
| 401 | missing/incorrect admin credential, or direct service access without internal credential |
| 404 | unknown route or nonexistent record |
| 405 | unsupported method; response includes Allow |
| 409 | duplicate stock product reference or exhausted ID range |
| 413 | request body over **8192 bytes (8 KiB)** |
| 415 | POST/PUT must use `Content-Type: application/json` (charset allowed) |
| 500 | unreadable, missing, corrupted or unwritable storage; data is not automatically reset |
| 502 | stopped/unreachable/interrupted service, or response exceeds 1 MiB |
| 504 | downstream deadline exceeded (default 2000 ms) |

The gateway checks route, method, admin key and body size before forwarding, so unauthenticated malformed writes return 401 first. The service parses JSON and validates fields. Validation can happen before checking whether an item exists; nonexistent-ID PUT tests therefore use valid fields.

## Access controls and request flow

```text
Browser / cURL → gateway :3000 → products :3001 → products.json
                             ↘ stock :3002    → stock.json
```

A normal request goes only to 3000. The gateway recognises the path, checks the admin Bearer key for POST/PUT/DELETE, reads a bounded body and forwards method, original path/query, content type, Accept and body to a fixed loopback port. It forwards the response status/body, content type, Location and Allow. It recalculates content length and deliberately omits client Authorization, cookies, Host and other unrelated headers.

Clients cannot choose a downstream host. An allowlist of forwarded headers strips any incoming `X-Gateway-Secret`; the gateway sets its own value. Services compare that value with `GATEWAY_SECRET` before routing. Neither credential is returned in responses or embedded in browser assets.

This is **application-level access control for a local prototype**, not network isolation. A caller who knows the service key can access the services. Someone who controls the host can read process configuration and files. All servers bind loopback; requests are plain local HTTP. There is no user management, TLS, rate limiting, credential rotation or audit trail. Do not deploy it as a public service without redesigning these controls.

## JSON storage and failure recovery

Every operation enters one promise queue **within its own service process**. A mutation reads the latest array, checks/changes it, writes a complete `.tmp` file with exclusive creation, then renames it over the old file. Concurrent requests in that one process cannot both overwrite a stale read. Atomic replacement avoids a partially rewritten main file on ordinary write failure. A rejected operation releases the queue for the next request.

The file must exist and contain a valid array with valid records and unique IDs (and unique product references in stock). Reads never replace bad data with `[]`. A failed write returns 500 and leaves the main file intact; an incomplete `.tmp` file may remain. Stop the service, back up both files, inspect/fix the cause, and remove the stale temporary file only after checking it. Restore corrupted data from a known good backup; restarting cannot repair it.

Limitations: no cross-process file locking; run only one process per service. Whole-file reads/writes grow with dataset size. There is no query engine, indexing, multi-record transaction across services, crash-safe journal or fsync guarantee against power loss. Gateway responses are capped at 1 MiB. A timeout or lost connection can happen after a write succeeds: check the list before retrying POST. JSON documents are a storage format here, **not a complete NoSQL database management system**.

`DATA_DIR` optionally chooses a directory for both files (relative to the terminal directory, or absolute). It must already contain valid `products.json` and `stock.json`. Default storage is the project's `data/`, independent of current working directory. `GATEWAY_TIMEOUT_MS` accepts 1–30000; default 2000. No external service credentials or Internet destinations are required.

## Testing and evidence

Plan: `docs/test-strategy.md`. First stop your manually started servers so ports 3000–3002 are free, then:

```text
npm test
```

The suite starts its own processes, generates private credentials in memory and creates temporary data outside the sample directory. It validates real HTTP behavior, restarts, failures and overlapping writes, then stops only its own servers and removes its test files. It does not use your `.env` or change sample data.

For Windows cURL tests, follow `curl-tests.txt` from the beginning: reset disposable `.scratch/manual`, select it in all server terminals, and run the sequential cases. Payloads avoid JSON quoting problems with `curl.exe`. The guide contains expected outcomes, not claimed Windows execution results.

Optional cloud checks (with their extra tools already installed):

```text
python tests/curl-smoke.py
python tests/browser-smoke.py
```

See `docs/observed-results.md` for actual results. No screenshots or personal experiences have been fabricated. Capture your own browser CRUD and terminal evidence using `docs/report-outline.md`.

## Troubleshooting

- Missing/example secret: edit `.env`; restart. If exported variables override it, clear or correct those variables in each terminal.
- `EADDRINUSE`: stop the previous process in its terminal. Never kill unrelated processes just to free a port.
- 401 on browser edits: enter the same admin key as gateway configuration. A direct service 401 is expected.
- 502: start the corresponding service; inspect its terminal for startup errors.
- 504: check downstream responsiveness and configured deadline. The slow fixture is only for tests.
- 500: inspect file validity, permissions, disk space and `.tmp` files. Back up before repair. Do not reset real inventory as a workaround.
- Browser lists appear stale: Refresh lists; inspect the visible error. If one list fails to load, refresh fails rather than showing partial results.
- Oversized data response: reduce disposable data or plan pagination in a separate improvement task.
- Cloud sandbox returns `EPERM` on server startup: local process/loopback permission is required; it is not a validation failure in the application.

## ZIP-ready handoff

Include source, sample data, `.env.example`, docs and test payloads. Exclude `.env`, `.scratch`, `node_modules`, logs, archives and Python `__pycache__`. Keep your original work and any required acknowledgement consistent with course policy. A ZIP can be made using an explicit file list or an allowlist-based archive script; inspect its contents before sharing. Nothing in this folder needs to contain a real secret.

# Observed checks

Run date: 31 October 2026. Linux cloud environment; Node.js v24.19.0, npm 11.9.0. Disposable data and test-generated credentials; sample data was not modified. These are observed checks, distinct from the expected outcomes in `curl-tests.txt`.

| Check executed | Observed outcome |
| --- | --- |
| `npm test` | 39 tests passed, 0 failed, 0 skipped. Runner counts 38 subtests plus their parent test. |
| `python tests/curl-smoke.py` | 22 actual POSIX cURL requests passed: both resources' CRUD, field validation, missing admin, direct service rejection, 404, stopped downstream 502 and slow downstream 504. |
| `python tests/browser-smoke.py` | Passed in installed Chromium: both resources' create/update/delete, visible 401 feedback, literal rendering of HTML-looking product name, key clearing and 390px viewport without page overflow. |
| `npm run dev` | Passed local cURL readiness checks for both exact sample datasets with private in-memory credentials; launcher and children then stopped. |
| npm startup scripts | Actual `npm run products`, `npm run stock`, `npm run gateway` launched and served functional requests in the browser check. |

The HTTP suite exercised empty data, collection/item endpoints, zero values, invalid fields and JSON, missing fields for full PUT, invalid/nonexistent IDs, content type, exact 8192-byte limit and excess, method/route errors, admin checks on all mutations, internal-header replacement, direct service rejection, duplicate stock creation/update, dangling references, product deletion with stock, 12 overlapping writes, persistence across both service restarts, bad/missing files, failed temporary writes, 502 recovery and bounded 504 recovery. See the assertions for exact coverage; this is not a claim of exhaustive correctness.

The sandbox initially denied child/server operations with EPERM. Running the checks with the required local execution permission passed. The first browser-check attempt used a string predicate blocked by the application's Content Security Policy; the test was corrected to use a function predicate without weakening that policy, then passed.

Not executed: the full 117-case Windows PowerShell sequence; Windows filesystem behavior; manual student screenshots; report-template/PDF review; publication and fresh-task snapshot restoration. The optional Python checks rely on tools already present here and do not establish their availability on Windows.

The initial sandboxed GitHub read failed while connecting to the configured proxy. A read-only retry with network execution permission succeeded with no advertised HEAD/main ref (empty remote). No GitHub credential was requested or replaced. The checkout was a valid unborn branch with no source files; all project files were newly created under `inventory-practice` at the user's request. Remote access works, but there is no main commit to restore from Git. These new files need the environment snapshot or your own Git commit; no commit or push was created. Fresh-task snapshot restoration has not been verified.

Limitations remain intentional: weak product reference consistency, local shared credentials, whole-file storage, no cross-process locking, no production deployment/security, and no claim of power-loss durability. No screenshot or first-person report was fabricated.

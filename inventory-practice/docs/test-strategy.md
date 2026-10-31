# Test strategy (written before implementation)

Use Node's built-in test runner and actual HTTP requests to disposable servers with disposable JSON files. Use cURL separately to demonstrate the HTTP interface. All ordinary requests go to gateway port 3000. Only access-control tests contact 3001 and 3002 directly.

Required: exercise collection and individual GET, POST, PUT, DELETE for both resources; verify status and body; restart services and check persistence. Validate malformed JSON, types, missing fields, whitespace names, numeric boundaries, invalid IDs, absent records, media types, 8 KiB body limit, methods, routes and authentication. Check parallel writes, empty data, damaged storage and failed writes. Stop one service for 502 and run a deliberately slow disposable service for 504. Check that failed requests do not kill the gateway.

Chosen classroom policy: stock holds a product ID as a label, without checking the product service. One stock record per product ID (409 on duplicate); deleting a product leaves its stock record available for manual cleanup. This deliberately allows dangling references and avoids cross-service coordination. Test missing product references, duplicate creation/update, and product deletion with stock explicitly. Discuss this tradeoff in the evaluation.

Browser checks: load both lists, create/update/delete both resources through the forms, inspect success/errors, enter/clear the admin key, and render HTML-looking names as text. Browser checks require a browser; HTTP checks alone do not establish these interactions work.

Use temporary directories for automated tests. The manual cURL run uses separate scratch data with a reproducible reset and sequential IDs. Record actual outputs separately from expected outcomes. Keep screenshots authentic. No PDF/template was supplied, so requirements attributed to them remain unverified.

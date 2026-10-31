# Report outline and authentic evidence checklist

This is an outline, not a completed submission or a claim about your experience. The assignment PDF and supplied report template were not attached to this task. The following layout requirements come from the pasted request and must be checked against the actual brief/template before submission. Follow your lecturer's AI policy and acknowledge assistance as required.

## Proposed assessed word allocation (approximately 1,000)

| Section | Words | Prompts for your own evidence-based writing |
| --- | --- | --- |
| Critical evaluation of application and development | 500 | Explain choices and tradeoffs; discuss actual test evidence, weaknesses and changes you personally made; assess security, file queuing, error paths, usability and maintainability. Include only authentic challenges. Support the analysis with a reference. |
| Benefits of client-server interaction using microservices | 200 | Explain browser → gateway → service with an actual request; discuss independent responsibilities and the costs of extra network hops, failures and consistency. Support with a reference. |
| NoSQL and JSON-file storage | 200 | Explain flexible JSON documents; compare full NoSQL database capabilities with this whole-file array implementation; discuss validation, indexing, concurrency, durability, scale and backups. Support with a reference. |
| Conclusion | 100 | Answer what the actual evidence shows, identify limits and prioritise a realistic improvement. Do not claim production readiness. |

Use the provided template for abstract and introduction without silently expanding the assessed word count. Confirm how those template sections count with the lecturer. The pasted requirements exclude tables, figures, diagrams, references and appendices from the approximate 1,000 words; verify this against the PDF.

In the final word processor layout, use justified paragraphs and check the requested 5 ± 2 lines per paragraph after font size/margins are set. Markdown cannot guarantee line counts or justification. Export using the supplied template to PDF and check the exported pages, captions, references and diagrams for clipping.

## Evidence to collect yourself

- [ ] Record Node version, date of your run and selected disposable dataset. Never screenshot credential values or `.env`.
- [ ] Capture the three server startup terminals with the service names/ports visible.
- [ ] Run positive cURL tests showing collection and individual GET plus successful POST/PUT/DELETE for both resources. Show HTTP status and body, not just a command.
- [ ] Capture boundary values (price 0, quantity 0), persistence after stopping/restarting services, and empty collections.
- [ ] Capture representative negative tests: missing/wrong admin, both direct service rejections, validation errors, duplicate stock conflict, stopped service 502 and controlled 504.
- [ ] Show a subsequent successful request after each failure to demonstrate recovery. Record expected versus observed results by test ID.
- [ ] Use the browser **forms** for browser CRUD evidence. Capture before/after state and the success or error message. A URL typed in the address bar demonstrates GET only.
- [ ] Confirm HTML-looking names display as text. Clear the admin key before screenshots where possible.
- [ ] Capture your test summary and preserve actual logs. Do not claim every manual PowerShell case passed from the Node test summary.
- [ ] Use an architecture diagram and a sequence diagram for a request you actually ran. Sources are supplied; check them against your final implementation. A use-case overview is optional and does not replace either required diagram.
- [ ] Add captions that explain request, expected outcome, observed outcome and significance. Redact only confidential values and label redactions.

The pasted request says the PDF requires screenshots **side-by-side with captions**, while lecturer notes say stacked. Default to the written brief pending clarification, and check the actual document. No submission date was established; obtain it from the official course channel. Do not invent one.

Do not manufacture screenshots or personal experience. The automated browser check collected no screenshot files; you need your own evidence. The JSON sample and test data are practice data, not real inventory.

## Suggested real sources to consult

These are source suggestions, not a fabricated bibliography of sources you have read. Open the sources, verify the claims you use, apply your required citation style, and record your own access dates. No live web verification was performed during this task.

- Martin Fowler and James Lewis (2014), **Microservices**, https://martinfowler.com/articles/microservices.html — useful for service boundaries, independent components and the tradeoffs of distributed systems. Supports the microservices discussion.
- Martin Kleppmann (2017), **Designing Data-Intensive Applications**, O'Reilly Media — consult the actual book for reliability, storage and consistency tradeoffs. Use it to support critical evaluation; cite the relevant chapter you actually read, without inventing page numbers.
- Pramod J. Sadalage and Martin Fowler (2012), **NoSQL Distilled: A Brief Guide to the Emerging World of Polyglot Persistence**, Addison-Wesley — consult for NoSQL models and consistency; distinguish those DBMS capabilities from this JSON-file project.
- Node.js documentation, **File system**, https://nodejs.org/docs/latest-v24.x/api/fs.html — check the file-write and concurrent-operation guidance when explaining the local queue and its limitations.

Each of evaluation, microservices and NoSQL discussions needs at least one supporting reference according to the pasted requirements. Explain how the reference supports your argument rather than attaching a citation to an unsupported claim.

## Suggested appendix content

API table, environment setup without secrets, selected cURL transcript, expected/observed matrix, diagrams and a short file map. Use the report template to decide placement. Do not fill the appendix with fabricated results or copied first-person narratives.

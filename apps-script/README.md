# Contact form Apps Script backend

This web app accepts the static CV site's native `application/x-www-form-urlencoded` form POST. It validates Cloudflare Turnstile server-side, stores the submission in a Google Sheet, and sends a notification email. The browser receives a small HTML success or failure page; the endpoint is not called with AJAX and does not require CORS.

## Deployment configuration

Create one standalone Apps Script project, add `Code.gs` and `appsscript.json`, then set these Script Properties:

- `TURNSTILE_SECRET`: Cloudflare Turnstile secret key.
- `SPREADSHEET_ID`: ID of the private spreadsheet that receives messages.
- `NOTIFY_EMAIL`: fixed recipient address for notifications.
- `SITE_URL`: fixed HTTPS URL for the public CV site and return link.
- `ALLOWED_HOSTNAME`: exact hostname configured for the Turnstile widget.

Run `setup()` once after authorizing the project. It creates the `Messages` tab when needed and initializes its headers without overwriting a non-empty first row. Then deploy a versioned web app that executes as the owner and permits public submissions. Use the deployed `/exec` URL as the form action.

The script stores a bounded request-ID ledger in Script Properties: entries expire after 24 hours and the ledger is capped at 100 IDs. This is a bounded deduplication window, not a promise of indefinite or universal 24-hour deduplication. A valid request ID is saved before email delivery, so a notification failure cannot lose the Sheet row. Reusing the same request ID is treated as a duplicate after Turnstile verification. A replayed or expired Turnstile token can therefore be rejected before the saved request ID is checked. The spreadsheet status column records `SAVED`, `MAIL_SENT`, or `MAIL_FAILED` when the status update is available.

The backend also enforces a durable cap of 50 accepted new submissions per script-timezone day and a best-effort limit of three accepted submissions per normalized email address per hour. Rejected honeypot, field-validation, Turnstile, duplicate, cap, and throttle requests do not send email or append rows. The daily cap is durable under the script lock; the per-email cache throttle is intentionally best-effort.

Runtime requires a tab named `Messages` with the exact headers written by `setup()`. `setup()` is the only path that creates the tab. Requests fail closed if the tab or schema is missing or changed; runtime never falls back to the first sheet.

Keep the spreadsheet private. Never put `TURNSTILE_SECRET`, `SPREADSHEET_ID`, or the notification address in the public frontend. The endpoint validates field lengths, email syntax, UUID request IDs, the honeypot, Turnstile success/action/hostname, and formula-like leading characters before writing values to Sheets.

## Local tests

From the project directory:

```sh
node --test tests/contact-backend.test.mjs
```

The test suite evaluates `Code.gs` in Node's `vm` with mocked Apps Script services. It does not access Google accounts, deploy the script, write a real Sheet, or send email.

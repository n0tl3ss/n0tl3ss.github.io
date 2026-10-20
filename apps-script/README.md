# Contact form Apps Script backend

This web app accepts the static CV site's native `application/x-www-form-urlencoded` form POST. It validates a Google Cloud Fraud Defense reCAPTCHA checkbox token with a server-side `CreateAssessment` call, stores the submission in a private Google Sheet, and sends a notification email. The browser receives a small HTML success or failure page; the endpoint is not called with AJAX and does not require CORS.

## Deployment configuration

Create one standalone Apps Script project, add `Code.gs` and `appsscript.json`, then set these Script Properties:

- `RECAPTCHA_API_KEY`: Google Cloud API key restricted to the reCAPTCHA Enterprise API. Keep it server-only.
- `RECAPTCHA_PROJECT_ID`: Google Cloud project ID that owns the reCAPTCHA key.
- `RECAPTCHA_SITE_KEY`: Google Cloud Fraud Defense Web checkbox key ID. Keep the same value on the server even though the frontend site key is public.
- `SPREADSHEET_ID`: ID of the private spreadsheet that receives messages.
- `NOTIFY_EMAIL`: fixed recipient address for notifications, normally `n0t_l3ss@outlook.com`.
- `SITE_URL`: fixed HTTPS URL for the public CV site and return link.
- `ALLOWED_HOSTNAME`: exact hostname returned by reCAPTCHA, initially `n0tl3ss.github.io`.

Create a Google Cloud Fraud Defense Web checkbox key for the website and allow exactly these website domains: `n0tl3ss.github.io` and `nmikic.rs` (add `www.nmikic.rs` too if that hostname will serve the site). Keep domain verification enabled. The site key is public; the API key belongs only in Script Properties. For the API key, choose API restrictions → Restrict key → reCAPTCHA Enterprise API (`recaptchaenterprise.googleapis.com`), and leave application restrictions unset: Apps Script calls Google server-to-server and has no browser HTTP referrer to authorize. Google creates or enables the required Cloud project and APIs when creating a key through the Fraud Defense console. The first 10,000 assessments per organization per calendar month are free; billing is required to continue beyond that limit.

Run `setup()` once after setting the properties and authorizing the project. It creates the `Messages` tab when needed and initializes its exact headers without overwriting a non-empty first row. Then deploy a versioned web app that executes as the owner and permits public submissions. Record the public URL in the form `https://script.google.com/macros/s/DEPLOYMENT_ID/exec` and use that `/exec` URL as the form action; `/dev` is editor-only and is not a production endpoint. The `/exec` URL and public reCAPTCHA site key are the only backend values the static site needs.

The backend sends the submitted token to the reCAPTCHA Enterprise `CreateAssessment` endpoint with `x-goog-api-key`. It fails closed unless the assessment reports a valid token and the exact configured hostname. Checkbox validity is the acceptance gate; no undocumented score threshold is applied to reject real users. Google tokens are single-use and expire after two minutes, so a replayed or expired token can fail before the saved request ID is checked.

The script stores a bounded request-ID ledger in Script Properties: entries expire after 24 hours and the ledger is capped at 100 IDs. This is a bounded deduplication window, not a promise of indefinite or universal 24-hour deduplication. A valid request ID is saved before email delivery, so a notification failure cannot lose the Sheet row. The spreadsheet status column records `SAVED`, `MAIL_SENT`, or `MAIL_FAILED` when the status update is available.

The backend also enforces a durable cap of 50 accepted new submissions per script-timezone day and a best-effort limit of three accepted submissions per normalized email address per hour. Rejected honeypot, field-validation, reCAPTCHA, duplicate, cap, and throttle requests do not send email or append rows. The daily cap is durable under the script lock; the per-email cache throttle is intentionally best-effort.

The accepted-submission cap does not limit reCAPTCHA assessment traffic from rejected requests, so it is not a guarantee that usage will remain below Google's free assessment allowance under abuse.

Runtime requires a tab named `Messages` with the exact headers written by `setup()`. `setup()` is the only path that creates the tab. Requests fail closed if the tab or schema is missing or changed; runtime never falls back to the first sheet.

Keep the spreadsheet private. The notification address may also be visible in the site's public mail link, but `NOTIFY_EMAIL` remains a fixed server-controlled recipient and the form never accepts a visitor-supplied recipient. Never put `RECAPTCHA_API_KEY` or `SPREADSHEET_ID` in the public frontend. The endpoint validates field lengths, email syntax, UUID request IDs, the honeypot, reCAPTCHA validity/hostname, and formula-like leading characters before writing values to Sheets.

## Diagnostics and code updates

For a live `Unable to send` response, run `diagnoseSetup()` from the editor after saving the current source. It validates configuration syntax and reads the Sheet schema without contacting reCAPTCHA, adding rows or sending email. `CONFIG_AND_SHEET_OK` confirms only those checks; it does not validate API credentials or CAPTCHA verification. Do not use a fabricated token to diagnose API configuration: its rejection is ambiguous. Deploy the saved code as a new version of the existing web app, then submit the real form with a fresh CAPTCHA token and inspect the latest `doPost` execution. Failure logs contain only the stage and a controlled diagnostic code, never raw provider errors, credentials, tokens or message contents. See the [Serbian troubleshooting steps](../deployment/CONTACT-SR.md#ako-odgovor-glasi-unable-to-send).

To apply code changes to the existing public `/exec` URL, edit its deployment under **Deploy → Manage deployments**, choose a **New version**, and deploy. Saving the source alone does not change the published version. Script Properties remain server-side; `NOTIFY_EMAIL` also controls the public response page's direct-email link.

## Local tests

From the project directory:

```sh
node --test tests/contact-backend.test.mjs
```

The test suite evaluates `Code.gs` in Node's `vm` with mocked Apps Script services. It does not access Google accounts, deploy the script, write a real Sheet, or send email.

## Official setup references

- [Create reCAPTCHA keys for websites](https://docs.cloud.google.com/recaptcha/docs/create-key-website)
- [Install checkbox keys](https://docs.cloud.google.com/recaptcha/docs/instrument-web-pages-with-checkbox)
- [Create assessments for websites](https://docs.cloud.google.com/recaptcha/docs/create-assessment-website)
- [Billing information](https://docs.cloud.google.com/recaptcha/docs/billing-information)
- [API key best practices](https://cloud.google.com/docs/authentication/api-keys-best-practices)
- [Google Apps Script web apps](https://developers.google.com/apps-script/guides/web)

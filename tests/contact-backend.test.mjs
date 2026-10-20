import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const codePath = path.resolve(new URL('../apps-script/Code.gs', import.meta.url).pathname);
const code = fs.readFileSync(codePath, 'utf8');
const requestId = '550e8400-e29b-41d4-a716-446655440000';

function createHarness(options = {}) {
  const properties = new Map(Object.entries({
    RECAPTCHA_API_KEY: 'recaptcha-api-key',
    RECAPTCHA_PROJECT_ID: 'project-id',
    RECAPTCHA_SITE_KEY: 'recaptcha-site-key',
    SPREADSHEET_ID: 'sheet-id',
    NOTIFY_EMAIL: 'owner@example.com',
    SITE_URL: 'https://example.com/cv',
    ALLOWED_HOSTNAME: 'example.com',
    ...(options.properties || {}),
  }));
  const rows = [];
  const defaultHeaders = [
    'timestamp',
    'request_id',
    'name',
    'email',
    'company',
    'message',
    'recaptcha_hostname',
    'notification_status',
  ];
  const messagesExists = options.messagesExists !== false;
  const headers = options.headers || (messagesExists ? defaultHeaders : ['', '', '', '', '', '', '', '']);
  const sentEmails = [];
  const fetches = [];
  const statusUpdates = [];
  const response = options.recaptchaResponse || {
    tokenProperties: {
      valid: true,
      hostname: 'example.com',
    },
    riskAnalysis: { score: 0.9 },
  };
  const sheet = {
    getLastRow() {
      return rows.length + 1;
    },
    appendRow(row) {
      rows.push([...row]);
      return this;
    },
    getRange(row, column, rowCount, columnCount) {
      return {
        getValues() {
          if (row === 1 && column === 1 && rowCount === 1 && columnCount === 8) {
            return [headers];
          }
          return [['']];
        },
        setValues(values) {
          if (row === 1 && column === 1 && rowCount === 1 && columnCount === 8) {
            headers.splice(0, headers.length, ...values[0]);
          }
          return this;
        },
        setValue(value) {
          statusUpdates.push({ row, column, value });
          if (rows[row - 2]) rows[row - 2][column - 1] = value;
          return this;
        },
      };
    },
  };
  const lock = {
    waitLock() {},
    releaseLock() {},
  };
  const cache = new Map();
  const htmlOutputs = [];
  const logs = [];
  const sandbox = {
    console: {
      error(value) { logs.push(String(value)); },
      log(value) { logs.push(String(value)); },
    },
    Date,
    JSON,
    String,
    Object,
    Array,
    RegExp,
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) {
            return properties.has(key) ? properties.get(key) : null;
          },
          setProperty(key, value) {
            properties.set(key, String(value));
          },
        };
      },
    },
    SpreadsheetApp: {
      openById(id) {
        assert.equal(id, 'sheet-id');
        return {
          getSheets: () => messagesExists ? [sheet] : [],
          getSheetByName: (name) => name === 'Messages' && messagesExists ? sheet : null,
          insertSheet: (name) => {
            assert.equal(name, 'Messages');
            return sheet;
          },
        };
      },
    },
    LockService: {
      getScriptLock() {
        return lock;
      },
    },
    CacheService: {
      getScriptCache() {
        return {
          get(key) { return cache.get(key) || null; },
          put(key, value) { cache.set(key, value); },
        };
      },
    },
    Session: {
      getScriptTimeZone() { return 'Europe/Belgrade'; },
    },
    Utilities: {
      formatDate(date) { return date.toISOString().slice(0, 10); },
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      computeDigest(algorithm, value) {
        assert.equal(algorithm, 'SHA_256');
        const bytes = [];
        for (let index = 0; index < value.length; index += 1) {
          bytes.push(value.charCodeAt(index) & 0xff);
        }
        return bytes;
      },
    },
    UrlFetchApp: {
      fetch(url, request) {
        fetches.push({ url, request });
        if (options.fetchError) throw new Error(String(options.fetchError));
        return {
          getResponseCode() { return options.recaptchaStatus || 200; },
          getContentText() { return JSON.stringify(response); },
        };
      },
    },
    MailApp: {
      sendEmail(to, subject, body, mailOptions) {
        if (options.mailError) throw new Error('mail failed');
        sentEmails.push({ to, subject, body, mailOptions });
      },
    },
    HtmlService: {
      createHtmlOutput(html) {
        const output = {
          html,
          title: null,
          setTitle(title) {
            this.title = title;
            htmlOutputs.push(this);
            return this;
          },
        };
        return output;
      },
    },
  };

  vm.runInNewContext(code, sandbox, { filename: codePath });

  return {
    sandbox,
    properties,
    rows,
    sentEmails,
    fetches,
    statusUpdates,
    htmlOutputs,
    logs,
    headers,
    post(fields = {}) {
      return sandbox.doPost({
        parameter: {
          name: 'Nemanja',
          email: 'nemanja@example.com',
          company: 'Example Co',
          message: 'Hello from the contact form.',
          fax_number: '',
          request_id: requestId,
          'g-recaptcha-response': 'valid-token',
          ...fields,
        },
      });
    },
  };
}

function html(result) {
  assert.ok(result && typeof result.html === 'string');
  return result.html;
}

test('accepts a valid submission, saves it, and sends only to configured recipient', () => {
  const harness = createHarness();
  const result = harness.post();

  assert.match(html(result), /message was received/);
  assert.equal(harness.rows.length, 1);
  assert.equal(harness.rows[0][2], 'Nemanja');
  assert.equal(harness.rows[0].length, 8);
  assert.equal(harness.rows[0][6], 'example.com');
  assert.equal(harness.rows[0][7], 'MAIL_SENT');
  assert.equal(harness.sentEmails.length, 1);
  assert.equal(harness.sentEmails[0].to, 'owner@example.com');
  assert.equal(harness.sentEmails[0].mailOptions.replyTo, 'nemanja@example.com');
  assert.equal(harness.fetches[0].url, 'https://recaptchaenterprise.googleapis.com/v1/projects/project-id/assessments');
  assert.equal(harness.fetches[0].request.headers['x-goog-api-key'], 'recaptcha-api-key');
  assert.deepEqual(JSON.parse(harness.fetches[0].request.payload), {
    event: { token: 'valid-token', siteKey: 'recaptcha-site-key' },
  });
  assert.match(html(result), /background:#f7f6f0/);
  assert.match(html(result), /color:#182d29/);
  assert.match(html(result), /Georgia,serif/);
  assert.match(html(result), /Return to the website/);
  assert.match(html(result), /mailto:owner%40example\.com/);
});

test('fails closed when reCAPTCHA validity or hostname is wrong', () => {
  for (const recaptchaResponse of [
    { tokenProperties: { valid: true, hostname: 'attacker.example' } },
    { tokenProperties: { valid: false, hostname: 'example.com' } },
    { tokenProperties: { valid: true } },
  ]) {
    const harness = createHarness({ recaptchaResponse });
    const result = harness.post();
    assert.match(html(result), /could not submit/);
    assert.equal(harness.rows.length, 0);
    assert.equal(harness.sentEmails.length, 0);
  }
});

test('rejects honeypot, malformed UUID, missing fields, and oversized content', () => {
  const cases = [
    { fax_number: 'bot' },
    { request_id: 'not-a-uuid' },
    { message: '' },
    { message: '123456789' },
    { 'g-recaptcha-response': '' },
    { 'g-recaptcha-response': 'x'.repeat(16385) },
    { message: 'x'.repeat(5001) },
  ];
  for (const fields of cases) {
    const harness = createHarness();
    const result = harness.post(fields);
    assert.match(html(result), /could not submit/);
    assert.equal(harness.rows.length, 0);
    assert.equal(harness.sentEmails.length, 0);
  }
});

test('deduplicates the same request ID without a second row or email', () => {
  const harness = createHarness();
  const first = harness.post();
  const second = harness.post();

  assert.match(html(first), /message was received/);
  assert.match(html(second), /already received/);
  assert.equal(harness.rows.length, 1);
  assert.equal(harness.sentEmails.length, 1);
});

test('escapes formula-like values before writing to Sheets and never reflects them in HTML', () => {
  const harness = createHarness();
  const result = harness.post({
    name: '=HYPERLINK("https://attacker.example","click")',
    company: '@IMPORT("https://attacker.example")',
    message: '+CMD|/C calc!A0',
  });

  assert.equal(harness.rows.length, 1);
  assert.equal(harness.rows[0][2][0], "'");
  assert.equal(harness.rows[0][4][0], "'");
  assert.equal(harness.rows[0][5][0], "'");
  assert.doesNotMatch(html(result), /attacker\.example/);
});

test('keeps the saved message when email delivery fails', () => {
  const harness = createHarness({ mailError: true });
  const result = harness.post();

  assert.match(html(result), /message was saved/);
  assert.equal(harness.rows.length, 1);
  assert.equal(harness.rows[0][7], 'MAIL_FAILED');
  assert.equal(harness.sentEmails.length, 0);
});

test('enforces the best-effort three-per-hour email throttle without sending the fourth', () => {
  const harness = createHarness();
  for (let index = 0; index < 4; index += 1) {
    const result = harness.post({
      request_id: `550e8400-e29b-41d4-a716-44665544000${index + 1}`,
    });
    if (index < 3) assert.match(html(result), /message was received/);
    else assert.match(html(result), /try again later/);
  }

  assert.equal(harness.rows.length, 3);
  assert.equal(harness.sentEmails.length, 3);
});

test('enforces the durable daily accepted-submission cap before saving or mailing', () => {
  const today = new Date().toISOString().slice(0, 10);
  const harness = createHarness({
    properties: {
      DAILY_ACCEPTED_STATE: JSON.stringify({ date: today, count: 50 }),
    },
  });
  const result = harness.post();

  assert.match(html(result), /try again later/);
  assert.equal(harness.rows.length, 0);
  assert.equal(harness.sentEmails.length, 0);
});

test('fails closed when Messages is missing or its headers are changed', () => {
  const missing = createHarness({ messagesExists: false });
  assert.match(html(missing.post()), /could not submit/);
  assert.equal(missing.rows.length, 0);
  assert.equal(missing.sentEmails.length, 0);

  const wrongSchema = createHarness({ headers: ['wrong', 'schema'] });
  assert.match(html(wrongSchema.post()), /could not submit/);
  assert.equal(wrongSchema.rows.length, 0);
  assert.equal(wrongSchema.sentEmails.length, 0);
});

test('fails closed when reCAPTCHA configuration is incomplete', () => {
  for (const properties of [
    { RECAPTCHA_API_KEY: '' },
    { RECAPTCHA_PROJECT_ID: 'bad' },
    { RECAPTCHA_SITE_KEY: 'short' },
  ]) {
    const harness = createHarness({ properties });
    assert.match(html(harness.post()), /could not submit/);
    assert.equal(harness.fetches.length, 0);
    assert.equal(harness.rows.length, 0);
    assert.equal(harness.sentEmails.length, 0);
  }
});

test('rejects provider network failures and replayed reCAPTCHA tokens', () => {
  const networkFailure = createHarness({ fetchError: true });
  assert.match(html(networkFailure.post()), /could not submit/);
  assert.equal(networkFailure.rows.length, 0);
  assert.equal(networkFailure.sentEmails.length, 0);

  const replay = createHarness({
    recaptchaResponse: {
      tokenProperties: {
        valid: false,
        hostname: 'example.com',
        invalidReason: 'TOKEN_ALREADY_USED',
      },
    },
  });
  assert.match(html(replay.post()), /could not submit/);
  assert.equal(replay.rows.length, 0);
  assert.equal(replay.sentEmails.length, 0);
});

test('logs private diagnostic codes without exposing provider errors or form data', () => {
  const cases = [
    [{ recaptchaStatus: 403 }, 'RECAPTCHA_HTTP_403'],
    [{ recaptchaResponse: { tokenProperties: { valid: false, invalidReason: 'KEY_MISMATCH' } } }, 'RECAPTCHA_TOKEN_KEY_MISMATCH'],
    [{ recaptchaResponse: { tokenProperties: { valid: true, hostname: 'other.example' } } }, 'RECAPTCHA_HOSTNAME_MISMATCH'],
    [{ recaptchaResponse: { tokenProperties: { valid: false, invalidReason: 'recaptcha-api-key valid-token visitor@example.com' } } }, 'RECAPTCHA_TOKEN_INVALID'],
    [{ fetchError: 'recaptcha-api-key valid-token visitor@example.com private message' }, 'SERVICE_ERROR'],
  ];
  for (const [options, code] of cases) {
    const harness = createHarness(options);
    const result = harness.post({ email: 'visitor@example.com', message: 'private message' });
    assert.deepEqual(JSON.parse(harness.logs[0]), { event: 'contact_failure', stage: 'recaptcha', code });
    assert.doesNotMatch(harness.logs.join('\n'), /recaptcha-api-key|valid-token|visitor@example\.com|private message/);
    assert.doesNotMatch(html(result), /RECAPTCHA_|SERVICE_ERROR/);
    assert.equal(harness.rows.length, 0);
    assert.equal(harness.sentEmails.length, 0);
  }
});

test('setup diagnostic checks API access and sheet schema without saving or sending', () => {
  const harness = createHarness({ recaptchaResponse: { tokenProperties: { valid: false, invalidReason: 'MALFORMED' } } });
  harness.sandbox.diagnoseSetup();
  assert.deepEqual(JSON.parse(harness.logs[0]), { event: 'contact_diagnostic', code: 'SHEET_AND_RECAPTCHA_API_REACHABLE' });
  assert.equal(JSON.parse(harness.fetches[0].request.payload).event.token, 'setup-diagnostic-invalid-token');
  assert.equal(harness.rows.length, 0);
  assert.equal(harness.sentEmails.length, 0);
});

test('reports known Google API rejection reasons without logging the response body', () => {
  for (const [reason, suffix] of [
    ['API_KEY_INVALID', '_API_KEY_INVALID'],
    ['SERVICE_DISABLED', '_SERVICE_DISABLED'],
    ['API_KEY_SERVICE_BLOCKED', '_API_KEY_SERVICE_BLOCKED'],
    ['recaptcha-api-key valid-token visitor@example.com', ''],
  ]) {
    const harness = createHarness({
      recaptchaStatus: 400,
      recaptchaResponse: { error: {
        message: 'recaptcha-api-key valid-token visitor@example.com private message',
        details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason }],
      } },
    });
    harness.sandbox.diagnoseSetup();
    assert.deepEqual(JSON.parse(harness.logs[0]), {
      event: 'contact_failure', stage: 'setup_recaptcha', code: 'RECAPTCHA_HTTP_400' + suffix,
    });
    assert.doesNotMatch(harness.logs.join('\n'), /recaptcha-api-key|valid-token|visitor@example\.com|private message/);
    assert.equal(harness.rows.length, 0);
    assert.equal(harness.sentEmails.length, 0);
  }
});

test('setup diagnostic distinguishes missing sheets from rejected API requests', () => {
  for (const [options, stage, code] of [
    [{ messagesExists: false }, 'setup_storage', 'SHEET_MISSING'],
    [{ recaptchaStatus: 403 }, 'setup_recaptcha', 'RECAPTCHA_HTTP_403'],
    [{ recaptchaResponse: { tokenProperties: { valid: false, invalidReason: 'KEY_MISMATCH' } } }, 'setup_recaptcha', 'RECAPTCHA_TOKEN_KEY_MISMATCH'],
    [{}, 'setup_recaptcha', 'DIAGNOSTIC_UNEXPECTED_RESPONSE'],
    [{ properties: { RECAPTCHA_API_KEY: '' } }, 'setup_configuration', 'CONFIG_INVALID'],
  ]) {
    const harness = createHarness(options);
    harness.sandbox.diagnoseSetup();
    assert.deepEqual(JSON.parse(harness.logs[0]), { event: 'contact_failure', stage, code });
    assert.equal(harness.rows.length, 0);
    assert.equal(harness.sentEmails.length, 0);
  }
});

test('validation failures record only a diagnostic code and never call Google', () => {
  for (const [fields, code] of [
    [{ fax_number: 'private value' }, 'HONEYPOT_FILLED'],
    [{ 'g-recaptcha-response': '' }, 'REQUIRED_FIELD_MISSING'],
    [{ request_id: 'private value' }, 'REQUEST_ID_INVALID'],
  ]) {
    const harness = createHarness();
    assert.match(html(harness.post(fields)), /could not submit/);
    assert.deepEqual(JSON.parse(harness.logs[0]), { event: 'contact_failure', stage: 'validation', code });
    assert.equal(harness.fetches.length, 0);
    assert.doesNotMatch(harness.logs.join('\n'), /private value/);
  }
});

test('setup creates Messages only when absent and writes the exact headers', () => {
  const harness = createHarness({ messagesExists: false });
  assert.match(harness.sandbox.setup(), /headers are ready/);
  assert.deepEqual(harness.headers, [
    'timestamp',
    'request_id',
    'name',
    'email',
    'company',
    'message',
    'recaptcha_hostname',
    'notification_status',
  ]);
});

test('does not expose or trust a client-controlled recipient or return URL', () => {
  const harness = createHarness();
  const result = harness.post({
    email: 'visitor@example.com',
    notifyEmail: 'attacker@example.com',
    siteUrl: 'javascript:alert(1)',
  });

  assert.equal(harness.sentEmails[0].to, 'owner@example.com');
  assert.doesNotMatch(html(result), /javascript:/i);
  assert.doesNotMatch(html(result), /attacker@example.com/);
});

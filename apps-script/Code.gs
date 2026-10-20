const RECENT_REQUESTS_KEY = 'RECENT_REQUESTS';
const RECENT_REQUEST_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RECENT_REQUESTS = 100;
const DAILY_ACCEPTED_LIMIT = 50;
const DAILY_ACCEPTED_STATE_KEY = 'DAILY_ACCEPTED_STATE';
const EMAIL_THROTTLE_LIMIT = 3;
const EMAIL_THROTTLE_TTL_SECONDS = 60 * 60;
const MESSAGES_SHEET_NAME = 'Messages';
const MAX_TOKEN_LENGTH = 16384;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_COMPANY_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 5000;
const MAX_HONEYPOT_LENGTH = 128;
const MAX_REQUEST_ID_LENGTH = 64;
const STATUS_COLUMN = 8;
const HEADERS = [
  'timestamp',
  'request_id',
  'name',
  'email',
  'company',
  'message',
  'recaptcha_hostname',
  'notification_status',
];

function doPost(e) {
  try {
    const config = getConfig();
    const form = parseForm(e);

    if (form.faxNumber !== '') {
      return renderStatus('failure', config);
    }

    validateForm(form);
    const recaptcha = verifyRecaptcha(form.recaptchaResponse, config);
    const result = saveSubmission(form, recaptcha.hostname, config);

    if (result.duplicate) {
      return renderStatus('duplicate', config);
    }
    if (result.rejected) {
      return renderStatus('limited', config);
    }
    return renderStatus(result.mailSent ? 'success' : 'saved', config);
  } catch (error) {
    // Do not expose validation, configuration, or provider errors to the public.
    return renderStatus('failure', safeConfigForResponse());
  }
}

function doGet() {
  return HtmlService.createHtmlOutput(
    '<!doctype html><html><head><meta charset="utf-8"><title>Contact</title></head>' +
    '<body><p>This endpoint accepts contact form submissions.</p></body></html>',
  );
}

function setup() {
  const config = getConfig();
  const spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  let sheet = spreadsheet.getSheetByName(MESSAGES_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(MESSAGES_SHEET_NAME);
  }
  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const isEmpty = firstRow.every(function (value) {
    return String(value || '').trim() === '';
  });

  if (isEmpty) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  } else if (!headersMatch(firstRow)) {
    throw new Error('Messages sheet headers do not match the expected schema.');
  }
  return 'Contact sheet headers are ready.';
}

function getConfig() {
  const properties = PropertiesService.getScriptProperties();
  const config = {
    recaptchaApiKey: properties.getProperty('RECAPTCHA_API_KEY') || '',
    recaptchaProjectId: properties.getProperty('RECAPTCHA_PROJECT_ID') || '',
    recaptchaSiteKey: properties.getProperty('RECAPTCHA_SITE_KEY') || '',
    spreadsheetId: properties.getProperty('SPREADSHEET_ID') || '',
    notifyEmail: properties.getProperty('NOTIFY_EMAIL') || '',
    siteUrl: properties.getProperty('SITE_URL') || '',
    allowedHostname: properties.getProperty('ALLOWED_HOSTNAME') || '',
  };

  if (!config.recaptchaApiKey || !isProjectId(config.recaptchaProjectId) ||
      !isSiteKey(config.recaptchaSiteKey) || !config.spreadsheetId ||
      !isEmail(config.notifyEmail) || !isHttpsUrl(config.siteUrl) ||
      !isHostname(config.allowedHostname)) {
    throw new Error('Contact form configuration is incomplete.');
  }
  return config;
}

function safeConfigForResponse() {
  let siteUrl = 'https://example.invalid/';
  let notifyEmail = '';
  try {
    const properties = PropertiesService.getScriptProperties();
    const configured = properties.getProperty('SITE_URL') || '';
    const configuredEmail = properties.getProperty('NOTIFY_EMAIL') || '';
    if (isHttpsUrl(configured)) {
      siteUrl = configured;
    }
    if (isEmail(configuredEmail)) {
      notifyEmail = configuredEmail;
    }
  } catch (ignored) {
    // Keep a fixed safe fallback if configuration cannot be read.
  }
  return { siteUrl: siteUrl, notifyEmail: notifyEmail };
}

function parseForm(e) {
  const parameters = e && e.parameter ? e.parameter : {};
  return {
    name: readField(parameters, 'name', MAX_NAME_LENGTH),
    email: readField(parameters, 'email', MAX_EMAIL_LENGTH),
    company: readField(parameters, 'company', MAX_COMPANY_LENGTH),
    message: readField(parameters, 'message', MAX_MESSAGE_LENGTH),
    faxNumber: readField(parameters, 'fax_number', MAX_HONEYPOT_LENGTH),
    requestId: readField(parameters, 'request_id', MAX_REQUEST_ID_LENGTH),
    recaptchaResponse: readField(parameters, 'g-recaptcha-response', MAX_TOKEN_LENGTH),
  };
}

function readField(parameters, name, maxLength) {
  const value = typeof parameters[name] === 'string' ? parameters[name] : '';
  const normalized = value.replace(/\u0000/g, '').trim();
  if (normalized.length > maxLength) {
    throw new Error('Field is too long.');
  }
  return normalized;
}

function validateForm(form) {
  if (!form.name || !form.email || !form.message || !form.requestId ||
      !form.recaptchaResponse) {
    throw new Error('Required field is missing.');
  }
  if (form.message.length < 10) {
    throw new Error('Message is too short.');
  }
  if (!isEmail(form.email)) {
    throw new Error('Email is invalid.');
  }
  if (!isUuid(form.requestId)) {
    throw new Error('Request ID is invalid.');
  }
}

function verifyRecaptcha(token, config) {
  if (!token || token.length > MAX_TOKEN_LENGTH) {
    throw new Error('reCAPTCHA token is invalid.');
  }

  const response = UrlFetchApp.fetch(
    'https://recaptchaenterprise.googleapis.com/v1/projects/' +
      encodeURIComponent(config.recaptchaProjectId) + '/assessments',
    {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-goog-api-key': config.recaptchaApiKey,
      },
      payload: JSON.stringify({
        event: {
          token: token,
          siteKey: config.recaptchaSiteKey,
        },
      }),
      muteHttpExceptions: true,
    },
  );

  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('reCAPTCHA verification request failed.');
  }

  const result = JSON.parse(response.getContentText());
  const tokenProperties = result.tokenProperties || {};
  if (tokenProperties.valid !== true ||
      tokenProperties.hostname !== config.allowedHostname) {
    throw new Error('reCAPTCHA verification failed.');
  }

  // Checkbox validity is the gate; do not invent a score threshold that can reject real users.
  return { hostname: tokenProperties.hostname };
}

function isProjectId(value) {
  return typeof value === 'string' &&
    /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(value);
}

function isSiteKey(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{10,100}$/.test(value);
}

function saveSubmission(form, recaptchaHostname, config) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);

  let sheet;
  let rowNumber;
  let dailySlotReserved = false;
  let dailyKey;
  let rowSaved = false;
  try {
    const recent = readRecentRequests();
    if (Object.prototype.hasOwnProperty.call(recent, form.requestId)) {
      return { duplicate: true, mailSent: true };
    }

    dailyKey = todayKey();
    if (!reserveDailySlot(dailyKey)) {
      return { rejected: 'daily-cap' };
    }
    dailySlotReserved = true;

    const throttle = readEmailThrottle(form.email);
    if (throttle >= EMAIL_THROTTLE_LIMIT) {
      releaseDailySlot(dailyKey);
      dailySlotReserved = false;
      return { rejected: 'email-rate' };
    }

    sheet = getSheet(config);
    rowNumber = sheet.getLastRow() + 1;
    sheet.appendRow([
      new Date().toISOString(),
      safeSheetValue(form.requestId),
      safeSheetValue(form.name),
      safeSheetValue(form.email),
      safeSheetValue(form.company),
      safeSheetValue(form.message),
      safeSheetValue(recaptchaHostname),
      'SAVED',
    ]);
    rowSaved = true;

    recent[form.requestId] = Date.now();
    try {
      writeRecentRequests(recent);
    } catch (ignored) {
      // The row and durable daily cap are already committed; continue safely.
    }
    writeEmailThrottle(form.email, throttle + 1);
  } finally {
    if (dailySlotReserved && !rowSaved) {
      releaseDailySlot(dailyKey);
    }
    lock.releaseLock();
  }

  let mailSent = false;
  try {
    sendNotification(form, config);
    mailSent = true;
    setRowStatus(sheet, rowNumber, 'MAIL_SENT');
  } catch (error) {
    // The row is already persisted. Record the notification failure when possible.
    setRowStatus(sheet, rowNumber, 'MAIL_FAILED');
  }

  return { duplicate: false, mailSent: mailSent };
}

function sendNotification(form, config) {
  const body = [
    'New contact form message',
    '',
    'Name: ' + form.name,
    'Email: ' + form.email,
    'Company: ' + (form.company || '(not provided)'),
    '',
    form.message,
  ].join('\n');

  MailApp.sendEmail(config.notifyEmail, 'New CV website contact message', body, {
    name: 'CV website',
    replyTo: form.email,
  });
}

function getSheet(config) {
  const spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  const sheet = spreadsheet.getSheetByName(MESSAGES_SHEET_NAME);
  if (!sheet) {
    throw new Error('Messages sheet is missing. Run setup first.');
  }
  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  if (!headersMatch(firstRow)) {
    throw new Error('Messages sheet headers do not match the expected schema.');
  }
  return sheet;
}

function headersMatch(firstRow) {
  return HEADERS.every(function (header, index) {
    return String(firstRow[index] || '').trim() === header;
  });
}

function setRowStatus(sheet, rowNumber, status) {
  try {
    sheet.getRange(rowNumber, STATUS_COLUMN).setValue(status);
  } catch (ignored) {
    // A failed status update must never turn a saved message into a failed save.
  }
}

function readRecentRequests() {
  const properties = PropertiesService.getScriptProperties();
  let recent = {};
  try {
    const raw = properties.getProperty(RECENT_REQUESTS_KEY);
    recent = raw ? JSON.parse(raw) : {};
  } catch (ignored) {
    recent = {};
  }

  const cutoff = Date.now() - RECENT_REQUEST_TTL_MS;
  Object.keys(recent).forEach(function (requestId) {
    if (typeof recent[requestId] !== 'number' || recent[requestId] < cutoff) {
      delete recent[requestId];
    }
  });

  const ids = Object.keys(recent).sort(function (left, right) {
    return recent[right] - recent[left];
  });
  ids.slice(MAX_RECENT_REQUESTS).forEach(function (requestId) {
    delete recent[requestId];
  });
  return recent;
}

function writeRecentRequests(recent) {
  PropertiesService.getScriptProperties().setProperty(
    RECENT_REQUESTS_KEY,
    JSON.stringify(recent),
  );
}

function todayKey() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function reserveDailySlot(dateKey) {
  const properties = PropertiesService.getScriptProperties();
  let state = { date: dateKey, count: 0 };
  try {
    const raw = properties.getProperty(DAILY_ACCEPTED_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.date === dateKey && Number.isFinite(parsed.count)) {
        state = { date: dateKey, count: Math.max(0, Math.floor(parsed.count)) };
      }
    }
  } catch (ignored) {
    state = { date: dateKey, count: 0 };
  }

  if (state.count >= DAILY_ACCEPTED_LIMIT) {
    return false;
  }
  state.count += 1;
  properties.setProperty(DAILY_ACCEPTED_STATE_KEY, JSON.stringify(state));
  return true;
}

function releaseDailySlot(dateKey) {
  const properties = PropertiesService.getScriptProperties();
  try {
    const raw = properties.getProperty(DAILY_ACCEPTED_STATE_KEY);
    const state = raw ? JSON.parse(raw) : null;
    if (state && state.date === dateKey && Number.isFinite(state.count)) {
      state.count = Math.max(0, Math.floor(state.count) - 1);
      properties.setProperty(DAILY_ACCEPTED_STATE_KEY, JSON.stringify(state));
    }
  } catch (ignored) {
    // A failed rollback cannot erase a saved message or expose an error publicly.
  }
}

function readEmailThrottle(email) {
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get(emailThrottleKey(email));
    const count = cached === null ? 0 : Number(cached);
    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  } catch (ignored) {
    // Cache is best-effort; the durable daily cap still applies.
    return 0;
  }
}

function writeEmailThrottle(email, count) {
  try {
    CacheService.getScriptCache().put(
      emailThrottleKey(email),
      String(count),
      EMAIL_THROTTLE_TTL_SECONDS,
    );
  } catch (ignored) {
    // Cache is best-effort and must not turn a saved message into a failed save.
  }
}

function emailThrottleKey(email) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    email.toLowerCase(),
  );
  const hex = digest.map(function (byte) {
    const unsigned = byte < 0 ? byte + 256 : byte;
    return ('0' + unsigned.toString(16)).slice(-2);
  }).join('');
  return 'CONTACT_EMAIL_' + hex;
}

function safeSheetValue(value) {
  const text = String(value);
  // Apps Script's appendRow treats formula-like leading characters as formulas.
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function renderStatus(status, config) {
  const messages = {
    success: { heading: 'Message received', detail: 'Thanks — your message was received.' },
    duplicate: { heading: 'Already received', detail: 'This message was already received.' },
    saved: { heading: 'Message saved', detail: 'Your message was saved. Please try again later if you do not hear back.' },
    limited: { heading: 'Please try again later', detail: 'The form is temporarily unavailable. Please try again later.' },
    failure: { heading: 'Unable to send', detail: 'We could not submit your message. Please try again later.' },
  };
  const copy = messages[status] || messages.failure;
  const returnUrl = escapeHtml(config && config.siteUrl ? config.siteUrl : 'https://example.invalid/');
  const notifyEmail = config && isEmail(config.notifyEmail || '') ? config.notifyEmail : '';
  const mailto = notifyEmail ? 'mailto:' + encodeURIComponent(notifyEmail) : '';
  const mailtoLink = mailto
    ? '<p><a href="' + escapeHtml(mailto) + '">Email directly</a></p>'
    : '';
  const html = '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + escapeHtml(copy.heading) + '</title>' +
    '<style>body{margin:0;background:#f7f6f0;color:#182d29;font-family:system-ui,-apple-system,sans-serif}' +
    'main{max-width:36rem;margin:12vh auto;padding:2rem}h1{color:#124c43;font:2.2rem Georgia,serif}' +
    'a{color:#124c43;font-weight:650}</style></head><body>' +
    '<main><h1>' + escapeHtml(copy.heading) + '</h1>' +
    '<p>' + escapeHtml(copy.detail) + '</p>' +
    '<p><a href="' + returnUrl + '" target="_top">Return to the website</a></p>' +
    mailtoLink +
    '</main></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle('Contact');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function (character) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[character];
  });
}

function isEmail(value) {
  return typeof value === 'string' && value.length <= MAX_EMAIL_LENGTH &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isUuid(value) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isHostname(value) {
  return typeof value === 'string' && value.length <= 253 &&
    /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(value);
}

function isHttpsUrl(value) {
  return typeof value === 'string' &&
    /^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d+)?(?:\/[^\s<>]*)?$/i.test(value);
}

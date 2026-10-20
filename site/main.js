const form = document.querySelector('#contact-form');
const button = document.querySelector('#send-message');
const status = document.querySelector('#form-status');
const config = window.CONTACT_CONFIG || {};
let widgetId;
let challengeToken = '';
let renderGeneration = 0;

document.querySelector('#year').textContent = String(new Date().getFullYear());

function message(text, state = '') {
  status.textContent = text;
  status.dataset.state = state;
}

function configured() {
  return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(config.endpoint || '')
    && /^[A-Za-z0-9_-]{10,100}$/.test(config.recaptchaSiteKey || '');
}

function setChallengeToken(token) {
  challengeToken = typeof token === 'string' ? token : '';
}

function requireChallenge(text) {
  challengeToken = '';
  button.disabled = true;
  message(text);
}

function recaptchaSize() {
  return typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 344px)').matches ? 'compact' : 'normal';
}

function renderRecaptcha() {
  if (!window.grecaptcha || !window.grecaptcha.enterprise) {
    requireChallenge('The spam check could not load. Please retry or use the email link.');
    return;
  }
  const container = document.querySelector('#recaptcha-container');
  if (!container) return;
  const generation = ++renderGeneration;
  if (widgetId !== undefined) window.grecaptcha.enterprise.reset(widgetId);
  const widgetHost = document.createElement('div');
  if (typeof container.replaceChildren === 'function') container.replaceChildren(widgetHost);
  widgetId = window.grecaptcha.enterprise.render(widgetHost, {
    sitekey: config.recaptchaSiteKey,
    theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
    size: recaptchaSize(),
    callback(token) {
      if (generation !== renderGeneration) return;
      setChallengeToken(token);
      button.disabled = false;
      message('Spam check complete. Your message is ready to send.');
    },
    'expired-callback'() {
      if (generation !== renderGeneration) return;
      requireChallenge('The spam check expired. Please complete it again.');
      window.grecaptcha.enterprise.reset(widgetId);
    },
    'error-callback'() {
      if (generation !== renderGeneration) return;
      requireChallenge('The spam check could not load. Please retry or use the email link.');
    },
  });
}

if (configured()) {
  form.action = config.endpoint;
  document.querySelector('#request-id').value = crypto.randomUUID();
  message('Loading the spam check…');

  window.onRecaptchaReady = renderRecaptcha;
  const script = document.createElement('script');
  script.src = 'https://www.google.com/recaptcha/enterprise.js?onload=onRecaptchaReady&render=explicit';
  script.async = true;
  script.defer = true;
  script.onerror = () => requireChallenge('The spam check could not load. Please use the email link.');
  document.head.append(script);
}

form.addEventListener('submit', (event) => {
  if (!configured()) {
    event.preventDefault();
    message('The contact form is currently unavailable. Please use the email link to get in touch.');
    return;
  }
  if (!challengeToken) {
    event.preventDefault();
    requireChallenge('Please complete the spam check before sending.');
    return;
  }
  button.disabled = true;
  message('Sending your message…');
  // Native form navigation lets Apps Script confirm receipt without a CORS proxy.
});

window.addEventListener('pageshow', (event) => {
  if (event.persisted && configured() && window.grecaptcha && window.grecaptcha.enterprise && widgetId !== undefined) {
    document.querySelector('#request-id').value = crypto.randomUUID();
    requireChallenge('Please complete the spam check to send another message.');
    window.grecaptcha.enterprise.reset(widgetId);
  }
});

window.addEventListener('themechange', () => {
  if (widgetId === undefined || !window.grecaptcha || !window.grecaptcha.enterprise) return;
  requireChallenge('Please complete the spam check before sending.');
  renderRecaptcha();
});

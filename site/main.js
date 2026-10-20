const form = document.querySelector('#contact-form');
const button = document.querySelector('#send-message');
const status = document.querySelector('#form-status');
const config = window.CONTACT_CONFIG || {};
let widgetId;
let challengeToken = '';

document.querySelector('#year').textContent = String(new Date().getFullYear());

function message(text, state = '') {
  status.textContent = text;
  status.dataset.state = state;
}

function configured() {
  return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(config.endpoint || '')
    && /^[A-Za-z0-9_-]{10,100}$/.test(config.turnstileSiteKey || '');
}

function requireChallenge(text) {
  challengeToken = '';
  button.disabled = true;
  message(text);
}

if (configured()) {
  form.action = config.endpoint;
  document.querySelector('#request-id').value = crypto.randomUUID();
  message('Loading the spam check…');

  window.onTurnstileReady = () => {
    widgetId = window.turnstile.render('#turnstile-container', {
      sitekey: config.turnstileSiteKey,
      action: 'contact',
      theme: 'light',
      size: 'flexible',
      callback(token) {
        challengeToken = token;
        button.disabled = false;
        message('Spam check complete. Your message is ready to send.');
      },
      'expired-callback'() {
        requireChallenge('The spam check expired. Please complete it again.');
        window.turnstile.reset(widgetId);
      },
      'error-callback'() {
        requireChallenge('The spam check could not load. Please retry or use the email link.');
      }
    });
  };
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileReady&render=explicit';
  script.async = true;
  script.defer = true;
  script.onerror = () => requireChallenge('The spam check could not load. Please use the email link.');
  document.head.append(script);
}

form.addEventListener('submit', (event) => {
  if (!configured()) {
    event.preventDefault();
    message('This preview does not send messages. You can reach me by email.');
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
  if (event.persisted && configured() && window.turnstile && widgetId !== undefined) {
    document.querySelector('#request-id').value = crypto.randomUUID();
    requireChallenge('Please complete the spam check to send another message.');
    window.turnstile.reset(widgetId);
  }
});

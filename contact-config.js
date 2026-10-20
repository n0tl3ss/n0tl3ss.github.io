// Public configuration only. Keep the Turnstile SECRET in Apps Script properties.
// Empty values intentionally keep this review build from sending messages.
window.CONTACT_CONFIG = Object.freeze({
  endpoint: "",
  turnstileSiteKey: ""
});

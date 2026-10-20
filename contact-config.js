// Public configuration only. Keep the Turnstile SECRET in Apps Script properties.
// Empty values keep the form disabled until the live services are connected.
window.CONTACT_CONFIG = Object.freeze({
  endpoint: "",
  turnstileSiteKey: ""
});

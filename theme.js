(() => {
  const root = document.documentElement;
  let theme = 'light';
  try {
    if (localStorage.getItem('cv-theme') === 'dark') theme = 'dark';
  } catch { /* Theme switching also works when browser storage is unavailable. */ }

  function applyTheme() {
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').setAttribute('content', theme === 'dark' ? '#111c19' : '#f7f6f0');
  }
  // Apply before the stylesheet loads to avoid a flash of the other theme.
  applyTheme();

  document.addEventListener('DOMContentLoaded', () => {
    const button = document.querySelector('#theme-toggle');
    const label = document.querySelector('#theme-label');
    function updateButton() {
      label.textContent = theme === 'dark' ? 'Light' : 'Dark';
      button.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
    }
    updateButton();
    button.hidden = false;
    button.addEventListener('click', () => {
      theme = theme === 'dark' ? 'light' : 'dark';
      applyTheme();
      updateButton();
      try { localStorage.setItem('cv-theme', theme); } catch { /* Keep the current page usable. */ }
      window.dispatchEvent(new Event('themechange'));
    });
    window.addEventListener('pageshow', (event) => {
      if (!event.persisted) return;
      try {
        const saved = localStorage.getItem('cv-theme') === 'dark' ? 'dark' : 'light';
        if (saved === theme) return;
        theme = saved;
      } catch { return; }
      applyTheme();
      updateButton();
      window.dispatchEvent(new Event('themechange'));
    });
  });
})();

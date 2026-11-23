/* RetroPet — Live search */

(function() {
  'use strict';

  const searchInput = document.querySelector('.header__search-input');
  if (!searchInput) return;

  let debounceTimer;

  searchInput.addEventListener('input', function() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const q = this.value.trim();
      if (q.length >= 2) {
        window.location.href = '/search?q=' + encodeURIComponent(q);
      }
    }, 500);
  });
})();

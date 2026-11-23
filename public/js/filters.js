/* RetroPet — Client-side filters (dynamic game filtering) */

(function() {
  'use strict';

  const filterForm = document.querySelector('.filters__form');
  if (!filterForm) return;

  filterForm.querySelectorAll('select, input').forEach(el => {
    el.addEventListener('change', function() {
      filterForm.submit();
    });
  });
})();

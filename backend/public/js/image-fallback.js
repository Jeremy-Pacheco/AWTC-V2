/**
 * Image fallbacks for the EJS dashboard.
 *
 * Replaces the former inline onerror="..." attributes, which the
 * Content-Security-Policy blocks (script-src-attr 'none'). Loaded in <head>
 * so the capture listener exists before any image can fail, including
 * images inserted later with innerHTML.
 *
 * <img data-fallback="hide">                   hides the image
 * <img data-fallback="next">                   hides it and shows the next sibling
 * <img data-fallback="initial" data-initial="A"> replaces the parent's content with a letter
 * <img data-fallback="icon">                   replaces the parent's content with the logo icon
 */
document.addEventListener('error', function (event) {
  var img = event.target;
  if (!img || img.tagName !== 'IMG' || !img.dataset || !img.dataset.fallback) return;

  var mode = img.dataset.fallback;
  img.removeAttribute('data-fallback'); // run once, even if the fallback fails too
  var parent = img.parentElement;

  if (mode === 'next') {
    img.style.display = 'none';
    if (img.nextElementSibling) img.nextElementSibling.style.display = 'flex';
  } else if (mode === 'initial') {
    if (parent) parent.textContent = img.dataset.initial || '';
  } else if (mode === 'icon') {
    if (parent) {
      var icon = document.createElement('i');
      icon.className = 'fas fa-hands-helping';
      icon.style.color = 'var(--accent)';
      icon.style.fontSize = '24px';
      parent.replaceChildren(icon);
    }
  } else {
    img.style.display = 'none';
  }
}, true);

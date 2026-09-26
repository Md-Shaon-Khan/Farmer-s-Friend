// Shared behavior across all pages.
// Currently just marks the page as loaded so the hero's CSS reveal
// animation (see .hero-text / .hero-art in style.css) can be reused
// on other pages later if needed. No framework, no build step.

document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('is-loaded');
});
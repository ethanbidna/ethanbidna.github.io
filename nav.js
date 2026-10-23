/* The navbar turns see-through once the page scrolls. */
(function () {
  var bar = document.querySelector(".topbar");
  if (!bar) return;
  function update() { bar.classList.toggle("scrolled", (window.pageYOffset || document.documentElement.scrollTop) > 8); }
  addEventListener("scroll", update, { passive: true });
  update();
})();

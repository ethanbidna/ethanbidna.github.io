/* The navbar turns see-through once the page scrolls, and the assistant's links hide while the assistant is switched off. */
(function () {
  var bar = document.querySelector(".topbar");
  if (bar) {
    var update = function () { bar.classList.toggle("scrolled", (window.pageYOffset || document.documentElement.scrollTop) > 8); };
    addEventListener("scroll", update, { passive: true });
    update();
  }
  try {
    fetch("/api/status", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (s) { if (s && s.chat === false) document.documentElement.classList.add("chat-off"); })
      .catch(function () {});
  } catch (e) {}
})();

/* EU Withdrawal — open the proxy form in a modal popup. No dependencies. */
(function () {
  function modal() {
    return document.querySelector("[data-eu-wd-modal]");
  }

  function open() {
    var m = modal();
    if (!m) return;
    var frame = m.querySelector(".eu-wd-frame");
    if (frame && !frame.getAttribute("src")) {
      frame.setAttribute("src", frame.getAttribute("data-src"));
    }
    m.hidden = false;
    document.documentElement.style.overflow = "hidden";
  }

  function close() {
    var m = modal();
    if (!m) return;
    m.hidden = true;
    document.documentElement.style.overflow = "";
  }

  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-eu-wd-open]")) {
      e.preventDefault();
      open();
    } else if (e.target.closest("[data-eu-wd-close]")) {
      close();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") close();
  });
})();

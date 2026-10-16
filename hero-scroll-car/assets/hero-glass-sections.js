/* Hero glass sections — before/after slider (drag, keyboard) and reviews carousel arrows. */
(function () {
  'use strict';

  function setupCompare(frame) {
    if (frame.hscReady) return;
    frame.hscReady = true;
    var range = frame.querySelector('[data-hgs-range]');
    var set = function (value) {
      var v = Math.max(0, Math.min(100, value));
      frame.style.setProperty('--hgs-cut', v + '%');
      if (range) { range.value = String(Math.round(v)); range.setAttribute('aria-valuenow', String(Math.round(v))); }
    };
    if (range) {
      set(parseFloat(range.value) || 50);
      range.addEventListener('input', function () { set(parseFloat(range.value) || 0); });
    }
    var dragging = false;
    var fromEvent = function (event) {
      var rect = frame.getBoundingClientRect();
      if (!rect.width) return;
      set(((event.clientX - rect.left) / rect.width) * 100);
    };
    frame.addEventListener('pointerdown', function (event) {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      dragging = true;
      try { frame.setPointerCapture(event.pointerId); } catch (error) { /* ignore */ }
      fromEvent(event);
    });
    frame.addEventListener('pointermove', function (event) { if (dragging) fromEvent(event); });
    var stop = function () { dragging = false; };
    frame.addEventListener('pointerup', stop);
    frame.addEventListener('pointercancel', stop);
    frame.addEventListener('lostpointercapture', stop);
  }

  function setupReviews(root) {
    if (root.hscReady) return;
    root.hscReady = true;
    var track = root.querySelector('[data-hgs-track]');
    if (!track) return;
    var step = function (dir) {
      var card = track.querySelector('.hgs-review');
      var width = card ? card.getBoundingClientRect().width + 14 : track.clientWidth;
      track.scrollBy({ left: dir * width, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    };
    var prev = root.querySelector('[data-hgs-prev]');
    var next = root.querySelector('[data-hgs-next]');
    if (prev) prev.addEventListener('click', function () { step(-1); });
    if (next) next.addEventListener('click', function () { step(1); });
  }

  function init(scope) {
    var frames = (scope || document).querySelectorAll('[data-hgs-compare]');
    for (var i = 0; i < frames.length; i++) setupCompare(frames[i]);
    var reviews = (scope || document).querySelectorAll('[data-hgs-reviews]');
    for (var j = 0; j < reviews.length; j++) setupReviews(reviews[j]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(); });
  else init();
  document.addEventListener('shopify:section:load', function (event) { init(event.target); });
})();

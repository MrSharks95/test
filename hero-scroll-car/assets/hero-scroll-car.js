/*
 * Hero Scroll Car — ignition hero video + scroll-driven image sequence.
 * Vanilla JS, no dependencies. Loaded only by sections/hero-scroll-car.liquid.
 *
 * Structure:
 *   <hero-scroll-car data-mode="static|scroll">   custom element, one per section instance
 *     [data-hsc-hero]      video + audio + sound button + overlay texts
 *     [data-hsc-sequence]  tall scroll container, sticky stage with the <canvas>
 *     [data-hsc-static]    stacked fallback (mobile / reduced motion / no JS)
 */
(function () {
  'use strict';

  if (!('customElements' in window) || customElements.get('hero-scroll-car')) return;

  var MOBILE_QUERY = '(max-width: 767px)';
  var REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
  var DPR_CAP = 2;
  var EASE_PER_FRAME = 0.16;      // fraction of the remaining distance covered per 60 Hz frame
  var SNAP_THRESHOLD = 0.02;      // below this distance the current frame snaps to the target
  var PRIORITY_CONCURRENCY = 6;   // parallel downloads for the first batch
  var BACKGROUND_CONCURRENCY = 3; // parallel downloads for the rest
  var AUDIO_DRIFT_SECONDS = 0.25; // resync audio when it drifts further than this
  var DECODE_AHEAD = 3;           // frames decoded ahead of the current one

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function pad(number, width) {
    var str = String(number);
    while (str.length < width) str = '0' + str;
    return str;
  }

  class HeroScrollCar extends HTMLElement {}

  /* ------------------------------------------------------------------ lifecycle */

  HeroScrollCar.prototype.connectedCallback = function () {
    if (this.hscReady) return; // the theme editor can re-attach the same node
    this.hscReady = true;

    this.config = this.readConfig();
    this.mqMobile = window.matchMedia(MOBILE_QUERY);
    this.mqReduced = window.matchMedia(REDUCED_QUERY);
    this.mode = null;
    this.sequence = null;

    this.setupHero();
    this.setupCart();
    this.setupEditor();

    this.onMediaChange = this.applyMode.bind(this);
    addMediaListener(this.mqMobile, this.onMediaChange);
    addMediaListener(this.mqReduced, this.onMediaChange);
    this.applyMode();
  };

  HeroScrollCar.prototype.disconnectedCallback = function () {
    removeMediaListener(this.mqMobile, this.onMediaChange);
    removeMediaListener(this.mqReduced, this.onMediaChange);
    this.teardownSequence();
    if (this.onBlockSelect) document.removeEventListener('shopify:block:select', this.onBlockSelect);
    this.hscReady = false;
  };

  HeroScrollCar.prototype.readConfig = function () {
    var node = this.querySelector('[data-hsc-config]');
    var config = {};
    try { config = JSON.parse(node.textContent); } catch (error) { config = {}; }
    config.framesTotal = Math.max(1, parseInt(config.framesTotal, 10) || 1);
    config.stopRange = Math.max(1, parseInt(config.stopRange, 10) || 40);
    config.priorityCount = Math.max(1, parseInt(config.priorityCount, 10) || 30);
    config.stops = (config.stops || []).filter(function (stop) { return stop && stop.frame; });
    config.texts = config.texts || {};
    return config;
  };

  HeroScrollCar.prototype.isStatic = function () {
    return this.mqMobile.matches || this.mqReduced.matches;
  };

  HeroScrollCar.prototype.applyMode = function () {
    var mode = this.isStatic() ? 'static' : 'scroll';
    if (mode === this.mode) return;
    this.mode = mode;
    this.setAttribute('data-mode', mode);
    if (mode === 'scroll') this.setupSequence();
    else this.teardownSequence();
  };

  /* ------------------------------------------------------------------ part 1: hero */

  HeroScrollCar.prototype.setupHero = function () {
    var self = this;
    var hero = this.querySelector('[data-hsc-hero]');
    var video = this.querySelector('[data-hsc-video]');
    var audio = this.querySelector('[data-hsc-audio]');
    var sound = this.querySelector('[data-hsc-sound]');
    var cta = this.querySelector('[data-hsc-cta]');
    if (!hero || !video) return;

    this.hero = hero;
    this.video = video;
    this.audio = audio;
    this.soundButton = sound;
    this.soundOn = false;
    hero.classList.add('has-js');

    var revealed = false;
    var reveal = function () {
      if (revealed) return;
      revealed = true;
      hero.classList.add('is-ended');
    };
    this.revealHero = reveal;

    video.addEventListener('ended', reveal);

    if (this.mqReduced.matches) {
      // Reduced motion: no autoplay, texts visible at once; the sound button can still start video + audio.
      video.removeAttribute('autoplay');
      video.pause();
      reveal();
    } else {
      var playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(reveal); // autoplay refused (data saver, low power mode…)
      }
      // Safety nets: never leave the hero without its texts.
      // A failing <source> reports its error on the <source> element, not on the <video>.
      video.addEventListener('error', reveal);
      var sources = video.querySelectorAll('source');
      for (var i = 0; i < sources.length; i++) sources[i].addEventListener('error', reveal);
      setTimeout(function () {
        if (video.paused && !video.ended) reveal();
      }, 2000);
      setTimeout(reveal, 15000);
    }

    if (audio) {
      video.addEventListener('timeupdate', function () {
        if (!self.soundOn || audio.paused) return;
        if (Math.abs(audio.currentTime - video.currentTime) > AUDIO_DRIFT_SECONDS) {
          audio.currentTime = video.currentTime;
        }
      });
      video.addEventListener('pause', function () { audio.pause(); }); // also fired on "ended"
      video.addEventListener('play', function () {
        if (!self.soundOn) return;
        audio.currentTime = video.currentTime;
        audio.play().catch(function () {});
      });
    }

    if (sound && audio) {
      sound.addEventListener('click', function () { self.toggleSound(); });
    }

    if (cta) {
      cta.addEventListener('click', function (event) {
        var href = cta.getAttribute('href') || '';
        if (href !== '' && href !== '#') return; // real link configured in the editor
        event.preventDefault();
        self.scrollToFirstStop();
      });
    }
  };

  HeroScrollCar.prototype.toggleSound = function () {
    var video = this.video;
    var audio = this.audio;
    var button = this.soundButton;
    var texts = this.config.texts;

    if (this.soundOn) {
      this.soundOn = false;
      audio.pause();
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', texts.soundOn || '');
      button.setAttribute('title', texts.soundOn || '');
      return;
    }

    this.soundOn = true;
    button.setAttribute('aria-pressed', 'true');
    button.setAttribute('aria-label', texts.soundOff || '');
    button.setAttribute('title', texts.soundOff || '');

    var atEnd = video.ended || (video.duration > 0 && video.currentTime >= video.duration - 0.05);
    if (atEnd || video.paused) {
      // Video already finished (or never started): replay video and sound together.
      video.currentTime = 0;
      audio.currentTime = 0;
      video.play().catch(function () {});
      audio.play().catch(function () {});
    } else {
      audio.currentTime = video.currentTime;
      audio.play().catch(function () {});
    }
  };

  HeroScrollCar.prototype.scrollToFirstStop = function () {
    var behavior = this.mqReduced.matches ? 'auto' : 'smooth';
    if (this.mode === 'scroll' && this.sequence && this.config.stops.length) {
      this.scrollToFrame(this.config.stops[0].frame, behavior);
      return;
    }
    var target = this.querySelector('[data-hsc-static]') || this.querySelector('[data-hsc-sequence]');
    if (target) target.scrollIntoView({ behavior: behavior, block: 'start' });
  };

  /* ------------------------------------------------------------------ part 2: scroll sequence */

  HeroScrollCar.prototype.setupSequence = function () {
    if (this.sequence) return;
    var self = this;
    var config = this.config;
    var section = this.querySelector('[data-hsc-sequence]');
    var stage = this.querySelector('[data-hsc-stage]');
    var canvas = this.querySelector('[data-hsc-canvas]');
    if (!section || !stage || !canvas) return;

    var context = canvas.getContext('2d', { alpha: false });
    if (!context) return;

    var total = config.framesTotal;
    var match = /(\d+)(\.[a-z0-9]+)(\?[^#]*)?$/i.exec(config.firstFrameUrl || '');
    var numberWidth = match ? match[1].length : 4;

    var seq = {
      section: section,
      stage: stage,
      canvas: canvas,
      context: context,
      total: total,
      frames: new Array(total + 1),   // 1-indexed Image objects
      state: new Uint8Array(total + 1), // 0 = idle, 1 = loading, 2 = loaded, 3 = failed
      current: 1,
      target: 1,
      drawn: -1,
      rafId: 0,
      lastTime: 0,
      width: 0,
      height: 0,
      activeStop: null,
      cards: {},
      inView: true,
      destroyed: false
    };
    this.sequence = seq;

    seq.urlFor = function (index) {
      if (!match) return config.firstFrameUrl;
      return config.firstFrameUrl.replace(/(\d+)(\.[a-z0-9]+)(\?[^#]*)?$/i, function (_, digits, extension, query) {
        return pad(index, Math.max(numberWidth, String(index).length)) + extension + (query || '');
      });
    };

    // Product cards living inside the stage, keyed by block id.
    var cards = stage.querySelectorAll('[data-hsc-card]');
    for (var i = 0; i < cards.length; i++) seq.cards[cards[i].getAttribute('data-stop-id')] = cards[i];

    // Draw the poster right away so the stage is never empty, even before f_0001 arrives.
    var fallback = this.querySelector('[data-hsc-fallback]');
    if (fallback) {
      if (fallback.complete && fallback.naturalWidth) seq.poster = fallback;
      else fallback.addEventListener('load', function () { seq.poster = fallback; if (seq.drawn === -1) self.drawFrame(Math.round(seq.current)); });
    }

    this.resizeCanvas();
    seq.onResize = function () { self.resizeCanvas(); };
    window.addEventListener('resize', seq.onResize);
    if ('ResizeObserver' in window) {
      seq.resizeObserver = new ResizeObserver(seq.onResize);
      seq.resizeObserver.observe(stage);
    }

    seq.onScroll = function () { self.startLoop(); };
    window.addEventListener('scroll', seq.onScroll, { passive: true });

    if ('IntersectionObserver' in window) {
      seq.intersection = new IntersectionObserver(function (entries) {
        seq.inView = entries[0].isIntersecting;
        if (seq.inView) self.startLoop();
      }, { rootMargin: '200px 0px' });
      seq.intersection.observe(section);
    }

    this.startLoading();
    this.startLoop();
  };

  HeroScrollCar.prototype.teardownSequence = function () {
    var seq = this.sequence;
    if (!seq) return;
    seq.destroyed = true;
    if (seq.rafId) cancelAnimationFrame(seq.rafId);
    window.removeEventListener('resize', seq.onResize);
    window.removeEventListener('scroll', seq.onScroll);
    if (seq.resizeObserver) seq.resizeObserver.disconnect();
    if (seq.intersection) seq.intersection.disconnect();
    var ids = Object.keys(seq.cards);
    for (var i = 0; i < ids.length; i++) this.setCardVisible(seq.cards[ids[i]], false);
    this.sequence = null;
  };

  /* ---- loading -------------------------------------------------------- */

  HeroScrollCar.prototype.startLoading = function () {
    var self = this;
    var seq = this.sequence;
    var config = this.config;
    var priorityEnd = Math.min(seq.total, config.priorityCount);

    // Batch 1: the first frames, in order, with a higher concurrency.
    var nextPriority = 1;
    var finishedPriority = 0;
    function priorityWorker() {
      if (seq.destroyed) return;
      if (nextPriority > priorityEnd) return;
      var index = nextPriority++;
      self.loadFrame(index, true).then(function () {
        finishedPriority++;
        if (finishedPriority >= priorityEnd) startBackground();
        priorityWorker();
      });
    }
    for (var i = 0; i < PRIORITY_CONCURRENCY; i++) priorityWorker();
    if (priorityEnd >= seq.total) return;

    // Batch 2: everything else, always picking the unloaded frame closest to the target.
    var backgroundStarted = false;
    function startBackground() {
      if (backgroundStarted || seq.destroyed) return;
      backgroundStarted = true;
      var schedule = window.requestIdleCallback || function (callback) { setTimeout(callback, 50); };
      schedule(function () {
        for (var k = 0; k < BACKGROUND_CONCURRENCY; k++) backgroundWorker();
      });
    }
    function backgroundWorker() {
      if (seq.destroyed) return;
      var index = self.nextFrameToLoad();
      if (index === -1) return;
      self.loadFrame(index, false).then(backgroundWorker);
    }
    seq.wakeBackground = startBackground;
  };

  HeroScrollCar.prototype.nextFrameToLoad = function () {
    var seq = this.sequence;
    var center = Math.round(seq.target);
    var best = -1;
    var bestDistance = Infinity;
    for (var i = 1; i <= seq.total; i++) {
      if (seq.state[i] !== 0) continue;
      var distance = Math.abs(i - center);
      if (distance < bestDistance) { bestDistance = distance; best = i; }
    }
    return best;
  };

  HeroScrollCar.prototype.loadFrame = function (index, highPriority) {
    var self = this;
    var seq = this.sequence;
    return new Promise(function (resolve) {
      if (!seq || seq.destroyed || seq.state[index] !== 0) { resolve(); return; }
      seq.state[index] = 1;
      var image = new Image();
      image.decoding = 'async';
      if (highPriority && 'fetchPriority' in image) image.fetchPriority = 'high';
      image.onload = function () {
        seq.state[index] = 2;
        seq.frames[index] = image;
        var decodePromise = image.decode ? image.decode() : Promise.resolve();
        decodePromise.catch(function () {}).then(function () {
          if (seq.destroyed) { resolve(); return; }
          // Fix the picture as soon as the exact frame we are waiting for arrives.
          if (Math.round(seq.current) === index && seq.drawn !== index) self.drawFrame(index);
          resolve();
        });
      };
      image.onerror = function () {
        seq.state[index] = 3;
        resolve();
      };
      image.src = seq.urlFor(index);
    });
  };

  /* ---- drawing -------------------------------------------------------- */

  HeroScrollCar.prototype.resizeCanvas = function () {
    var seq = this.sequence;
    if (!seq) return;
    var rect = seq.stage.getBoundingClientRect();
    var width = Math.round(rect.width);
    var height = Math.round(rect.height);
    if (!width || !height) return;
    var dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    seq.width = width;
    seq.height = height;
    seq.canvas.width = Math.round(width * dpr);
    seq.canvas.height = Math.round(height * dpr);
    seq.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    seq.context.imageSmoothingEnabled = true;
    seq.context.imageSmoothingQuality = 'high';
    seq.drawn = -1;
    this.drawFrame(Math.round(seq.current));
  };

  HeroScrollCar.prototype.nearestLoaded = function (index) {
    var seq = this.sequence;
    if (seq.state[index] === 2) return seq.frames[index];
    for (var distance = 1; distance <= seq.total; distance++) {
      var lower = index - distance;
      var upper = index + distance;
      if (lower >= 1 && seq.state[lower] === 2) return seq.frames[lower];
      if (upper <= seq.total && seq.state[upper] === 2) return seq.frames[upper];
    }
    return seq.poster || null;
  };

  HeroScrollCar.prototype.drawFrame = function (index) {
    var seq = this.sequence;
    if (!seq || !seq.width || !seq.height) return;
    var exact = seq.state[index] === 2;
    var image = exact ? seq.frames[index] : this.nearestLoaded(index);
    if (!image) return;

    var imageWidth = image.naturalWidth || image.width;
    var imageHeight = image.naturalHeight || image.height;
    if (!imageWidth || !imageHeight) return;

    // "cover": keep the ratio, fill the stage, center the overflow.
    var scale = Math.max(seq.width / imageWidth, seq.height / imageHeight);
    var drawWidth = imageWidth * scale;
    var drawHeight = imageHeight * scale;
    var offsetX = (seq.width - drawWidth) / 2;
    var offsetY = (seq.height - drawHeight) / 2;
    seq.context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

    seq.drawn = exact ? index : -1;
    if (!seq.stage.classList.contains('is-ready')) seq.stage.classList.add('is-ready');

    // Decode a few frames ahead so the next draws never wait for the decoder.
    for (var ahead = 1; ahead <= DECODE_AHEAD; ahead++) {
      var next = index + (seq.target >= seq.current ? ahead : -ahead);
      if (next >= 1 && next <= seq.total && seq.state[next] === 2 && seq.frames[next].decode) {
        seq.frames[next].decode().catch(function () {});
      }
    }
  };

  /* ---- scroll loop ---------------------------------------------------- */

  HeroScrollCar.prototype.progressToFrame = function (progress) {
    return 1 + clamp(progress, 0, 1) * (this.sequence.total - 1);
  };

  HeroScrollCar.prototype.scrollRange = function () {
    var seq = this.sequence;
    var rect = seq.section.getBoundingClientRect();
    var top = rect.top + window.pageYOffset;
    var distance = Math.max(1, rect.height - window.innerHeight);
    return { top: top, distance: distance };
  };

  HeroScrollCar.prototype.scrollToFrame = function (frame, behavior) {
    var seq = this.sequence;
    if (!seq) return;
    var range = this.scrollRange();
    var progress = (clamp(frame, 1, seq.total) - 1) / Math.max(1, seq.total - 1);
    window.scrollTo({ top: Math.round(range.top + progress * range.distance), behavior: behavior || 'smooth' });
  };

  HeroScrollCar.prototype.startLoop = function () {
    var seq = this.sequence;
    if (!seq || seq.rafId || seq.destroyed) return;
    seq.lastTime = 0;
    seq.rafId = requestAnimationFrame(this.tick.bind(this));
  };

  HeroScrollCar.prototype.tick = function (now) {
    var seq = this.sequence;
    if (!seq || seq.destroyed) return;
    seq.rafId = 0;

    var range = this.scrollRange();
    var progress = (window.pageYOffset - range.top) / range.distance;
    seq.target = this.progressToFrame(progress);

    // Ease toward the target, frame-rate independent (same feel at 60 Hz and 120 Hz).
    var elapsed = seq.lastTime ? Math.min(100, now - seq.lastTime) : 16.7;
    seq.lastTime = now;
    var factor = 1 - Math.pow(1 - EASE_PER_FRAME, elapsed / 16.7);
    var distance = seq.target - seq.current;
    if (Math.abs(distance) <= SNAP_THRESHOLD) seq.current = seq.target;
    else seq.current += distance * factor;

    var index = Math.round(seq.current);
    if (index !== seq.drawn) this.drawFrame(index);
    this.updateCards(seq.current);

    // Help the background loader follow the user when it jumps far ahead.
    if (seq.wakeBackground && seq.state[index] === 0) seq.wakeBackground();

    if (seq.current !== seq.target && seq.inView) {
      seq.rafId = requestAnimationFrame(this.tick.bind(this));
    }
  };

  /* ---- product cards -------------------------------------------------- */

  HeroScrollCar.prototype.updateCards = function (frame) {
    var seq = this.sequence;
    var stops = this.config.stops;
    var range = this.config.stopRange;
    var best = null;
    var bestDistance = Infinity;
    for (var i = 0; i < stops.length; i++) {
      var distance = Math.abs(frame - stops[i].frame);
      if (distance <= range && distance < bestDistance) { best = stops[i]; bestDistance = distance; }
    }
    var bestId = best ? best.id : null;
    if (bestId === seq.activeStop) return;
    seq.activeStop = bestId;
    var ids = Object.keys(seq.cards);
    for (var k = 0; k < ids.length; k++) this.setCardVisible(seq.cards[ids[k]], ids[k] === bestId);
  };

  HeroScrollCar.prototype.setCardVisible = function (card, visible) {
    card.classList.toggle('is-visible', visible);
    card.setAttribute('aria-hidden', visible ? 'false' : 'true');
  };

  /* ------------------------------------------------------------------ cart */

  HeroScrollCar.prototype.setupCart = function () {
    var self = this;
    this.addEventListener('click', function (event) {
      var button = event.target.closest('[data-hsc-add]');
      if (!button || button.disabled || button.getAttribute('aria-busy') === 'true') return;
      event.preventDefault();
      self.addToCart(button);
    });
  };

  HeroScrollCar.prototype.addToCart = function (button) {
    var self = this;
    var config = this.config;
    var texts = config.texts;
    var variantId = parseInt(button.getAttribute('data-variant-id'), 10);
    var label = button.querySelector('[data-hsc-add-label]');
    var card = button.closest('.hsc-card');
    var message = card ? card.querySelector('[data-hsc-msg]') : null;
    var originalLabel = label ? label.textContent : '';
    if (!variantId) return;

    button.setAttribute('aria-busy', 'true');
    button.classList.add('is-loading');
    if (message) { message.textContent = ''; message.classList.remove('is-error'); }

    fetch(config.cartAddUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ items: [{ id: variantId, quantity: 1 }] })
    })
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          if (!response.ok) throw new Error(data.description || data.message || texts.error || 'Error');
          return data;
        });
      })
      .then(function () {
        button.classList.add('is-added');
        if (label) label.textContent = texts.added || originalLabel;
        setTimeout(function () {
          button.classList.remove('is-added');
          if (label) label.textContent = originalLabel;
        }, 2200);
        return self.refreshCart();
      })
      .catch(function (error) {
        if (message) {
          message.textContent = error && error.message ? error.message : (texts.error || '');
          message.classList.add('is-error');
        }
      })
      .then(function () {
        button.removeAttribute('aria-busy');
        button.classList.remove('is-loading');
      });
  };

  // Updates the theme's cart counter without depending on a specific theme:
  // generic counters, Dawn's cart icon bubble (Section Rendering API) and common custom events.
  HeroScrollCar.prototype.refreshCart = function () {
    var config = this.config;
    var cart = null;
    return fetch(config.cartUrl, { headers: { 'Accept': 'application/json' } })
      .then(function (response) { return response.ok ? response.json() : null; })
      .catch(function () { return null; })
      .then(function (data) {
        cart = data;
        if (cart && typeof cart.item_count === 'number') {
          var counters = document.querySelectorAll('[data-cart-count], .cart-count, [data-header-cart-count], .cart-count-bubble span[aria-hidden="true"]');
          for (var i = 0; i < counters.length; i++) counters[i].textContent = cart.item_count;
        }
        var bubble = document.getElementById('cart-icon-bubble');
        if (!bubble) return null;
        var root = config.rootUrl || '/';
        return fetch(root + (root.indexOf('?') === -1 ? '?' : '&') + 'sections=cart-icon-bubble', { headers: { 'Accept': 'application/json' } })
          .then(function (response) { return response.ok ? response.json() : null; })
          .then(function (sections) {
            if (sections && sections['cart-icon-bubble']) bubble.innerHTML = sections['cart-icon-bubble'];
          })
          .catch(function () {});
      })
      .then(function () {
        document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true }));
        document.dispatchEvent(new CustomEvent('cart:updated', { bubbles: true, detail: { cart: cart, source: 'hero-scroll-car' } }));
        if (typeof window.publish === 'function' && window.PUB_SUB_EVENTS && window.PUB_SUB_EVENTS.cartUpdate) {
          window.publish(window.PUB_SUB_EVENTS.cartUpdate, { source: 'hero-scroll-car', cartData: cart });
        }
      });
  };

  /* ------------------------------------------------------------------ theme editor */

  HeroScrollCar.prototype.setupEditor = function () {
    var self = this;
    if (!window.Shopify || !window.Shopify.designMode) return;
    this.onBlockSelect = function (event) {
      if (!self.contains(event.target) || !self.sequence) return;
      var card = event.target.closest('[data-stop-id]');
      if (!card) return;
      var id = card.getAttribute('data-stop-id');
      for (var i = 0; i < self.config.stops.length; i++) {
        if (self.config.stops[i].id === id) { self.scrollToFrame(self.config.stops[i].frame, 'smooth'); break; }
      }
    };
    document.addEventListener('shopify:block:select', this.onBlockSelect);
  };

  /* ------------------------------------------------------------------ helpers */

  function addMediaListener(mediaQuery, handler) {
    if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', handler);
    else if (mediaQuery.addListener) mediaQuery.addListener(handler);
  }

  function removeMediaListener(mediaQuery, handler) {
    if (!mediaQuery) return;
    if (mediaQuery.removeEventListener) mediaQuery.removeEventListener('change', handler);
    else if (mediaQuery.removeListener) mediaQuery.removeListener(handler);
  }

  customElements.define('hero-scroll-car', HeroScrollCar);
})();

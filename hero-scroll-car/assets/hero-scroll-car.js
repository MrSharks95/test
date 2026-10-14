/*
 * Hero Scroll Car — ignition hero video + scroll-driven image sequence, in ONE fixed scene.
 * Vanilla JS, no dependencies. Loaded only by sections/hero-scroll-car.liquid.
 *
 * Structure:
 *   <hero-scroll-car data-mode="static|scroll">   custom element, one per section instance
 *     [data-hsc-scroller]  tall container that provides the scroll distance
 *       [data-hsc-stage]   sticky 100vh scene: video, canvas (frames), overlay texts, sound button, cards
 *     [data-hsc-static]    stacked fallback (mobile / reduced motion / no JS)
 *
 * Scroll phases inside the scroller (desktop):
 *   0 → HERO_SCROLL_RATIO × viewport : the video stays on its last frame, texts fade out (--hsc-hero-o)
 *   then                              : frames 1 → N are scrubbed on the canvas, cards appear at the stops
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
  var HERO_SCROLL_RATIO = 0.4;    // share of a viewport height used to fade the hero texts before scrubbing
  var SNAP_IDLE_MS = 220;         // scroll idle time before the sequence settles on the nearest stop
  var SNAP_MIN_DISTANCE = 0.6;    // frames: closer than this to a stop, no snap needed
  var HOTSPOT_CARD_GAP = 108;     // px from the hotspot dot to the opened card (dot + line + spacing)

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function percent(value) {
    var number = parseFloat(value);
    return clamp(isNaN(number) ? 50 : number, 0, 100);
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
    this.setupHotspots();
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
    if (this.onKeydown) document.removeEventListener('keydown', this.onKeydown);
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
    for (var i = 0; i < config.stops.length; i++) {
      var stop = config.stops[i];
      stop.display = stop.display === 'hotspot' ? 'hotspot' : 'card';
      stop.x = percent(stop.x);
      stop.y = percent(stop.y);
      stop.focus = percent(stop.focus); // abscissa kept on screen when a narrow stage crops the frame
    }
    config.snapToStops = config.snapToStops !== false;
    config.mobileSequence = config.mobileSequence !== false;
    config.texts = config.texts || {};
    return config;
  };

  HeroScrollCar.prototype.isStatic = function () {
    if (this.mqReduced.matches) return true;
    if (this.mqMobile.matches && !this.config.mobileSequence) return true;
    var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return !!(connection && connection.saveData); // Save-Data: skip the sequence download
  };

  HeroScrollCar.prototype.applyMode = function () {
    // Layout: "compact" (narrow screens: cropped frame that pans toward each stop, bottom-sheet cards)
    // or "wide" (side cards). Independent from the mode.
    var compact = this.mqMobile.matches;
    if (compact !== this.compact) {
      this.compact = compact;
      this.setAttribute('data-layout', compact ? 'compact' : 'wide');
      if (this.sequence) {
        this.resizeCanvas();
        if (this.sequence.openCard) this.placeHotspotCard(this.sequence.openCard);
      }
    }
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

    if (sound) {
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
      if (audio) audio.pause();
      else video.muted = true;
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
    if (!audio) {
      // No separate audio file: the mp4 carries its own track, so unmuting keeps a perfect sync.
      video.muted = false;
      if (atEnd || video.paused) {
        video.currentTime = 0;
        video.play().catch(function () {});
      }
      return;
    }
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
    var target = this.querySelector('[data-hsc-static]') || this.querySelector('[data-hsc-scroller]');
    if (target) target.scrollIntoView({ behavior: behavior, block: 'start' });
  };

  /* ------------------------------------------------------------------ part 2: scroll sequence */

  HeroScrollCar.prototype.setupSequence = function () {
    if (this.sequence) return;
    var self = this;
    var config = this.config;
    var section = this.querySelector('[data-hsc-scroller]');
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

    // Product cards and hotspot markers living inside the stage, keyed by block id.
    var cards = stage.querySelectorAll('[data-hsc-card]');
    for (var i = 0; i < cards.length; i++) seq.cards[cards[i].getAttribute('data-stop-id')] = cards[i];
    seq.hotspots = {};
    var markers = stage.querySelectorAll('[data-hsc-hotspot]');
    for (var m = 0; m < markers.length; m++) seq.hotspots[markers[m].getAttribute('data-stop-id')] = markers[m];
    seq.stopsById = {};
    for (var k = 0; k < config.stops.length; k++) seq.stopsById[config.stops[k].id] = config.stops[k];
    seq.openCard = null;
    seq.cover = null;

    // The poster (= last video frame = f_0001) is the safety net drawn until the first frame arrives.
    if (config.posterUrl) {
      var poster = new Image();
      poster.decoding = 'async';
      poster.onload = function () { seq.poster = poster; if (seq.drawn === -1) self.drawFrame(Math.round(seq.current)); };
      poster.src = config.posterUrl;
    }

    this.resizeCanvas();
    seq.onResize = function () { self.resizeCanvas(); };
    window.addEventListener('resize', seq.onResize);
    if ('ResizeObserver' in window) {
      seq.resizeObserver = new ResizeObserver(seq.onResize);
      seq.resizeObserver.observe(stage);
    }

    seq.onScroll = function () { self.startLoop(); self.scheduleSnap(); };
    window.addEventListener('scroll', seq.onScroll, { passive: true });
    // overflow: hidden is still scrollable programmatically (focus, scrollIntoView): never let that shift the scene.
    seq.onStageScroll = function () { if (stage.scrollLeft || stage.scrollTop) { stage.scrollLeft = 0; stage.scrollTop = 0; } };
    stage.addEventListener('scroll', seq.onStageScroll);

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
    seq.stage.removeEventListener('scroll', seq.onStageScroll);
    if (seq.resizeObserver) seq.resizeObserver.disconnect();
    if (seq.intersection) seq.intersection.disconnect();
    clearTimeout(seq.snapTimer);
    this.closeHotspotCard();
    var ids = Object.keys(seq.cards);
    for (var i = 0; i < ids.length; i++) this.setCardVisible(seq.cards[ids[i]], false);
    var hids = Object.keys(seq.hotspots);
    for (var h = 0; h < hids.length; h++) this.setHotspotVisible(seq.hotspots[hids[h]], false);
    seq.stage.classList.remove('is-scrubbing');
    seq.stage.style.removeProperty('--hsc-hero-o');
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
    // Pass 1: every other frame, nearest to the target first, so the whole sequence is usable early at
    // half density (matters on mobile networks). Pass 2: the frames in between.
    for (var pass = 0; pass < 2; pass++) {
      var best = -1;
      var bestDistance = Infinity;
      for (var i = 1; i <= seq.total; i++) {
        if (seq.state[i] !== 0) continue;
        if (pass === 0 && i % 2 === 0) continue;
        var distance = Math.abs(i - center);
        if (distance < bestDistance) { bestDistance = distance; best = i; }
      }
      if (best !== -1) return best;
    }
    return -1;
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

    // "cover": keep the ratio, fill the stage. Wide stages center the overflow; a narrow (portrait) stage
    // crops the 16:9 frame a lot, so the crop slides toward each stop's focus abscissa instead.
    var scale = Math.max(seq.width / imageWidth, seq.height / imageHeight);
    var drawWidth = imageWidth * scale;
    var drawHeight = imageHeight * scale;
    var focus = this.compact ? this.focusAt(seq.current) / 100 : 0.5;
    var offsetX = (seq.width - drawWidth) * focus;
    var offsetY = (seq.height - drawHeight) / 2;
    seq.context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
    seq.cover = { ox: offsetX, oy: offsetY, dw: drawWidth, dh: drawHeight };
    this.positionHotspots();

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

  // Focus abscissa (0–100) along the sequence: 50 (centered) at both ends, each stop's value at its frame,
  // eased in between so the pan settles exactly on the stop.
  HeroScrollCar.prototype.focusAt = function (frame) {
    var seq = this.sequence;
    if (!seq.focusAnchors) {
      var anchors = [{ frame: 1, focus: 50 }];
      var stops = this.config.stops.slice().sort(function (a, b) { return a.frame - b.frame; });
      for (var i = 0; i < stops.length; i++) {
        if (stops[i].frame > 1 && stops[i].frame < seq.total) anchors.push({ frame: stops[i].frame, focus: stops[i].focus });
      }
      anchors.push({ frame: seq.total, focus: 50 });
      seq.focusAnchors = anchors;
    }
    var list = seq.focusAnchors;
    if (frame <= list[0].frame) return list[0].focus;
    for (var k = 1; k < list.length; k++) {
      if (frame <= list[k].frame) {
        var span = list[k].frame - list[k - 1].frame || 1;
        var t = (frame - list[k - 1].frame) / span;
        t = t * t * (3 - 2 * t);
        return list[k - 1].focus + (list[k].focus - list[k - 1].focus) * t;
      }
    }
    return list[list.length - 1].focus;
  };

  /* ---- scroll loop ---------------------------------------------------- */

  HeroScrollCar.prototype.progressToFrame = function (progress) {
    return 1 + clamp(progress, 0, 1) * (this.sequence.total - 1);
  };

  // Scroll geometry: [top, top + heroPx] fades the hero texts, [top + heroPx, top + distance] scrubs the frames.
  HeroScrollCar.prototype.scrollRange = function () {
    var seq = this.sequence;
    var rect = seq.section.getBoundingClientRect();
    var top = rect.top + window.pageYOffset;
    var stageHeight = seq.stage.offsetHeight || window.innerHeight;
    var distance = Math.max(1, rect.height - stageHeight);
    var heroPx = Math.min(Math.round(stageHeight * HERO_SCROLL_RATIO), distance * 0.5);
    return { top: top, distance: distance, heroPx: heroPx, frames: Math.max(1, distance - heroPx) };
  };

  HeroScrollCar.prototype.scrollToFrame = function (frame, behavior) {
    var seq = this.sequence;
    if (!seq) return;
    var range = this.scrollRange();
    var progress = (clamp(frame, 1, seq.total) - 1) / Math.max(1, seq.total - 1);
    window.scrollTo({ top: Math.round(range.top + range.heroPx + progress * range.frames), behavior: behavior || 'smooth' });
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
    var scrolled = window.pageYOffset - range.top;
    var heroProgress = clamp(scrolled / range.heroPx, 0, 1);
    var progress = (scrolled - range.heroPx) / range.frames;
    seq.target = this.progressToFrame(progress);
    this.updateHeroPhase(scrolled, heroProgress);

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
    // Any real scroll closes an opened hotspot card and lets the sequence go on.
    if (seq.openCard && Math.abs(seq.target - seq.openAtTarget) > 0.75) this.closeHotspotCard();

    // Help the background loader follow the user when it jumps far ahead.
    if (seq.wakeBackground && seq.state[index] === 0) seq.wakeBackground();

    if (seq.current !== seq.target && seq.inView) {
      seq.rafId = requestAnimationFrame(this.tick.bind(this));
    }
  };

  /* ---- hero phase (texts fade, canvas takes over the video) ------------- */

  HeroScrollCar.prototype.updateHeroPhase = function (scrolled, heroProgress) {
    var seq = this.sequence;
    var opacity = (1 - heroProgress).toFixed(3);
    if (opacity !== seq.heroOpacity) {
      seq.heroOpacity = opacity;
      seq.stage.style.setProperty('--hsc-hero-o', opacity);
    }
    // As soon as the page moves, the canvas (showing f_0001 = last video frame) covers the video.
    var scrubbing = scrolled > 1;
    if (scrubbing !== seq.scrubbing) {
      seq.scrubbing = scrubbing;
      seq.stage.classList.toggle('is-scrubbing', scrubbing);
      if (scrubbing && this.video && !this.video.paused && !this.video.ended) this.video.pause();
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
    if (seq.openCard && seq.openCard !== bestId) this.closeHotspotCard();
    for (var k = 0; k < stops.length; k++) {
      var stop = stops[k];
      var active = stop.id === bestId;
      if (stop.display === 'hotspot') {
        if (seq.hotspots[stop.id]) this.setHotspotVisible(seq.hotspots[stop.id], active);
        if (!active && seq.cards[stop.id]) this.setCardVisible(seq.cards[stop.id], false);
      } else if (seq.cards[stop.id]) {
        this.setCardVisible(seq.cards[stop.id], active);
      }
    }
  };

  HeroScrollCar.prototype.setCardVisible = function (card, visible) {
    card.classList.toggle('is-visible', visible);
    if (!visible) card.classList.remove('is-open');
    card.setAttribute('aria-hidden', visible ? 'false' : 'true');
  };

  HeroScrollCar.prototype.setHotspotVisible = function (marker, visible) {
    marker.classList.toggle('is-visible', visible);
    marker.setAttribute('aria-hidden', visible ? 'false' : 'true');
    marker.setAttribute('tabindex', visible ? '0' : '-1');
    if (!visible) { marker.classList.remove('is-active'); marker.setAttribute('aria-expanded', 'false'); }
  };

  /* ---- hotspots: pulsing dot + line + label, click opens the product card ---- */

  HeroScrollCar.prototype.positionHotspots = function () {
    var seq = this.sequence;
    if (!seq || !seq.cover) return;
    var ids = Object.keys(seq.hotspots);
    for (var i = 0; i < ids.length; i++) {
      var stop = seq.stopsById[ids[i]];
      var marker = seq.hotspots[ids[i]];
      if (!stop) continue;
      // Image-space percentages → stage pixels, through the same "cover" mapping as the canvas.
      var x = clamp(seq.cover.ox + seq.cover.dw * stop.x / 100, 24, seq.width - 24);
      var y = clamp(seq.cover.oy + seq.cover.dh * stop.y / 100, 24, seq.height - 24);
      marker.style.left = x.toFixed(1) + 'px';
      marker.style.top = y.toFixed(1) + 'px';
      // Compact layout: the line + label flip to the other side of the dot when they would leave the screen.
      var onLeft = stop.side === 'left';
      if (this.compact) {
        var extent = (marker.offsetWidth || 160) - 16; // dot center → far end of the label
        var flip = onLeft ? x - extent < 8 : x + extent > seq.width - 8;
        onLeft = onLeft !== flip;
      }
      marker.classList.toggle('hsc-hotspot--left', onLeft);
    }
    if (seq.openCard) this.placeHotspotCard(seq.openCard);
  };

  HeroScrollCar.prototype.placeHotspotCard = function (id) {
    var seq = this.sequence;
    var card = seq.cards[id];
    var marker = seq.hotspots[id];
    var stop = seq.stopsById[id];
    if (!card || !marker || !stop) return;
    if (this.compact) { card.style.left = ''; card.style.top = ''; return; } // bottom sheet, placed by CSS
    var mx = parseFloat(marker.style.left) || 0;
    var my = parseFloat(marker.style.top) || 0;
    var cardWidth = card.offsetWidth || 320;
    var cardHeight = card.offsetHeight || 360;
    var left = stop.side === 'left' ? mx - HOTSPOT_CARD_GAP - cardWidth : mx + HOTSPOT_CARD_GAP;
    left = clamp(left, 16, Math.max(16, seq.width - cardWidth - 16));
    var top = clamp(my - cardHeight / 2, 16, Math.max(16, seq.height - cardHeight - 16));
    card.style.left = left.toFixed(1) + 'px';
    card.style.top = top.toFixed(1) + 'px';
  };

  HeroScrollCar.prototype.openHotspotCard = function (id) {
    var seq = this.sequence;
    if (!seq || !seq.cards[id]) return;
    if (seq.openCard && seq.openCard !== id) this.closeHotspotCard();
    seq.openCard = id;
    seq.openAtTarget = seq.target;
    this.placeHotspotCard(id);
    var card = seq.cards[id];
    card.classList.add('is-visible', 'is-open');
    card.setAttribute('aria-hidden', 'false');
    var marker = seq.hotspots[id];
    if (marker) { marker.classList.add('is-active'); marker.setAttribute('aria-expanded', 'true'); }
    var close = card.querySelector('[data-hsc-close]');
    if (close) close.focus({ preventScroll: true });
  };

  HeroScrollCar.prototype.closeHotspotCard = function (returnFocus) {
    var seq = this.sequence;
    if (!seq || !seq.openCard) return;
    var id = seq.openCard;
    seq.openCard = null;
    var card = seq.cards[id];
    if (card) { card.classList.remove('is-visible', 'is-open'); card.setAttribute('aria-hidden', 'true'); }
    var marker = seq.hotspots[id];
    if (marker) {
      marker.classList.remove('is-active');
      marker.setAttribute('aria-expanded', 'false');
      if (returnFocus) marker.focus({ preventScroll: true });
    }
  };

  HeroScrollCar.prototype.setupHotspots = function () {
    var self = this;
    this.addEventListener('click', function (event) {
      var seq = self.sequence;
      if (!seq) return;
      var marker = event.target.closest('[data-hsc-hotspot]');
      if (marker) {
        event.preventDefault();
        var id = marker.getAttribute('data-stop-id');
        if (seq.openCard === id) self.closeHotspotCard(true);
        else self.openHotspotCard(id);
        return;
      }
      if (event.target.closest('[data-hsc-close]')) { event.preventDefault(); self.closeHotspotCard(true); return; }
      if (seq.openCard && !event.target.closest('[data-hsc-card]')) self.closeHotspotCard();
    });
    this.onKeydown = function (event) {
      if (event.key === 'Escape' && self.sequence && self.sequence.openCard) self.closeHotspotCard(true);
    };
    document.addEventListener('keydown', this.onKeydown);
  };

  /* ---- snap: settle on the exact stop frame when the user stops scrolling in its range ---- */

  HeroScrollCar.prototype.scheduleSnap = function () {
    var self = this;
    var seq = this.sequence;
    if (!seq || !this.config.snapToStops) return;
    clearTimeout(seq.snapTimer);
    seq.snapTimer = setTimeout(function () { self.snapToNearestStop(); }, SNAP_IDLE_MS);
  };

  HeroScrollCar.prototype.snapToNearestStop = function () {
    var seq = this.sequence;
    if (!seq || seq.destroyed || !seq.inView) return;
    var range = this.scrollRange();
    var scrolled = window.pageYOffset - range.top;
    if (scrolled <= range.heroPx || scrolled >= range.distance) return; // hero phase or past the sequence
    if (seq.target >= seq.total - 0.5) return;                          // the very end never pulls back
    var stops = this.config.stops;
    var best = null;
    var bestDistance = Infinity;
    for (var i = 0; i < stops.length; i++) {
      var distance = Math.abs(seq.target - stops[i].frame);
      if (distance <= this.config.stopRange && distance < bestDistance) { best = stops[i]; bestDistance = distance; }
    }
    if (!best || bestDistance < SNAP_MIN_DISTANCE) return;
    this.scrollToFrame(best.frame, this.mqReduced.matches ? 'auto' : 'smooth');
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
        if (self.config.stops[i].id === id) {
          self.scrollToFrame(self.config.stops[i].frame, 'smooth');
          if (self.config.stops[i].display === 'hotspot') setTimeout(function () { self.openHotspotCard(id); }, 900);
          break;
        }
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

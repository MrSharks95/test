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
  // Events that count as a click for the browsers' sound rules (checked with navigator.userActivation).
  var SOUND_UNLOCK_EVENTS = ['pointerdown', 'touchend', 'keydown', 'click'];
  var DECODE_AHEAD = 3;           // frames decoded ahead of the current one
  var HERO_SCROLL_RATIO = 0.4;    // share of a viewport height used to fade the hero texts before scrubbing
  var SNAP_IDLE_MS = 220;         // scroll idle time before the sequence settles on the nearest stop
  var SNAP_MIN_DISTANCE = 0.6;    // frames: closer than this to a stop, no snap needed
  var HOTSPOT_CARD_GAP = 108;     // px from the hotspot dot to the opened card (dot + line + spacing)

  // Chapters mode (the plan-séquence plays as a real video from stop to stop)
  var CHAPTER_GESTURE_GAP_MS = 220; // a wheel event after this much silence starts a new gesture
  var CHAPTER_WHEEL_PX = 24;        // wheel distance, within one gesture, that triggers a chapter change
  var CHAPTER_SWIPE_PX = 36;        // touch distance that triggers a chapter change
  var CHAPTER_PINNED_PX = 2;        // the scene is "pinned" when its top is this close to the viewport top
  var CHAPTER_SEEK_TIMEOUT_MS = 2500;
  var CHAPTER_CUT_MS = 180;         // fade used for direct jumps (dots, editor) and when no reverse video exists
  var CHAPTER_BOOST = 1.6;          // each extra gesture during a transition speeds it up by this factor…
  var CHAPTER_MAX_RATE = 6;         // …up to this playback rate (a stop is never skipped)
  var CHAPTER_DWELL_MS = 650;       // after arriving on a stop, wheel / swipe / keys wait this long (no accidental skip)
  var CHAPTER_FAST_SECONDS = 1.8;   // dots: the video fast-forwards (or rewinds) to the chosen stop in about this time…
  var CHAPTER_FAST_MIN = 2.5;       // …at a playback rate between these bounds
  var CHAPTER_FAST_MAX = 8;

  function nowMs() { return (window.performance && performance.now) ? performance.now() : Date.now(); }

  function parseSeconds(value) {
    var number = parseFloat(String(value === undefined || value === null ? '' : value).replace(',', '.'));
    return isNaN(number) ? NaN : number;
  }

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
    this.teardownChapters();
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
      stop.time = parseSeconds(stop.time); // chapters mode: where the video stops, in seconds
      stop.rate = parseSeconds(stop.rate); // chapters mode: playback speed of the segment that leads to this stop
    }
    config.snapToStops = config.snapToStops !== false;
    config.startMode = config.startMode === 'auto' || config.startMode === 'muted' ? config.startMode : (config.startMode === 'button' ? 'button' : 'muted');
    config.soundAutostart = config.startMode === 'auto';
    config.mobileSequence = config.mobileSequence !== false;
    config.sequenceMode = config.sequenceMode === 'chapters' ? 'chapters' : 'scrub';
    config.chapterRate = clamp(parseSeconds(config.chapterRate) || 1.5, 0.5, 4);
    config.chapterEnd = parseSeconds(config.chapterEnd);
    config.fps = parseSeconds(config.fps) || 30;
    // "Présentoir (fin)" block: every chosen product, on the counter of the last shot (chapters mode).
    var showcase = config.showcase && typeof config.showcase === 'object' ? config.showcase : null;
    if (showcase) {
      showcase.y = clamp(parseSeconds(showcase.y) || 71, 0, 100);
      showcase.rate = parseSeconds(showcase.rate);
    }
    config.showcase = showcase;
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
      if (this.chapters) {
        this.resizeChapters();
      } else if (this.sequence) {
        this.resizeCanvas();
        if (this.sequence.openCard) this.placeHotspotCard(this.sequence.openCard);
      }
    }
    var mode = this.isStatic() ? 'static' : 'scroll';
    if (mode === this.mode) return;
    this.mode = mode;
    this.setAttribute('data-mode', mode);
    this.setAttribute('data-sequence', this.config.sequenceMode);
    if (mode === 'scroll') {
      if (this.config.sequenceMode === 'chapters') this.setupChapters();
      else this.setupSequence();
    } else {
      this.teardownChapters();
      this.teardownSequence();
    }
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
    this.soundBlocked = false;
    hero.classList.add('has-js');

    var revealed = false;
    var reveal = function () {
      if (revealed) return;
      revealed = true;
      hero.classList.add('is-ended');
    };
    this.revealHero = reveal;

    video.addEventListener('ended', reveal);

    var startButton = this.querySelector('[data-hsc-start]');
    if (this.config.startMode === 'button' && startButton) {
      this.setupStartButton(startButton, reveal);
    } else if (this.mqReduced.matches) {
      // Reduced motion: no autoplay, texts visible at once; the sound button can still start video + audio.
      video.removeAttribute('autoplay');
      video.pause();
      reveal();
    } else {
      if (this.config.soundAutostart) {
        // Sound on from the start when the browser allows it (e.g. a visitor who already clicked on the
        // store); otherwise the video starts muted and the sound switches on at the first click / tap.
        this.soundOn = true;
        if (!audio) video.muted = false;
      }
      var playPromise = video.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(function () {
          if (self.config.soundAutostart && !video.muted && !self.soundBlocked) self.setSoundButton(true);
        }, function () {
          if (!video.muted) {
            video.muted = true;
            self.markSoundBlocked();
            var retry = video.play();
            if (retry && typeof retry.catch === 'function') retry.catch(reveal);
            return;
          }
          reveal(); // autoplay refused (data saver, low power mode…)
        });
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
      // An unreadable sound file (missing, corrupted upload…) must not silence the banner: drop it and
      // use the video's own soundtrack instead.
      var dropAudio = function () {
        if (self.audio !== audio) return;
        self.audio = null;
        audio.pause();
        if (self.soundOn && !self.soundBlocked) video.muted = false;
      };
      audio.addEventListener('error', dropAudio);
      var audioSources = audio.querySelectorAll('source');
      for (var a = 0; a < audioSources.length; a++) audioSources[a].addEventListener('error', dropAudio);
      video.addEventListener('timeupdate', function () {
        if (self.audio !== audio || !self.soundOn || audio.paused) return;
        if (Math.abs(audio.currentTime - video.currentTime) > AUDIO_DRIFT_SECONDS) {
          audio.currentTime = video.currentTime;
        }
      });
      video.addEventListener('pause', function () { audio.pause(); }); // also fired on "ended"
      video.addEventListener('play', function () {
        if (self.audio !== audio || !self.soundOn || self.soundBlocked) return;
        audio.currentTime = video.currentTime;
        audio.play().then(function () { self.setSoundButton(true); }, function (error) {
          if (error && error.name === 'NotAllowedError') self.markSoundBlocked();
          else if (error && error.name !== 'AbortError') dropAudio();
        });
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

  // "Démarrer le moteur": the car waits, engine off, on the banner's first frame. The click is a user gesture,
  // so the ignition plays WITH sound in every browser, and the sound stays on for the plan-séquence.
  // Scrolling before pressing starts the engine muted, so the page never feels stuck.
  HeroScrollCar.prototype.setupStartButton = function (button, reveal) {
    var self = this;
    var video = this.video;
    var hero = this.hero;
    video.removeAttribute('autoplay');
    video.pause();
    hero.classList.add('is-waiting-start');
    this.waitingStart = true;

    var start = function (withSound) {
      if (!self.waitingStart) return;
      self.waitingStart = false;
      window.removeEventListener('scroll', onScroll);
      hero.classList.remove('is-waiting-start');
      hero.classList.add('is-started');
      if (withSound) {
        self.soundOn = true;
        if (!self.audio) video.muted = false;
        self.setSoundButton(true);
      } else {
        // Started by a scroll (not a click for the browser): muted for now, the sound comes on by itself
        // at the first click / tap anywhere — no need to find the sound button.
        self.soundOn = true;
        video.muted = true;
        self.markSoundBlocked();
      }
      try { video.currentTime = 0; } catch (error) { /* not seekable yet: plays from the start anyway */ }
      var promise = video.play();
      if (promise && typeof promise.catch === 'function') {
        promise.catch(function () {
          if (!video.muted) {
            video.muted = true;
            self.markSoundBlocked();
            video.play().catch(reveal);
            return;
          }
          reveal();
        });
      }
      if (withSound) {
        // Still inside the click: Safari and every iPhone browser only allow sound on a media element
        // started from a click / tap, so the engine sound and the plan-séquence get it now.
        var audio = self.audio;
        if (audio) {
          try { audio.currentTime = 0; } catch (error) { /* starts from 0 anyway */ }
          var audioPromise = audio.play();
          if (audioPromise && typeof audioPromise.catch === 'function') audioPromise.catch(function () {});
        }
        self.primeChapterSound();
      }
      // Safety nets, as for the autoplay: never leave the hero without its texts.
      setTimeout(function () { if (video.paused && !video.ended) reveal(); }, 2500);
      setTimeout(reveal, 15000);
    };
    this.startEngine = start;
    var onScroll = function () { if (window.pageYOffset > 4) start(false); };
    window.addEventListener('scroll', onScroll, { passive: true });
    button.addEventListener('click', function () {
      button.classList.add('is-pressed');
      start(true);
    });
    var failed = function () {
      // No video: drop the button and show the texts over the poster.
      self.waitingStart = false;
      hero.classList.remove('is-waiting-start');
      reveal();
    };
    video.addEventListener('error', failed);
    var sources = video.querySelectorAll('source');
    for (var i = 0; i < sources.length; i++) sources[i].addEventListener('error', failed);
  };

  // The browser refused sound before any user gesture: keep the "sound on" intent, play muted, and
  // switch the sound on at the first click / tap / key press anywhere on the page.
  HeroScrollCar.prototype.markSoundBlocked = function () {
    var self = this;
    if (this.soundBlocked) return;
    this.soundBlocked = true;
    if (this.soundButton) {
      this.soundButton.classList.add('is-sound-blocked');
      this.soundButton.setAttribute('aria-pressed', 'false');
    }
    var unlock = function (event) {
      if (self.soundButton && self.soundButton.contains(event.target)) return; // the button handles itself
      // A finger counts as a click on touchend only (not on its pointer events): unmuting earlier would be
      // refused, and the browser even pauses a video unmuted that way.
      if (event.type === 'pointerdown' && event.pointerType && event.pointerType !== 'mouse') return;
      if (navigator.userActivation && !navigator.userActivation.isActive) return;
      self.unlockSound();
    };
    this.onSoundUnlock = unlock;
    SOUND_UNLOCK_EVENTS.forEach(function (type) {
      document.addEventListener(type, unlock, { capture: true, passive: true });
    });
  };

  HeroScrollCar.prototype.setSoundButton = function (on) {
    var button = this.soundButton;
    if (!button) return;
    var texts = this.config.texts;
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
    button.setAttribute('aria-label', (on ? texts.soundOff : texts.soundOn) || '');
    button.setAttribute('title', (on ? texts.soundOff : texts.soundOn) || '');
  };

  HeroScrollCar.prototype.unlockSound = function () {
    if (!this.soundBlocked) return;
    var self = this;
    this.soundBlocked = false;
    SOUND_UNLOCK_EVENTS.forEach(function (type) {
      document.removeEventListener(type, self.onSoundUnlock, { capture: true, passive: true });
    });
    var texts = this.config.texts;
    var button = this.soundButton;
    if (button) {
      button.classList.remove('is-sound-blocked');
      button.setAttribute('aria-pressed', 'true');
      button.setAttribute('aria-label', texts.soundOff || '');
      button.setAttribute('title', texts.soundOff || '');
    }
    this.soundOn = true;
    var video = this.video;
    var heroPlaying = video && !video.paused && !video.ended;
    if (heroPlaying) {
      if (this.audio) {
        this.audio.currentTime = video.currentTime;
        this.audio.play().catch(function () {});
      } else {
        video.muted = false;
      }
    }
    var ch = this.chapters;
    if (ch && ch.activeVideo === ch.fwd && !ch.fwd.paused) ch.fwd.muted = false;
    this.primeChapterSound();
  };

  // Safari and every iPhone browser only let a media element play with sound if it was started once from
  // a click / tap. Called inside such a gesture: the plan-séquence video is started and paused at once,
  // so it can later play with its soundtrack when a wheel or a swipe moves on. It stays muted for this
  // (an iPhone pauses any other video playing with sound, i.e. the banner).
  HeroScrollCar.prototype.primeChapterSound = function () {
    var ch = this.chapters;
    if (!ch || !ch.fwd || !ch.fwd.paused || ch.busy) return;
    var fwd = ch.fwd;
    var muted = fwd.muted;
    fwd.muted = true;
    var promise = fwd.play();
    if (promise && typeof promise.catch === 'function') promise.catch(function () {});
    fwd.pause();
    fwd.muted = muted;
  };

  HeroScrollCar.prototype.toggleSound = function () {
    var video = this.video;
    var audio = this.audio;
    var button = this.soundButton;
    var texts = this.config.texts;

    if (this.soundBlocked) { this.unlockSound(); return; }

    var ch = this.chapters;
    if (ch && (ch.index > 0 || ch.busy)) {
      this.soundOn = !this.soundOn;
      if (this.soundOn) this.primeChapterSound();
      ch.fwd.muted = !this.soundOn;
      if (audio) audio.pause();
      button.setAttribute('aria-pressed', this.soundOn ? 'true' : 'false');
      button.setAttribute('aria-label', (this.soundOn ? texts.soundOff : texts.soundOn) || '');
      button.setAttribute('title', (this.soundOn ? texts.soundOff : texts.soundOn) || '');
      return;
    }

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
    this.primeChapterSound();

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
    if (this.chapters) {
      this.pinChapters();
      this.goChapter(1);
      return;
    }
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


  /* ------------------------------------------------------------------ part 3: chapters mode */
  /*
    Instead of scrubbing images, the plan-séquence plays as a real video from one stop to the next:
    one wheel gesture, swipe, arrow key or button press plays it forward to the next stop at full video
    smoothness. Going back plays a pre-rendered reversed copy of the video (same frames, mirrored timeline),
    so the rewind is just as smooth; without that file the scene cuts back with a short fade.
    The scene is pinned at the top of the viewport while chapters remain; after the last one the page
    scrolls on normally. Cards and hotspots reuse the scrub-mode helpers through a "sequence-like" object.
  */

  HeroScrollCar.prototype.setupChapters = function () {
    if (this.chapters) return;
    var self = this;
    var config = this.config;
    var stage = this.querySelector('[data-hsc-stage]');
    var fwd = this.querySelector('[data-hsc-chapter-video]');
    var rev = this.querySelector('[data-hsc-chapter-reverse]');
    var nav = this.querySelector('[data-hsc-chapters]');
    if (!stage || !fwd) return;

    // Chapter points: the hero (0 s), each stop that has a time, then the end of the sequence.
    var points = [{ time: 0, stop: null, focus: 50, label: config.texts.start || '' }];
    var stops = config.stops.filter(function (stop) { return stop.time > 0; });
    stops.sort(function (a, b) { return a.time - b.time; });
    for (var i = 0; i < stops.length; i++) {
      points.push({ time: stops[i].time, stop: stops[i], focus: stops[i].focus, label: stops[i].label || '' });
    }
    var last = points[points.length - 1].time;
    var showcase = config.showcase;
    if (config.chapterEnd > last + 0.2) {
      points.push({
        time: config.chapterEnd,
        stop: null,
        focus: 50,
        label: (showcase && showcase.label) || config.texts.end || '',
        showcase: !!showcase,
        rate: showcase ? showcase.rate : NaN
      });
    }

    var ch = {
      stage: stage,
      shelf: config.showcase ? this.querySelector('[data-hsc-shelf]') : null,
      fwd: fwd,
      rev: rev && rev.getAttribute('src') ? rev : null,
      nav: nav,
      points: points,
      index: 0,
      pending: 0,
      busy: false,
      queued: null,
      fps: config.fps,
      lastWheel: 0,
      wheelAcc: 0,
      gestureUsed: false,
      touchY: null,
      touchDecided: null,
      destroyed: false
    };
    this.chapters = ch;

    // The card / hotspot helpers expect the scrub sequence's shape.
    var seq = {
      chapters: true,
      stage: stage,
      cards: {},
      hotspots: {},
      stopsById: {},
      cover: null,
      width: 0,
      height: 0,
      openCard: null,
      target: 0,
      activeStop: null,
      destroyed: false
    };
    var cards = stage.querySelectorAll('[data-hsc-card]');
    for (var c = 0; c < cards.length; c++) seq.cards[cards[c].getAttribute('data-stop-id')] = cards[c];
    var markers = stage.querySelectorAll('[data-hsc-hotspot]');
    for (var m = 0; m < markers.length; m++) seq.hotspots[markers[m].getAttribute('data-stop-id')] = markers[m];
    for (var k = 0; k < config.stops.length; k++) seq.stopsById[config.stops[k].id] = config.stops[k];
    this.sequence = seq;

    stage.classList.add('is-chapters');
    fwd.muted = !this.soundOn || this.soundBlocked;
    fwd.playbackRate = config.chapterRate;
    fwd.preload = 'auto';
    fwd.load();
    // The reversed copy loads once the forward video can play through (keeps the first load lean).
    ch.loadReverse = function () {
      if (!ch.rev || ch.reverseRequested || ch.destroyed) return;
      ch.reverseRequested = true;
      ch.rev.muted = true;
      ch.rev.preload = 'auto';
      ch.rev.load();
    };
    fwd.addEventListener('canplaythrough', ch.loadReverse, { once: true });
    ch.reverseTimer = setTimeout(ch.loadReverse, 5000);

    this.buildChapterNav();

    ch.onResize = function () { self.resizeChapters(); };
    window.addEventListener('resize', ch.onResize);
    fwd.addEventListener('loadedmetadata', ch.onResize);
    if ('ResizeObserver' in window) {
      ch.resizeObserver = new ResizeObserver(ch.onResize);
      ch.resizeObserver.observe(stage);
    }

    ch.onWheel = function (event) { self.onChapterWheel(event); };
    window.addEventListener('wheel', ch.onWheel, { passive: false });
    ch.onTouchStart = function (event) { self.onChapterTouchStart(event); };
    ch.onTouchMove = function (event) { self.onChapterTouchMove(event); };
    ch.onTouchEnd = function (event) { self.onChapterTouchEnd(event); };
    window.addEventListener('touchstart', ch.onTouchStart, { passive: true });
    window.addEventListener('touchmove', ch.onTouchMove, { passive: false });
    window.addEventListener('touchend', ch.onTouchEnd, { passive: true });
    ch.onKey = function (event) { self.onChapterKey(event); };
    document.addEventListener('keydown', ch.onKey);
    ch.onClick = function (event) {
      var button = event.target.closest('[data-hsc-next], [data-hsc-prev], [data-hsc-dot], [data-hsc-skip]');
      if (!button || !self.contains(button)) return;
      event.preventDefault();
      if (button.hasAttribute('data-hsc-skip')) { self.skipChapters(); return; }
      self.pinChapters();
      if (button.hasAttribute('data-hsc-next')) self.stepChapter(1);
      else if (button.hasAttribute('data-hsc-prev')) self.stepChapter(-1);
      else self.goChapter(parseInt(button.getAttribute('data-index'), 10) || 0, { fast: true });
    };
    this.addEventListener('click', ch.onClick);

    this.resizeChapters();
    this.updateChapterUI();
  };

  HeroScrollCar.prototype.teardownChapters = function () {
    var ch = this.chapters;
    if (!ch) return;
    ch.destroyed = true;
    if (this.sequence) this.sequence.destroyed = true;
    clearTimeout(ch.reverseTimer);
    window.removeEventListener('resize', ch.onResize);
    ch.fwd.removeEventListener('loadedmetadata', ch.onResize);
    if (ch.resizeObserver) ch.resizeObserver.disconnect();
    window.removeEventListener('wheel', ch.onWheel);
    window.removeEventListener('touchstart', ch.onTouchStart);
    window.removeEventListener('touchmove', ch.onTouchMove);
    window.removeEventListener('touchend', ch.onTouchEnd);
    document.removeEventListener('keydown', ch.onKey);
    this.removeEventListener('click', ch.onClick);
    ch.fwd.pause();
    if (ch.rev) ch.rev.pause();
    this.closeHotspotCard();
    this.showChapterStop(null);
    this.showShelf(false);
    ch.stage.classList.remove('is-chapters', 'is-away', 'is-reversing', 'is-cutting', 'is-playing');
    if (ch.nav) ch.nav.innerHTML = '';
    this.chapters = null;
    this.sequence = null;
  };

  HeroScrollCar.prototype.isChaptersPinned = function () {
    var ch = this.chapters;
    return !!ch && Math.abs(ch.stage.getBoundingClientRect().top) <= CHAPTER_PINNED_PX;
  };

  HeroScrollCar.prototype.pinChapters = function () {
    var ch = this.chapters;
    if (!ch || this.isChaptersPinned()) return;
    var top = ch.stage.getBoundingClientRect().top + window.pageYOffset;
    window.scrollTo({ top: Math.round(top), behavior: this.mqReduced.matches ? 'auto' : 'smooth' });
  };

  // Scroll just past the section (the "skip" button, for keyboard and screen-reader users).
  HeroScrollCar.prototype.skipChapters = function () {
    var rect = this.getBoundingClientRect();
    window.scrollTo({ top: Math.round(rect.bottom + window.pageYOffset), behavior: 'smooth' });
  };

  // Next chapter index a gesture in direction `dir` would lead to, or -1 when it falls outside (release).
  HeroScrollCar.prototype.chapterTargetFor = function (dir) {
    var ch = this.chapters;
    var base = ch.busy ? ch.pending : ch.index;
    var target = base + dir;
    return target >= 0 && target < ch.points.length ? target : -1;
  };

  HeroScrollCar.prototype.stepChapter = function (dir) {
    var target = this.chapterTargetFor(dir);
    if (target !== -1) this.goChapter(target);
  };

  HeroScrollCar.prototype.onChapterWheel = function (event) {
    var ch = this.chapters;
    if (!ch || event.ctrlKey) return; // ctrl + wheel = page zoom
    var dy = event.deltaY;
    if (event.deltaMode === 1) dy *= 16;
    else if (event.deltaMode === 2) dy *= window.innerHeight;
    if (!dy) return;
    var now = nowMs();
    var fresh = now - ch.lastWheel > CHAPTER_GESTURE_GAP_MS;
    ch.lastWheel = now;
    if (fresh) { ch.wheelAcc = 0; ch.gestureUsed = false; }
    var dir = dy > 0 ? 1 : -1;
    if (this.waitingStart && dir > 0 && this.isChaptersPinned()) {
      // Engine still off: the first scroll starts it (muted: a wheel is not a click for the browser).
      event.preventDefault();
      ch.gestureUsed = true;
      this.startEngine(false);
      return;
    }

    if (!this.isChaptersPinned()) {
      // Pin the scene when the gesture is about to cross it; anywhere else the page scrolls normally.
      var rect = ch.stage.getBoundingClientRect();
      var height = window.innerHeight;
      var entering = dir > 0 ? rect.top > 0 && rect.top < height * 0.5 : rect.top < 0 && rect.bottom > height * 0.5;
      if (!entering) return;
      event.preventDefault();
      this.pinChapters();
      if (dir > 0 && ch.index === 0 && !ch.busy && !ch.gestureUsed) {
        ch.gestureUsed = true;
        if (this.waitingStart) this.startEngine(false);
        else this.goChapter(1);
      }
      return;
    }

    // The rest of a gesture that already moved (trackpad inertia, fast notches) is swallowed.
    if (ch.gestureUsed && !fresh) { event.preventDefault(); return; }
    // Just arrived on a stop: a gesture that overlaps the arrival does not move on (no accidental skip).
    if (!ch.busy && now - (ch.arrivedAt || 0) < CHAPTER_DWELL_MS && this.chapterTargetFor(dir) !== -1) {
      event.preventDefault();
      ch.gestureUsed = true;
      return;
    }
    var target = this.chapterTargetFor(dir);
    if (target === -1) {
      if (ch.busy) event.preventDefault();
      return; // first or last chapter: the page scrolls on
    }
    event.preventDefault();
    ch.wheelAcc += Math.abs(dy);
    if (ch.wheelAcc < CHAPTER_WHEEL_PX) return;
    ch.gestureUsed = true;
    this.goChapter(target);
  };

  HeroScrollCar.prototype.onChapterTouchStart = function (event) {
    var ch = this.chapters;
    if (!ch) return;
    if (event.touches.length !== 1 || (!this.contains(event.target) && !this.isChaptersPinned())) { ch.touchY = null; return; }
    ch.touchY = event.touches[0].clientY;
    ch.touchX = event.touches[0].clientX;
    ch.touchDecided = null;
  };

  HeroScrollCar.prototype.onChapterTouchMove = function (event) {
    var ch = this.chapters;
    if (!ch || ch.touchY === null || ch.touchDecided === 'release') return;
    var touch = event.touches[0];
    var dy = ch.touchY - touch.clientY;
    var dx = ch.touchX - touch.clientX;
    if (ch.touchDecided === null) {
      if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return;
      if (Math.abs(dx) > Math.abs(dy)) { ch.touchDecided = 'release'; return; }
      var dir = dy > 0 ? 1 : -1;
      if (!this.isChaptersPinned()) {
        var rect = ch.stage.getBoundingClientRect();
        var height = window.innerHeight;
        var entering = dir > 0 ? rect.top > 0 && rect.top < height * 0.5 : rect.top < 0 && rect.bottom > height * 0.5;
        ch.touchDecided = entering ? 'pin' : 'release';
        if (!entering) return;
      } else if (this.chapterTargetFor(dir) === -1 && !ch.busy) {
        ch.touchDecided = 'release';
        return;
      } else {
        ch.touchDecided = dir;
      }
    }
    if (event.cancelable) event.preventDefault();
  };

  HeroScrollCar.prototype.onChapterTouchEnd = function (event) {
    var ch = this.chapters;
    if (!ch || ch.touchY === null) return;
    var decided = ch.touchDecided;
    var dy = ch.touchY - (event.changedTouches[0] ? event.changedTouches[0].clientY : ch.touchY);
    ch.touchY = null;
    ch.touchDecided = null;
    if (decided === 'pin') {
      this.pinChapters();
      if (dy > 0 && ch.index === 0 && !ch.busy) {
        if (this.waitingStart) this.startEngine(true);
        else this.goChapter(1);
      }
      return;
    }
    if (decided !== 1 && decided !== -1) return;
    if (this.waitingStart) { this.startEngine(true); return; } // a tap/swipe is a user gesture: sound allowed
    if (!ch.busy && nowMs() - (ch.arrivedAt || 0) < CHAPTER_DWELL_MS) return;
    if (Math.abs(dy) >= CHAPTER_SWIPE_PX && (dy > 0 ? 1 : -1) === decided) this.stepChapter(decided);
  };

  HeroScrollCar.prototype.onChapterKey = function (event) {
    var ch = this.chapters;
    if (!ch || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    var target = event.target || {};
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName || '') || target.isContentEditable) return;
    var key = event.key;
    if (key === ' ' && target.closest && target.closest('button, a, [role="button"]')) return;
    var dir = 0;
    if (key === 'ArrowDown' || key === 'PageDown' || (key === ' ' && !event.shiftKey)) dir = 1;
    else if (key === 'ArrowUp' || key === 'PageUp' || (key === ' ' && event.shiftKey)) dir = -1;
    if (!dir || !this.isChaptersPinned() || this.chapterTargetFor(dir) === -1) return;
    event.preventDefault();
    if (this.waitingStart) { this.startEngine(true); return; } // a key press is a user gesture: sound allowed
    if (!ch.busy && nowMs() - (ch.arrivedAt || 0) < CHAPTER_DWELL_MS) return;
    this.stepChapter(dir);
  };

  HeroScrollCar.prototype.goChapter = function (target, options) {
    var self = this;
    var ch = this.chapters;
    if (!ch) return;
    target = clamp(Math.round(target), 0, ch.points.length - 1);
    if (ch.busy) {
      if (options && options.fast) { ch.queued = target === ch.pending ? null : target; return; } // dot: after this one
      // Another gesture while the video plays: speed the current segment up instead of skipping the next stop.
      var playing = ch.pending > ch.index ? 1 : -1;
      if ((target > ch.pending ? 1 : -1) === playing || target === ch.pending) this.boostChapter();
      return;
    }
    if (target === ch.index) return;
    var from = ch.index;
    ch.boosts = 0;
    ch.activeVideo = null;
    var fast = (options && options.fast) || Math.abs(target - from) > 1;
    ch.busy = true;
    ch.pending = target;
    ch.stage.classList.add('is-playing');
    this.leaveChapter(from);
    this.updateChapterUI();

    var fromTime = ch.points[from].time;
    var toTime = ch.points[target].time;
    // Dots / far jumps: the video runs at high speed straight to the chosen stop (no stop on the way).
    var rate = fast ? clamp(Math.abs(toTime - fromTime) / CHAPTER_FAST_SECONDS, CHAPTER_FAST_MIN, CHAPTER_FAST_MAX) : null;
    var job;
    if (target > from) job = this.playChapterForward(fromTime, toTime, target, rate);
    else job = this.playChapterBackward(fromTime, toTime, target, rate);

    job.then(function () {
      if (ch.destroyed) return;
      ch.index = target;
      ch.busy = false;
      ch.arrivedAt = nowMs();
      ch.stage.classList.remove('is-playing');
      self.enterChapter(target);
      ch.activeVideo = null;
      // A dot clicked during the transition: jump there now.
      var queued = ch.queued;
      ch.queued = null;
      if (queued !== null && queued !== target) self.goChapter(queued, { fast: true });
    });
  };

  HeroScrollCar.prototype.leaveChapter = function (index) {
    var ch = this.chapters;
    this.closeHotspotCard();
    this.showChapterStop(null);
    this.showShelf(false);
    if (index === 0) {
      if (this.revealHero) this.revealHero();
      if (this.video && !this.video.paused) this.video.pause();
      if (this.audio && !this.audio.paused) this.audio.pause();
      ch.stage.classList.add('is-away');
    }
  };

  HeroScrollCar.prototype.enterChapter = function (index) {
    var ch = this.chapters;
    var point = ch.points[index];
    if (index === 0) ch.stage.classList.remove('is-away');
    this.sequence.target = index;
    this.resizeChapters();
    this.showChapterStop(point.stop ? point.stop.id : null);
    this.showShelf(!!point.showcase);
    this.updateChapterUI();
  };

  // The product row of the "Présentoir" shot: shown on arrival, out of the tab order otherwise.
  HeroScrollCar.prototype.showShelf = function (visible) {
    var shelf = this.chapters && this.chapters.shelf;
    if (!shelf) return;
    shelf.classList.toggle('is-visible', visible);
    shelf.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (visible) shelf.removeAttribute('inert');
    else shelf.setAttribute('inert', '');
  };

  // Wide screens: the bottom of the cards sits on the counter line of the video (in % of its height),
  // wherever the cover crop puts it. Narrow screens dock the row at the bottom instead (CSS).
  HeroScrollCar.prototype.positionShelf = function () {
    var ch = this.chapters;
    var seq = this.sequence;
    if (!ch || !ch.shelf || !seq || !seq.cover) return;
    var line = seq.cover.oy + (this.config.showcase.y / 100) * seq.cover.dh;
    var bottom = Math.max(12, Math.round(seq.height - line));
    ch.shelf.style.setProperty('--hsc-shelf-bottom', bottom + 'px');
  };

  // Shows the card (side card) or the hotspot (dot + line) of the stop `id`; null hides everything.
  HeroScrollCar.prototype.showChapterStop = function (id) {
    var seq = this.sequence;
    if (!seq) return;
    seq.activeStop = id;
    var stops = this.config.stops;
    for (var i = 0; i < stops.length; i++) {
      var stop = stops[i];
      var active = stop.id === id;
      if (stop.display === 'hotspot') {
        if (seq.hotspots[stop.id]) this.setHotspotVisible(seq.hotspots[stop.id], active);
        if (!active && seq.cards[stop.id]) this.setCardVisible(seq.cards[stop.id], false);
      } else if (seq.cards[stop.id]) {
        this.setCardVisible(seq.cards[stop.id], active);
      }
    }
  };

  // Frame-exact time for a stop: the middle of its frame, so every browser shows that frame.
  HeroScrollCar.prototype.chapterFrameTime = function (time) {
    var fps = this.chapters.fps;
    return (Math.round(time * fps) + 0.5) / fps;
  };

  // Time in the reversed video that shows the same frame as `time` in the forward one.
  HeroScrollCar.prototype.reverseTime = function (time) {
    var ch = this.chapters;
    var fps = ch.fps;
    var frames = Math.round((ch.rev.duration || ch.fwd.duration || 0) * fps);
    var index = Math.round(time * fps);
    return (Math.max(0, frames - 1 - index) + 0.5) / fps;
  };

  HeroScrollCar.prototype.seekVideo = function (video, time) {
    var ch = this.chapters;
    return new Promise(function (resolve) {
      var go = function () {
        if (Math.abs(video.currentTime - time) < 0.25 / ch.fps) { resolve(); return; }
        var done = false;
        var finish = function () {
          if (done) return;
          done = true;
          clearTimeout(timer);
          video.removeEventListener('seeked', finish);
          resolve();
        };
        var timer = setTimeout(finish, CHAPTER_SEEK_TIMEOUT_MS);
        video.addEventListener('seeked', finish);
        video.currentTime = time;
      };
      if (video.readyState >= 1) go();
      else video.addEventListener('loadedmetadata', go, { once: true });
    });
  };

  // Plays `video` until the frame at `end` is on screen, then pauses.
  HeroScrollCar.prototype.playVideoUntil = function (video, end) {
    var self = this;
    var ch = this.chapters;
    return new Promise(function (resolve) {
      var done = false;
      var timer = null;
      var finish = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        video.removeEventListener('ended', finish);
        video.pause();
        resolve();
      };
      // requestVideoFrameCallback stops firing once the last frame is shown: "ended" closes that gap.
      video.addEventListener('ended', finish);
      var threshold = end - 0.75 / ch.fps;
      var check = function (now, meta) {
        if (done) return;
        if (ch.destroyed) { finish(); return; }
        var t = meta && typeof meta.mediaTime === 'number' ? meta.mediaTime : video.currentTime;
        if (t >= threshold || video.ended) { finish(); return; }
        schedule();
      };
      var schedule = typeof video.requestVideoFrameCallback === 'function'
        ? function () { video.requestVideoFrameCallback(check); }
        : function () { requestAnimationFrame(function () { check(); }); };
      var start = function () {
        // Safety net: never leave the scene locked if the video stalls.
        timer = setTimeout(finish, Math.max(0, end - video.currentTime) / (video.playbackRate || 1) * 1000 + 8000);
        var promise = video.play();
        if (promise && typeof promise.catch === 'function') {
          promise.catch(function () {
            if (video.muted) { finish(); return; }
            // Sound refused by the browser (no click yet): continue muted, sound comes at the first click.
            video.muted = true;
            self.markSoundBlocked();
            video.play().catch(finish);
          });
        }
        schedule();
      };
      if (video.currentTime >= threshold) { finish(); return; }
      start();
    });
  };

  HeroScrollCar.prototype.boostChapter = function () {
    var ch = this.chapters;
    if (!ch || !ch.activeVideo) return;
    ch.boosts += 1;
    ch.activeVideo.playbackRate = Math.min(ch.activeRate * Math.pow(CHAPTER_BOOST, ch.boosts), CHAPTER_MAX_RATE);
  };

  // Playback speed of the segment between chapters a and b: the speed set on the stop that ends it
  // (going forward), or the general speed.
  HeroScrollCar.prototype.segmentRate = function (a, b) {
    var point = this.chapters.points[Math.max(a, b)];
    var rate = point ? (point.stop ? point.stop.rate : point.rate) : NaN;
    return rate > 0 ? clamp(rate, 0.5, 6) : this.config.chapterRate;
  };

  // Mobile: the crop of the 16:9 video glides toward the next stop's focus while the video plays.
  HeroScrollCar.prototype.panChapterFocus = function (target, seconds) {
    var ch = this.chapters;
    var focus = this.compact ? ch.points[target].focus : 50;
    ch.stage.style.setProperty('--hsc-pan-dur', Math.max(0, seconds).toFixed(2) + 's');
    ch.stage.style.setProperty('--hsc-focus', focus + '%');
  };

  HeroScrollCar.prototype.playChapterForward = function (fromTime, toTime, target, rateOverride) {
    var self = this;
    var ch = this.chapters;
    var video = ch.fwd;
    var rate = rateOverride || this.segmentRate(target - 1, target);
    return this.seekVideo(video, this.chapterFrameTime(fromTime)).then(function () {
      if (ch.destroyed) return;
      ch.stage.classList.remove('is-reversing');
      video.playbackRate = rate;
      video.muted = !self.soundOn || self.soundBlocked || !!rateOverride; // no chipmunk soundtrack while fast-forwarding
      ch.activeVideo = video;
      ch.activeRate = rate;
      self.panChapterFocus(target, (toTime - fromTime) / rate);
      return self.playVideoUntil(video, Math.round(toTime * ch.fps) / ch.fps);
    }).then(function () {
      if (ch.destroyed) return;
      return self.seekVideo(video, self.chapterFrameTime(toTime));
    });
  };

  HeroScrollCar.prototype.playChapterBackward = function (fromTime, toTime, target, rateOverride) {
    var self = this;
    var ch = this.chapters;
    var rev = ch.rev;
    if (!rev || rev.readyState < 1 || !rev.duration) {
      if (rev) ch.loadReverse();
      return this.cutChapterTo(toTime, target);
    }
    var startTime = this.reverseTime(fromTime);
    var endTime = this.reverseTime(toTime);
    var rate = rateOverride || this.segmentRate(target, target + 1);
    return this.seekVideo(rev, startTime).then(function () {
      if (ch.destroyed) return;
      rev.playbackRate = rate;
      ch.activeVideo = rev;
      ch.activeRate = rate;
      ch.stage.classList.add('is-reversing'); // same frame as the forward video: the swap is invisible
      self.panChapterFocus(target, (fromTime - toTime) / rate);
      return self.playVideoUntil(rev, endTime - 0.5 / ch.fps);
    }).then(function () {
      if (ch.destroyed) return;
      return self.seekVideo(ch.fwd, self.chapterFrameTime(toTime));
    }).then(function () {
      if (ch.destroyed) return;
      ch.stage.classList.remove('is-reversing');
    });
  };

  // Direct jump (dots, theme editor, or no reverse video): short fade, seek, fade back.
  HeroScrollCar.prototype.cutChapterTo = function (toTime, target) {
    var self = this;
    var ch = this.chapters;
    ch.stage.classList.add('is-cutting');
    return new Promise(function (resolve) { setTimeout(resolve, CHAPTER_CUT_MS); }).then(function () {
      if (ch.destroyed) return;
      ch.stage.classList.remove('is-reversing');
      ch.fwd.pause();
      self.panChapterFocus(target, 0);
      return self.seekVideo(ch.fwd, self.chapterFrameTime(toTime));
    }).then(function () {
      if (ch.destroyed) return;
      ch.stage.classList.remove('is-cutting');
    });
  };

  HeroScrollCar.prototype.resizeChapters = function () {
    var ch = this.chapters;
    var seq = this.sequence;
    if (!ch || !seq) return;
    var rect = ch.stage.getBoundingClientRect();
    var width = Math.round(rect.width);
    var height = Math.round(rect.height);
    if (!width || !height) return;
    var videoWidth = ch.fwd.videoWidth || 1920;
    var videoHeight = ch.fwd.videoHeight || 1080;
    var scale = Math.max(width / videoWidth, height / videoHeight);
    var drawWidth = videoWidth * scale;
    var drawHeight = videoHeight * scale;
    var focus = this.compact ? ch.points[ch.busy ? ch.pending : ch.index].focus : 50;
    if (!ch.busy) {
      ch.stage.style.setProperty('--hsc-pan-dur', '0s');
      ch.stage.style.setProperty('--hsc-focus', focus + '%');
    }
    seq.width = width;
    seq.height = height;
    seq.cover = { ox: (width - drawWidth) * focus / 100, oy: (height - drawHeight) / 2, dw: drawWidth, dh: drawHeight };
    this.positionHotspots();
    this.positionShelf();
    if (seq.openCard) this.placeHotspotCard(seq.openCard);
  };

  HeroScrollCar.prototype.buildChapterNav = function () {
    var ch = this.chapters;
    var nav = ch.nav;
    if (!nav) return;
    var texts = this.config.texts;
    var html = '<button type="button" class="hsc-chapters__arrow" data-hsc-prev aria-label="' + escapeAttr(texts.prev || '') + '">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      '<ol class="hsc-chapters__dots">';
    for (var i = 0; i < ch.points.length; i++) {
      var label = ch.points[i].label || String(i + 1);
      html += '<li><button type="button" class="hsc-chapters__dot" data-hsc-dot data-index="' + i + '" aria-label="' + escapeAttr(label) + '" title="' + escapeAttr(label) + '"><i></i></button></li>';
    }
    html += '</ol><button type="button" class="hsc-chapters__arrow" data-hsc-next aria-label="' + escapeAttr(texts.next || '') + '">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      '<button type="button" class="hsc-chapters__skip" data-hsc-skip>' + escapeHtml(texts.skip || '') + '</button>';
    nav.innerHTML = html;
  };

  HeroScrollCar.prototype.updateChapterUI = function () {
    var ch = this.chapters;
    if (!ch || !ch.nav) return;
    var current = ch.busy ? ch.pending : ch.index;
    var dots = ch.nav.querySelectorAll('[data-hsc-dot]');
    for (var i = 0; i < dots.length; i++) {
      var active = i === current;
      dots[i].classList.toggle('is-active', active);
      if (active) dots[i].setAttribute('aria-current', 'step');
      else dots[i].removeAttribute('aria-current');
    }
    var prev = ch.nav.querySelector('[data-hsc-prev]');
    var next = ch.nav.querySelector('[data-hsc-next]');
    if (prev) prev.disabled = current === 0;
    if (next) next.disabled = current === ch.points.length - 1;
    this.setAttribute('data-chapter', String(current));
  };

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function escapeAttr(value) { return escapeHtml(value); }

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
    var card = button.closest('.hsc-card, [data-hsc-item]');
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
      if (self.chapters && event.target.closest('[data-hsc-shelf]')) {
        // "Présentoir" block: straight to the last shot, where its cards are.
        self.pinChapters();
        self.goChapter(self.chapters.points.length - 1, { fast: true });
        return;
      }
      var card = event.target.closest('[data-stop-id]');
      if (!card) return;
      var id = card.getAttribute('data-stop-id');
      if (self.chapters) {
        var points = self.chapters.points;
        for (var c = 0; c < points.length; c++) {
          if (points[c].stop && points[c].stop.id === id) {
            self.pinChapters();
            self.goChapter(c, { fast: true });
            if (points[c].stop.display === 'hotspot') setTimeout(function () { self.openHotspotCard(id); }, 900);
          }
        }
        return;
      }
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

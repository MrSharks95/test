/* Hero glass header — sticky behaviour, mobile drawer, search panel, touch dropdowns. */
(function () {
  'use strict';

  if (typeof window === 'undefined' || !('customElements' in window) || customElements.get('hero-glass-header')) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var noHover = window.matchMedia('(hover: none)');

  function GlassHeader() {
    return Reflect.construct(HTMLElement, [], GlassHeader);
  }
  GlassHeader.prototype = Object.create(HTMLElement.prototype);
  GlassHeader.prototype.constructor = GlassHeader;

  GlassHeader.prototype.connectedCallback = function () {
    var self = this;
    this.bar = this.querySelector('[data-ghd-bar]');
    this.burger = this.querySelector('[data-ghd-burger]');
    this.drawer = this.querySelector('[data-ghd-drawer]');
    this.searchToggle = this.querySelector('[data-ghd-search-toggle]');
    this.searchPanel = this.querySelector('[data-ghd-search]');
    this.stickyMode = this.getAttribute('data-sticky') || 'on-scroll-up';
    this.menuOpen = false;
    this.searchOpen = false;
    this.lastY = window.scrollY || 0;
    this.ticking = false;

    this.onScroll = function () {
      if (self.ticking) return;
      self.ticking = true;
      requestAnimationFrame(function () { self.ticking = false; self.updateScroll(); });
    };
    this.onKey = function (event) {
      if (event.key === 'Tab' && self.menuOpen) { self.trapTab(event); return; }
      if (event.key !== 'Escape') return;
      if (self.menuOpen) { self.toggleMenu(false); if (self.burger) self.burger.focus(); }
      else if (self.searchOpen) { self.toggleSearch(false); if (self.searchToggle) self.searchToggle.focus(); }
    };
    this.onDocClick = function (event) {
      if (self.searchOpen && !event.target.closest('[data-ghd-search], [data-ghd-search-toggle]')) self.toggleSearch(false);
      var open = self.querySelector('.ghd__item.is-open');
      if (open && !open.contains(event.target)) open.classList.remove('is-open');
    };
    this.onResize = function () { self.measure(); };

    this.measure();
    this.updateScroll();
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onResize);
    document.addEventListener('keydown', this.onKey);
    document.addEventListener('click', this.onDocClick);

    if (this.burger) this.burger.addEventListener('click', function () { self.toggleMenu(!self.menuOpen); });
    var closers = this.querySelectorAll('[data-ghd-close]');
    for (var i = 0; i < closers.length; i++) closers[i].addEventListener('click', function () { self.toggleMenu(false); });

    if (this.searchToggle) this.searchToggle.addEventListener('click', function () { self.toggleSearch(!self.searchOpen); });
    var searchClose = this.querySelector('[data-ghd-search-close]');
    if (searchClose) searchClose.addEventListener('click', function () { self.toggleSearch(false); if (self.searchToggle) self.searchToggle.focus(); });

    // Touch screens: the first tap on a parent link opens its dropdown instead of leaving the page.
    var parents = this.querySelectorAll('.ghd__item--has-children > .ghd__link');
    for (var p = 0; p < parents.length; p++) {
      parents[p].addEventListener('click', function (event) {
        if (!noHover.matches) return;
        var item = this.parentNode;
        if (item.classList.contains('is-open')) return;
        event.preventDefault();
        var others = self.querySelectorAll('.ghd__item.is-open');
        for (var k = 0; k < others.length; k++) others[k].classList.remove('is-open');
        item.classList.add('is-open');
      });
    }

    // Theme editor: keep the bar visible while it is being edited.
    this.onEditorSelect = function (event) { if (event.target && event.target.contains(self)) self.classList.remove('is-hidden'); };
    document.addEventListener('shopify:section:select', this.onEditorSelect);
  };

  GlassHeader.prototype.disconnectedCallback = function () {
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('keydown', this.onKey);
    document.removeEventListener('click', this.onDocClick);
    document.removeEventListener('shopify:section:select', this.onEditorSelect);
    this.toggleMenu(false);
  };

  // Tab stays inside the open mobile drawer.
  GlassHeader.prototype.trapTab = function (event) {
    if (!this.drawer) return;
    var nodes = this.drawer.querySelectorAll('a[href], button:not([disabled]), summary, input:not([disabled]), [tabindex]:not([tabindex="-1"])');
    var list = [];
    for (var i = 0; i < nodes.length; i++) if (nodes[i].offsetParent !== null) list.push(nodes[i]);
    if (!list.length) return;
    var first = list[0];
    var last = list[list.length - 1];
    var active = document.activeElement;
    if (event.shiftKey && (active === first || !this.drawer.contains(active))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (active === last || !this.drawer.contains(active))) { event.preventDefault(); first.focus(); }
  };

  // Publishes the header height for other sections (e.g. to offset content under an overlaid header).
  GlassHeader.prototype.measure = function () {
    var inner = this.querySelector('.ghd__inner');
    var h = inner ? Math.round(inner.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty('--hero-header-height', h + 'px');
  };

  GlassHeader.prototype.updateScroll = function () {
    var y = window.scrollY || 0;
    this.classList.toggle('is-scrolled', y > 8);
    var hidden = false;
    if (this.stickyMode === 'on-scroll-up' && !this.menuOpen && !this.searchOpen) {
      hidden = y > this.lastY + 2 && y > 140;
      if (y < this.lastY - 2 || y <= 140) hidden = false;
      if (y === this.lastY) hidden = this.classList.contains('is-hidden');
    }
    this.classList.toggle('is-hidden', hidden);
    this.lastY = y;
  };

  GlassHeader.prototype.toggleMenu = function (open) {
    if (!this.drawer || open === this.menuOpen) return;
    this.menuOpen = open;
    this.classList.toggle('is-menu-open', open);
    this.classList.remove('is-hidden');
    this.drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (this.burger) this.burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.documentElement.classList.toggle('ghd-lock', open);
    if (open) {
      if (this.searchOpen) this.toggleSearch(false);
      var first = this.drawer.querySelector('a, button, summary');
      var self = this;
      setTimeout(function () { if (first && self.menuOpen) first.focus({ preventScroll: true }); }, reduceMotion.matches ? 0 : 250);
    }
  };

  GlassHeader.prototype.toggleSearch = function (open) {
    if (!this.searchPanel || open === this.searchOpen) return;
    this.searchOpen = open;
    var panel = this.searchPanel;
    if (this.searchToggle) this.searchToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      this.classList.remove('is-hidden');
      panel.hidden = false;
      // next frame so the transition runs
      requestAnimationFrame(function () { panel.classList.add('is-open'); });
      var input = panel.querySelector('input[type="search"]');
      if (input) input.focus({ preventScroll: true });
    } else {
      panel.classList.remove('is-open');
      var delay = reduceMotion.matches ? 0 : 260;
      setTimeout(function () { if (!panel.classList.contains('is-open')) panel.hidden = true; }, delay);
    }
  };

  customElements.define('hero-glass-header', GlassHeader);
})();

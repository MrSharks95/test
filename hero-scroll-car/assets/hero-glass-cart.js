/* Hero glass cart — opens from the header icon, after an add to cart, and in place of the theme's drawer;
   quantity changes go through /cart/change.js and the Section Rendering API. */
(function () {
  'use strict';

  if (typeof window === 'undefined' || !('customElements' in window) || customElements.get('hero-glass-cart')) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

  function GlassCart() {
    return Reflect.construct(HTMLElement, [], GlassCart);
  }
  GlassCart.prototype = Object.create(HTMLElement.prototype);
  GlassCart.prototype.constructor = GlassCart;

  GlassCart.prototype.connectedCallback = function () {
    var self = this;
    this.sectionId = this.getAttribute('data-section-id') || '';
    this.base = (this.getAttribute('data-root') || '/').replace(/\/$/, '');
    this.panel = this.querySelector('[data-gct-panel]');
    this.content = this.querySelector('[data-gct-content]');
    this.isOpen = false;
    this.busy = false;
    this.opener = null;

    this.addEventListener('click', function (event) {
      var target = event.target;
      if (target.closest('[data-gct-close]')) { event.preventDefault(); self.close(); return; }
      var item = target.closest('[data-gct-item]');
      if (!item) return;
      if (target.closest('[data-gct-plus]')) self.change(item, self.quantityOf(item) + 1);
      else if (target.closest('[data-gct-minus]')) self.change(item, self.quantityOf(item) - 1);
      else if (target.closest('[data-gct-remove]')) self.change(item, 0);
    });
    this.addEventListener('change', function (event) {
      var input = event.target.closest('[data-gct-input]');
      if (!input) return;
      var value = parseInt(input.value, 10);
      if (isNaN(value)) { input.value = input.getAttribute('value') || '1'; return; } // an emptied field keeps its quantity
      self.change(input.closest('[data-gct-item]'), value);
    });

    this.onKey = function (event) {
      if (!self.isOpen) return;
      if (event.key === 'Escape') { event.preventDefault(); self.close(); }
      else if (event.key === 'Tab') self.trapTab(event);
    };
    document.addEventListener('keydown', this.onKey);

    // The header's cart icon (and any [data-glass-cart-open]) opens this drawer. Capture phase: the theme's
    // own drawer, which listens on the same icon, never sees the click.
    this.onIconClick = function (event) {
      var link = event.target.closest('#cart-icon-bubble, [data-glass-cart-open]');
      if (!link) return;
      event.preventDefault();
      event.stopPropagation();
      self.open(link);
      self.refresh(false);
    };
    document.addEventListener('click', this.onIconClick, true);

    // Dawn-style themes publish every cart change (product forms, quick add): follow them.
    this.unsubscribe = null;
    if (typeof window.subscribe === 'function' && window.PUB_SUB_EVENTS && window.PUB_SUB_EVENTS.cartUpdate) {
      this.unsubscribe = window.subscribe(window.PUB_SUB_EVENTS.cartUpdate, function (event) {
        var source = event && event.source;
        if (source === 'hero-glass-cart' || source === 'hero-scroll-car') return; // ours, or already covered by cart:added
        // Only an add (product form, quick add) opens the drawer; quantity edits on the cart page just refresh it.
        var opens = source === 'product-form' || source === 'quick-add' || source === 'quick-add-modal';
        self.refresh(opens && self.autoOpen());
      });
    }

    // The theme opens its drawer after an add to cart on product pages: swap it for this one.
    this.onThemeOpen = function () {
      var theme = document.querySelector('cart-drawer');
      if (theme && typeof theme.close === 'function') { try { theme.close(); } catch (error) { /* ignore */ } }
      document.body.classList.remove('overflow-hidden');
      if (self.unsubscribe) self.open(); else self.refresh(true);
    };
    document.addEventListener('cart:open', this.onThemeOpen);

    // The hero section (and anything else) announces its adds.
    this.onAdded = function () { self.refresh(self.autoOpen()); };
    document.addEventListener('cart:added', this.onAdded);

    // Theme editor: show the drawer while it is being customised.
    this.onEditorSelect = function (event) { if (event.target && event.target.contains(self)) self.open(); };
    this.onEditorDeselect = function (event) { if (event.target && event.target.contains(self)) self.close(); };
    document.addEventListener('shopify:section:select', this.onEditorSelect);
    document.addEventListener('shopify:section:deselect', this.onEditorDeselect);
  };

  GlassCart.prototype.disconnectedCallback = function () {
    document.removeEventListener('keydown', this.onKey);
    document.removeEventListener('click', this.onIconClick, true);
    document.removeEventListener('cart:open', this.onThemeOpen);
    document.removeEventListener('cart:added', this.onAdded);
    document.removeEventListener('shopify:section:select', this.onEditorSelect);
    document.removeEventListener('shopify:section:deselect', this.onEditorDeselect);
    if (typeof this.unsubscribe === 'function') this.unsubscribe();
    this.close();
  };

  GlassCart.prototype.autoOpen = function () {
    var theme = window.themeSettings && window.themeSettings.cart;
    if (theme && theme.auto_open_drawer === false) return false;
    return this.getAttribute('data-auto-open') !== 'false';
  };

  GlassCart.prototype.open = function (opener) {
    if (this.isOpen) return;
    this.isOpen = true;
    this.opener = opener || document.activeElement;
    this.classList.add('is-open');
    this.panel.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('gct-lock');
    var self = this;
    setTimeout(function () {
      if (!self.isOpen) return;
      var close = self.querySelector('.gct__close');
      (close || self.panel).focus({ preventScroll: true });
    }, reduceMotion.matches ? 0 : 200);
  };

  GlassCart.prototype.close = function () {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.classList.remove('is-open');
    this.panel.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('gct-lock');
    var opener = this.opener;
    this.opener = null;
    if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus({ preventScroll: true });
  };

  GlassCart.prototype.trapTab = function (event) {
    var nodes = this.panel.querySelectorAll(FOCUSABLE);
    var list = [];
    for (var i = 0; i < nodes.length; i++) if (nodes[i].offsetParent !== null) list.push(nodes[i]);
    if (!list.length) return;
    var first = list[0];
    var last = list[list.length - 1];
    if (event.shiftKey && (document.activeElement === first || !this.panel.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  GlassCart.prototype.quantityOf = function (item) {
    var input = item.querySelector('[data-gct-input]');
    return input ? (parseInt(input.value, 10) || 0) : 0;
  };

  GlassCart.prototype.message = function (text) {
    var box = this.querySelector('[data-gct-msg]');
    if (!box) return;
    box.textContent = text || '';
    box.hidden = !text;
  };

  // Changes one line (quantity 0 removes it) and swaps the drawer's content with the re-rendered section.
  GlassCart.prototype.change = function (item, quantity) {
    if (!item || this.busy) return;
    var self = this;
    var line = parseInt(item.getAttribute('data-line'), 10);
    if (!line) return;
    this.busy = true;
    this.classList.add('is-busy');
    item.classList.add('is-busy');
    this.message('');
    fetch(this.base + '/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ line: line, quantity: Math.max(0, quantity), sections: [this.sectionId, 'cart-icon-bubble'], sections_url: this.base + '/' })
    })
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) { return { ok: response.ok, data: data }; });
      })
      .then(function (result) {
        if (!result.ok) {
          self.message(result.data.description || result.data.message || 'Impossible de mettre à jour le panier.');
          item.classList.remove('is-busy');
          return;
        }
        self.applySections(result.data.sections || {});
        self.announce(result.data);
        // 200 with `errors`: Shopify capped the quantity to the available stock
        if (result.data.errors) self.message(typeof result.data.errors === 'string' ? result.data.errors : 'Quantité limitée par le stock disponible.');
      })
      .catch(function () {
        self.message('Impossible de mettre à jour le panier.');
        item.classList.remove('is-busy');
      })
      .then(function () {
        self.busy = false;
        self.classList.remove('is-busy');
      });
  };

  // Re-renders from the server (after an add made elsewhere) and optionally opens.
  GlassCart.prototype.refresh = function (openAfter) {
    var self = this;
    if (!this.sectionId) { if (openAfter) this.open(); return Promise.resolve(); }
    return fetch(this.base + '/?sections=' + encodeURIComponent(this.sectionId + ',cart-icon-bubble'), { headers: { 'Accept': 'application/json' } })
      .then(function (response) { return response.ok ? response.json() : {}; })
      .catch(function () { return {}; })
      .then(function (sections) {
        self.applySections(sections || {});
        if (openAfter) self.open();
      });
  };

  GlassCart.prototype.applySections = function (sections) {
    var html = sections[this.sectionId];
    if (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var fresh = doc.querySelector('[data-gct-content]');
      if (fresh && this.content) this.content.innerHTML = fresh.innerHTML;
      var count = doc.querySelector('[data-gct-count]');
      var mine = this.querySelector('[data-gct-count]');
      if (count && mine) mine.textContent = count.textContent;
    }
    var bubbleHtml = sections['cart-icon-bubble'];
    var bubble = document.getElementById('cart-icon-bubble');
    if (bubbleHtml && bubble) {
      var parsed = new DOMParser().parseFromString(bubbleHtml, 'text/html');
      var section = parsed.querySelector('.shopify-section');
      bubble.innerHTML = section ? section.innerHTML : bubbleHtml;
    }
  };

  GlassCart.prototype.announce = function (cart) {
    if (!cart || typeof cart.item_count !== 'number') return;
    var counters = document.querySelectorAll('[data-cart-count], [data-header-cart-count]');
    for (var i = 0; i < counters.length; i++) counters[i].textContent = cart.item_count;
    document.dispatchEvent(new CustomEvent('cart:updated', { detail: { source: 'hero-glass-cart', cart: cart } }));
  };

  customElements.define('hero-glass-cart', GlassCart);
})();

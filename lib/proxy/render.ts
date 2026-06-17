import type { Locale, ProxyDict } from "@/lib/i18n/proxy";

/** Escape text for safe insertion into server-rendered HTML. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Self-contained HTML page for the public withdrawal form, served via the App
 * Proxy. Three views (details → items → confirmation) driven by inline vanilla
 * JS. All AJAX posts back to the current proxied path so Shopify re-signs each
 * request (signature verified server-side on every call).
 */
export function renderFormPage(locale: Locale, dict: ProxyDict): string {
  const dictJson = JSON.stringify(dict).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(dict.title)}</title>
<style>
  :root { --fg:#1a1a2e; --muted:#6b7280; --border:#e5e7eb; --primary:#1a1a2e; }
  * { box-sizing:border-box; }
  body { font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; color:var(--fg); margin:0; background:#f8fafc; }
  .wrap { max-width:560px; margin:0 auto; padding:2rem 1.25rem; }
  h1 { font-size:1.5rem; margin:0 0 .25rem; }
  h2 { font-size:1.15rem; margin:1.5rem 0 .75rem; }
  p.intro { color:var(--muted); margin:0 0 1rem; }
  label { display:block; margin:.75rem 0; font-weight:600; font-size:.9rem; }
  input, textarea { width:100%; margin-top:.35rem; padding:.6rem .7rem; border:1px solid var(--border); border-radius:.5rem; font:inherit; font-weight:400; }
  textarea { min-height:80px; resize:vertical; }
  button { font:inherit; font-weight:600; padding:.65rem 1.1rem; border-radius:.5rem; border:0; cursor:pointer; }
  .btn-primary { background:var(--primary); color:#fff; }
  .btn-ghost { background:transparent; color:var(--fg); border:1px solid var(--border); }
  .actions { display:flex; gap:.6rem; margin-top:1.25rem; }
  .banner { background:#eef2ff; border-radius:.5rem; padding:.6rem .75rem; font-size:.9rem; }
  .item-row { display:flex; gap:.5rem; align-items:center; margin:.4rem 0; }
  .item-row input[type=text] { flex:1; margin:0; }
  .item-row input[type=number] { width:72px; margin:0; }
  .err { color:#b91c1c; font-size:.85rem; }
  .ref { font-size:1.25rem; margin-top:1rem; }
  [hidden] { display:none !important; }
</style>
</head>
<body>
<main class="wrap">
  <h1>${esc(dict.title)}</h1>
  <p class="intro">${esc(dict.intro)}</p>

  <section id="step1">
    <h2>${esc(dict.step1Title)}</h2>
    <label>${esc(dict.nameLabel)}<input id="f-name" type="text" autocomplete="name" /></label>
    <label>${esc(dict.orderLabel)} *<input id="f-order" type="text" required /></label>
    <label>${esc(dict.emailLabel)} *<input id="f-email" type="email" required autocomplete="email" /></label>
    <p class="err" id="err1" hidden></p>
    <div class="actions"><button class="btn-primary" id="btn-continue" type="button">${esc(dict.continue)}</button></div>
  </section>

  <section id="step2" hidden>
    <h2>${esc(dict.step2Title)}</h2>
    <p class="banner" id="banner"></p>
    <div id="items"></div>
    <button class="btn-ghost" id="btn-add" type="button" hidden>${esc(dict.addItem)}</button>
    <label>${esc(dict.reasonLabel)}<textarea id="f-reason" placeholder="${esc(dict.reasonPlaceholder)}"></textarea></label>
    <p class="err" id="err2" hidden></p>
    <div class="actions">
      <button class="btn-ghost" id="btn-back" type="button">${esc(dict.back)}</button>
      <button class="btn-primary" id="btn-submit" type="button">${esc(dict.submit)}</button>
    </div>
  </section>

  <section id="step3" hidden>
    <h2>${esc(dict.step3Title)}</h2>
    <p>${esc(dict.confirmation)}</p>
    <p class="ref">${esc(dict.referenceLabel)} : <strong id="ref"></strong></p>
  </section>
</main>

<script type="application/json" id="dict">${dictJson}</script>
<script>
(function(){
  var D = JSON.parse(document.getElementById('dict').textContent);
  var ENDPOINT = window.location.pathname; // proxied path → Shopify re-signs
  var state = { orderVerified:false, country:null, shopifyOrderId:null, shippedAt:null, category:'standard' };
  var $ = function(id){ return document.getElementById(id); };

  function show(n){ ['step1','step2','step3'].forEach(function(s,i){ $(s).hidden = (i !== n); }); }

  function post(payload){
    return fetch(ENDPOINT, {
      method:'POST',
      headers:{ 'content-type':'application/json' },
      body: JSON.stringify(payload)
    }).then(function(r){ if(!r.ok) throw new Error('http'); return r.json(); });
  }

  function itemTitlePlaceholder(){ return D.itemTitlePlaceholder; }

  function addManualRow(){
    var row = document.createElement('div'); row.className = 'item-row';
    var t = document.createElement('input'); t.type='text'; t.placeholder = itemTitlePlaceholder(); t.className='it-title';
    var q = document.createElement('input'); q.type='number'; q.min='1'; q.value='1'; q.className='it-qty'; q.setAttribute('aria-label', D.qtyPlaceholder);
    row.appendChild(t); row.appendChild(q);
    $('items').appendChild(row);
  }

  function renderVerifiedItems(items){
    var box = $('items'); box.innerHTML='';
    items.forEach(function(it){
      var row = document.createElement('label'); row.className='item-row';
      var cb = document.createElement('input'); cb.type='checkbox'; cb.checked=true; cb.className='it-check';
      cb.dataset.title = it.title; cb.dataset.qty = it.quantity; cb.dataset.line = it.lineItemId || '';
      var span = document.createElement('span'); span.textContent = it.title + ' (×' + it.quantity + ')';
      row.appendChild(cb); row.appendChild(span);
      box.appendChild(row);
    });
  }

  function collectItems(){
    if (state.orderVerified) {
      return Array.prototype.map.call(document.querySelectorAll('.it-check'), function(cb){
        return cb.checked ? { title: cb.dataset.title, quantity: Number(cb.dataset.qty), lineItemId: cb.dataset.line || null } : null;
      }).filter(Boolean);
    }
    return Array.prototype.map.call(document.querySelectorAll('#items .item-row'), function(row){
      var title = row.querySelector('.it-title').value.trim();
      var qty = Number(row.querySelector('.it-qty').value) || 1;
      return title ? { title: title, quantity: qty } : null;
    }).filter(Boolean);
  }

  $('btn-continue').addEventListener('click', function(){
    var order = $('f-order').value.trim();
    var email = $('f-email').value.trim();
    if (!order || !email) { $('err1').textContent = D.requiredError; $('err1').hidden=false; return; }
    $('err1').hidden=true; this.disabled=true;
    post({ action:'verify_order', name:$('f-name').value.trim(), orderNumber:order, email:email })
      .then(function(res){
        state.orderVerified = !!res.order_verified;
        state.country = res.country || null;
        state.shopifyOrderId = res.shopify_order_id || null;
        state.shippedAt = res.shipped_at || null;
        state.category = res.category || 'standard';
        $('banner').textContent = state.orderVerified ? D.verifiedBanner : D.manualBanner;
        if (state.orderVerified) { renderVerifiedItems(res.items || []); $('btn-add').hidden=true; }
        else { $('items').innerHTML=''; addManualRow(); $('btn-add').hidden=false; }
        show(1);
      })
      .catch(function(){ $('err1').textContent = D.genericError; $('err1').hidden=false; })
      .finally(function(){ $('btn-continue').disabled=false; });
  });

  $('btn-add').addEventListener('click', addManualRow);
  $('btn-back').addEventListener('click', function(){ show(0); });

  $('btn-submit').addEventListener('click', function(){
    var items = collectItems();
    if (items.length === 0) { $('err2').textContent = D.requiredError; $('err2').hidden=false; return; }
    $('err2').hidden=true; this.disabled=true;
    post({
      action:'submit',
      name:$('f-name').value.trim(),
      orderNumber:$('f-order').value.trim(),
      email:$('f-email').value.trim(),
      orderVerified: state.orderVerified,
      country: state.country,
      shopifyOrderId: state.shopifyOrderId,
      shippedAt: state.shippedAt,
      category: state.category,
      reason: $('f-reason').value.trim(),
      items: items
    })
      .then(function(res){ $('ref').textContent = res.reference; show(2); })
      .catch(function(){ $('err2').textContent = D.genericError; $('err2').hidden=false; })
      .finally(function(){ $('btn-submit').disabled=false; });
  });
})();
</script>
</body>
</html>`;
}

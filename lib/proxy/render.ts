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
 * Self-contained, styled HTML page for the public withdrawal form, served via
 * the App Proxy. Three views (details → items → confirmation) with a step
 * indicator, driven by inline vanilla JS. All AJAX posts back to the current
 * proxied path so Shopify re-signs each request (verified server-side).
 */
export function renderFormPage(locale: Locale, dict: ProxyDict): string {
  const dictJson = JSON.stringify(dict).replace(/</g, "\\u003c");
  const step1 = locale === "fr" ? "Coordonnées" : "Details";
  const step2 = locale === "fr" ? "Articles" : "Items";
  const step3 = locale === "fr" ? "Confirmation" : "Done";
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(dict.title)}</title>
<style>
  :root {
    --bg:#f1f5f9; --card:#ffffff; --fg:#0f172a; --muted:#64748b;
    --border:#e2e8f0; --primary:#0f172a; --primary-fg:#ffffff;
    --accent:#4f46e5; --ok:#16a34a; --err:#dc2626; --radius:14px;
  }
  * { box-sizing:border-box; }
  html,body { margin:0; }
  body {
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    color:var(--fg); background:var(--bg);
    display:flex; justify-content:center; align-items:flex-start;
    padding:24px 16px; min-height:100vh;
  }
  .eu-card {
    width:100%; max-width:480px; background:var(--card);
    border:1px solid var(--border); border-radius:var(--radius);
    box-shadow:0 10px 30px -12px rgba(15,23,42,.18); padding:28px;
  }
  .eu-title { font-size:1.35rem; font-weight:700; margin:0 0 4px; letter-spacing:-.01em; }
  .eu-intro { color:var(--muted); font-size:.9rem; margin:0 0 22px; line-height:1.5; }

  /* Stepper */
  .eu-steps { list-style:none; display:flex; gap:0; padding:0; margin:0 0 26px; }
  .eu-step { flex:1; display:flex; flex-direction:column; align-items:center; position:relative; }
  .eu-step::before {
    content:""; position:absolute; top:13px; left:-50%; width:100%; height:2px;
    background:var(--border); z-index:0;
  }
  .eu-step:first-child::before { display:none; }
  .eu-step.is-done::before, .eu-step.is-active::before { background:var(--accent); }
  .eu-dot {
    width:28px; height:28px; border-radius:50%; display:flex; align-items:center;
    justify-content:center; font-size:.8rem; font-weight:700; background:#fff;
    border:2px solid var(--border); color:var(--muted); position:relative; z-index:1;
  }
  .eu-step.is-active .eu-dot { border-color:var(--accent); color:var(--accent); }
  .eu-step.is-done .eu-dot { background:var(--accent); border-color:var(--accent); color:#fff; }
  .eu-step-label { font-size:.72rem; color:var(--muted); margin-top:6px; font-weight:600; }
  .eu-step.is-active .eu-step-label { color:var(--fg); }

  label.eu-field { display:block; margin:14px 0; font-weight:600; font-size:.82rem; color:#334155; }
  .eu-field input, .eu-field textarea, #items input {
    width:100%; margin-top:6px; padding:11px 12px; font:inherit; font-weight:400;
    border:1px solid var(--border); border-radius:10px; background:#fff; color:var(--fg);
    transition:border-color .15s, box-shadow .15s;
  }
  .eu-field input:focus, .eu-field textarea:focus, #items input:focus {
    outline:none; border-color:var(--accent); box-shadow:0 0 0 3px rgba(79,70,229,.12);
  }
  textarea { min-height:84px; resize:vertical; }
  .eu-req { color:var(--accent); }

  button { font:inherit; font-weight:600; border-radius:10px; cursor:pointer; border:0; }
  .eu-btn-primary { background:var(--primary); color:var(--primary-fg); padding:12px 18px; width:100%; transition:opacity .15s; }
  .eu-btn-primary:hover { opacity:.92; }
  .eu-btn-primary:disabled { opacity:.5; cursor:default; }
  .eu-btn-ghost { background:#fff; color:var(--fg); border:1px solid var(--border); padding:12px 18px; }
  .eu-btn-ghost:hover { background:#f8fafc; }
  .eu-actions { display:flex; gap:10px; margin-top:22px; }
  .eu-actions .eu-btn-primary { flex:1; }

  .eu-banner { display:flex; gap:8px; align-items:flex-start; background:#eef2ff; color:#3730a3;
    border-radius:10px; padding:11px 13px; font-size:.85rem; line-height:1.4; margin-bottom:14px; }
  .eu-banner.warn { background:#fff7ed; color:#9a3412; }

  #items { margin-top:6px; }
  .item-row { display:flex; gap:8px; align-items:center; margin:8px 0; }
  .item-row.check { background:#f8fafc; border:1px solid var(--border); border-radius:10px; padding:10px 12px; cursor:pointer; }
  .item-row input[type=text] { flex:1; margin:0; }
  .item-row input[type=number] { width:76px; margin:0; text-align:center; }
  .item-row input[type=checkbox] { width:18px; height:18px; accent-color:var(--accent); }
  .item-row span { font-size:.9rem; }
  .eu-add { background:none; border:1px dashed var(--border); color:var(--accent); width:100%; padding:10px; margin-top:6px; }

  .eu-err { color:var(--err); font-size:.82rem; margin:8px 0 0; }

  /* Confirmation */
  .eu-done { text-align:center; padding:8px 0; }
  .eu-check { width:64px; height:64px; border-radius:50%; background:#dcfce7; color:var(--ok);
    display:flex; align-items:center; justify-content:center; margin:0 auto 16px; font-size:34px; }
  .eu-ref-box { margin:18px 0; padding:16px; background:#f8fafc; border:1px dashed var(--border); border-radius:12px; }
  .eu-ref-label { font-size:.72rem; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); }
  .eu-ref { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:1.6rem; font-weight:700; letter-spacing:.04em; margin-top:4px; }

  /* Embedded in the theme popup: the dialog already provides the card frame. */
  body.eu-embedded { background:#fff; padding:14px 16px; min-height:0; display:block; }
  .eu-embedded .eu-card { max-width:none; border:0; box-shadow:none; padding:4px 2px 8px; }
  [hidden] { display:none !important; }
</style>
</head>
<body>
<main class="eu-card">
  <h1 class="eu-title">${esc(dict.title)}</h1>
  <p class="eu-intro">${esc(dict.intro)}</p>

  <ol class="eu-steps">
    <li class="eu-step is-active" data-step="0"><span class="eu-dot">1</span><span class="eu-step-label">${esc(step1)}</span></li>
    <li class="eu-step" data-step="1"><span class="eu-dot">2</span><span class="eu-step-label">${esc(step2)}</span></li>
    <li class="eu-step" data-step="2"><span class="eu-dot">3</span><span class="eu-step-label">${esc(step3)}</span></li>
  </ol>

  <section id="step1">
    <label class="eu-field">${esc(dict.nameLabel)}<input id="f-name" type="text" autocomplete="name" /></label>
    <label class="eu-field">${esc(dict.orderLabel)} <span class="eu-req">*</span><input id="f-order" type="text" required /></label>
    <label class="eu-field">${esc(dict.emailLabel)} <span class="eu-req">*</span><input id="f-email" type="email" required autocomplete="email" /></label>
    <p class="eu-err" id="err1" hidden></p>
    <div class="eu-actions"><button class="eu-btn-primary" id="btn-continue" type="button">${esc(dict.continue)}</button></div>
  </section>

  <section id="step2" hidden>
    <p class="eu-banner" id="banner"></p>
    <div id="items"></div>
    <button class="eu-add" id="btn-add" type="button" hidden>+ ${esc(dict.addItem)}</button>
    <label class="eu-field">${esc(dict.reasonLabel)}<textarea id="f-reason" placeholder="${esc(dict.reasonPlaceholder)}"></textarea></label>
    <p class="eu-err" id="err2" hidden></p>
    <div class="eu-actions">
      <button class="eu-btn-ghost" id="btn-back" type="button">${esc(dict.back)}</button>
      <button class="eu-btn-primary" id="btn-submit" type="button">${esc(dict.submit)}</button>
    </div>
  </section>

  <section id="step3" hidden>
    <div class="eu-done">
      <div class="eu-check">&#10003;</div>
      <h2 class="eu-title" style="font-size:1.15rem">${esc(dict.step3Title)}</h2>
      <p class="eu-intro" style="margin:6px 0 0">${esc(dict.confirmation)}</p>
      <div class="eu-ref-box">
        <div class="eu-ref-label">${esc(dict.referenceLabel)}</div>
        <div class="eu-ref" id="ref"></div>
      </div>
    </div>
  </section>
</main>

<script type="application/json" id="dict">${dictJson}</script>
<script>
(function(){
  var D = JSON.parse(document.getElementById('dict').textContent);
  var ENDPOINT = window.location.pathname; // proxied path → Shopify re-signs
  var state = { orderVerified:false, country:null, shopifyOrderId:null, shippedAt:null, category:'standard' };
  var $ = function(id){ return document.getElementById(id); };

  var EMBEDDED = window.self !== window.top;
  if (EMBEDDED) document.body.classList.add('eu-embedded');
  function postHeight(){
    if (!EMBEDDED) return;
    try { parent.postMessage({ eu_wd_height: document.documentElement.scrollHeight }, '*'); } catch (e) {}
  }

  function setStep(n){
    ['step1','step2','step3'].forEach(function(s,i){ $(s).hidden = (i !== n); });
    document.querySelectorAll('.eu-step').forEach(function(el){
      var i = Number(el.getAttribute('data-step'));
      el.classList.toggle('is-active', i === n);
      el.classList.toggle('is-done', i < n);
    });
    window.scrollTo(0,0);
    postHeight();
  }

  function post(payload){
    return fetch(ENDPOINT, {
      method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify(payload)
    }).then(function(r){ if(!r.ok) throw new Error('http'); return r.json(); });
  }

  function addManualRow(){
    var row = document.createElement('div'); row.className = 'item-row';
    var t = document.createElement('input'); t.type='text'; t.placeholder = D.itemTitlePlaceholder; t.className='it-title';
    var q = document.createElement('input'); q.type='number'; q.min='1'; q.value='1'; q.className='it-qty'; q.setAttribute('aria-label', D.qtyPlaceholder);
    row.appendChild(t); row.appendChild(q);
    $('items').appendChild(row);
    postHeight();
  }

  function renderVerifiedItems(items){
    var box = $('items'); box.innerHTML='';
    items.forEach(function(it){
      var row = document.createElement('label'); row.className='item-row check';
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
        var banner = $('banner');
        banner.textContent = state.orderVerified ? D.verifiedBanner : D.manualBanner;
        banner.className = 'eu-banner' + (state.orderVerified ? '' : ' warn');
        if (state.orderVerified) { renderVerifiedItems(res.items || []); $('btn-add').hidden=true; }
        else { $('items').innerHTML=''; addManualRow(); $('btn-add').hidden=false; }
        setStep(1);
      })
      .catch(function(){ $('err1').textContent = D.genericError; $('err1').hidden=false; })
      .finally(function(){ $('btn-continue').disabled=false; });
  });

  $('btn-add').addEventListener('click', addManualRow);
  $('btn-back').addEventListener('click', function(){ setStep(0); });

  $('btn-submit').addEventListener('click', function(){
    var items = collectItems();
    if (items.length === 0) { $('err2').textContent = D.requiredError; $('err2').hidden=false; return; }
    $('err2').hidden=true; this.disabled=true;
    post({
      action:'submit', name:$('f-name').value.trim(), orderNumber:$('f-order').value.trim(),
      email:$('f-email').value.trim(), orderVerified: state.orderVerified, country: state.country,
      shopifyOrderId: state.shopifyOrderId, shippedAt: state.shippedAt, category: state.category,
      reason: $('f-reason').value.trim(), items: items
    })
      .then(function(res){
        if (res && res.error === 'duplicate') {
          $('err2').textContent = D.duplicateError + (res.reference ? ' (' + res.reference + ')' : '');
          $('err2').hidden=false; postHeight(); return;
        }
        $('ref').textContent = res.reference; setStep(2);
      })
      .catch(function(){ $('err2').textContent = D.genericError; $('err2').hidden=false; })
      .finally(function(){ $('btn-submit').disabled=false; });
  });

  window.addEventListener('load', postHeight);
  postHeight();
})();
</script>
</body>
</html>`;
}

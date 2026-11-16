/* Shared demo state for the shareable-cart-approval prototype.
   Everything lives in localStorage so buyer, approver and inbox tabs stay in sync. */
(function () {
  const KEY = 'conrad-approval-demo-v1';
  const VAT = 0.19;
  const FREE_SHIPPING_FROM = 100;
  const SHIPPING = 5.95;
  const LINK_VALID_DAYS = 14;

  const BUYER = { name: 'Lisa Wagner', email: 'lisa.wagner@mueller-elektrotechnik.de', company: 'Müller Elektrotechnik GmbH' };

  const SEED_ITEMS = [
    { sku: '860530-62', kind: 'detector', name: 'Garrett Euro ACE Package Metalldetektor Suchtiefe (max.) 150 cm digital (LCD), akustisch 99616', unitPrice: 385.99, qty: 2, stock: 3, delivery: 'Sofort-Lieferung Mi., 19. Nov.' },
    { sku: '124407-62', kind: 'meter', name: 'Fluke 117 Hand-Multimeter digital CAT III 600 V Anzeige (Counts): 6000', unitPrice: 229.90, qty: 4, stock: 27, delivery: 'Sofort-Lieferung Mi., 19. Nov.' },
    { sku: '1563626-62', kind: 'solder', name: 'Weller WE 1010 Lötstation digital 70 W +100 bis +450 °C', unitPrice: 189.00, qty: 2, stock: 12, delivery: 'Sofort-Lieferung Mi., 19. Nov.' },
    { sku: '1186132-62', kind: 'cable', name: 'Helukabel JZ-500 Steuerleitung 3 G 1.50 mm² Grau 50 m', unitPrice: 89.90, qty: 5, stock: 140, delivery: 'Lieferung Do., 20. Nov.' },
  ];

  function seed() {
    return { cart: { items: SEED_ITEMS.map(i => ({ ...i })), version: 1 }, request: null, emails: [], orders: [] };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* fall through */ }
    const s = seed();
    save(s);
    return s;
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function update(fn) { const s = load(); fn(s); save(s); return s; }
  function reset() { save(seed()); }

  /* Same-tab listeners + other tabs via the storage event */
  const listeners = [];
  function onChange(cb) { listeners.push(cb); }
  window.addEventListener('storage', e => { if (e.key === KEY) listeners.forEach(cb => cb(load())); });

  const eur = n => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const fmtDate = ts => new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmtTime = ts => new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const fmtDateTime = ts => fmtDate(ts) + ', ' + fmtTime(ts) + ' Uhr';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function totals(items) {
    const net = items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
    const shipping = net === 0 || net >= FREE_SHIPPING_FROM ? 0 : SHIPPING;
    const vat = (net + shipping) * VAT;
    return { net, shipping, vat, gross: net + shipping + vat, count: items.reduce((n, i) => n + i.qty, 0), lines: items.length };
  }

  /* Approval status derived from request + current cart version */
  function status(s) {
    const r = s.request;
    if (!r || r.status === 'withdrawn') return 'none';
    if (r.status === 'pending') return 'pending';
    const changed = r.cartVersion !== s.cart.version;
    if (r.status === 'approved') return changed ? 'approved-changed' : 'approved';
    return 'rejected';
  }

  function token() {
    const a = new Uint8Array(12); crypto.getRandomValues(a);
    return Array.from(a, b => b.toString(36).padStart(2, '0')).join('').slice(0, 20);
  }
  function linkFor(t) { return new URL('freigabe.html?token=' + t, location.href).href; }

  function createRequest(note) {
    return update(s => {
      s.request = { token: token(), createdAt: Date.now(), expiresAt: Date.now() + LINK_VALID_DAYS * 864e5, note: note || '', status: 'pending', cartVersion: s.cart.version, approverName: '', message: '', respondedAt: null };
    }).request;
  }
  function withdraw() { update(s => { if (s.request) s.request.status = 'withdrawn'; }); }

  function respond(tok, decision, approverName, message) {
    return update(s => {
      const r = s.request;
      if (!r || r.token !== tok || r.status !== 'pending') return;
      Object.assign(r, { status: decision, approverName, message, respondedAt: Date.now(), cartVersion: s.cart.version, snapshot: s.cart.items.map(i => ({ ...i })) });
      const approved = decision === 'approved';
      s.emails.unshift({
        id: token(), token: tok, decision, read: false, sentAt: Date.now(),
        from: 'Conrad Electronic <service@conrad.de>', to: BUYER.email,
        subject: approved ? 'Ihre Bestellung wurde freigegeben' : 'Ihre Freigabeanfrage wurde abgelehnt',
        approverName, message, items: r.snapshot, totals: totals(r.snapshot),
      });
    });
  }

  function setQty(sku, qty) {
    update(s => {
      const it = s.cart.items.find(i => i.sku === sku);
      if (!it) return;
      const q = Math.max(1, Math.min(999, qty));
      if (q !== it.qty) { it.qty = q; s.cart.version++; }
    });
  }
  function removeItem(sku) {
    update(s => { s.cart.items = s.cart.items.filter(i => i.sku !== sku); s.cart.version++; });
  }

  /* Simple product glyphs so the prototype needs no image assets */
  const GLYPHS = {
    detector: '<rect x="37" y="14" width="5" height="40" rx="2" fill="#5a6171"/><rect x="30" y="20" width="18" height="12" rx="3" fill="#376EEF"/><ellipse cx="40" cy="60" rx="22" ry="7" fill="none" stroke="#272C35" stroke-width="4"/>',
    meter: '<rect x="24" y="12" width="32" height="56" rx="6" fill="#f2c200"/><rect x="29" y="18" width="22" height="14" rx="2" fill="#cfe3d6"/><circle cx="40" cy="47" r="9" fill="#272C35"/><circle cx="32" cy="62" r="2.5" fill="#d9234c"/><circle cx="48" cy="62" r="2.5" fill="#272C35"/>',
    solder: '<rect x="12" y="38" width="38" height="26" rx="4" fill="#272C35"/><rect x="18" y="44" width="16" height="8" rx="1" fill="#d9234c"/><path d="M54 60 L66 22" stroke="#5a6171" stroke-width="5" stroke-linecap="round"/><path d="M50 40 Q56 52 54 60" stroke="#376EEF" stroke-width="2" fill="none"/>',
    cable: '<circle cx="40" cy="40" r="26" fill="#9aa1ad"/><circle cx="40" cy="40" r="18" fill="#cfd4dd"/><circle cx="40" cy="40" r="8" fill="#f4f5f7"/><path d="M62 52 Q72 60 70 70" stroke="#9aa1ad" stroke-width="4" fill="none"/>',
  };
  function img(item, size = 80) {
    return `<svg class="prod-img" width="${size}" height="${size}" viewBox="0 0 80 80" role="img" aria-label="${esc(item.name)}"><rect width="80" height="80" rx="6" fill="#f8f9fb"/>${GLYPHS[item.kind] || ''}</svg>`;
  }

  /* Header */
  function mountHeader(opts = {}) {
    const host = document.getElementById('site-header');
    if (!host) return;
    host.outerHTML = window.SITE_HEADER;
    if (opts.hideCart) document.querySelectorAll('[data-cart-fly]').forEach(el => el.remove());
    if (opts.hideMail) document.querySelectorAll('[data-mail-badge]').forEach(el => el.closest('a').remove());
    refreshHeader(load());
    onChange(refreshHeader);
  }
  function refreshHeader(s) {
    const t = totals(s.cart.items);
    const badge = document.querySelector('[data-cart-badge]');
    if (badge) badge.textContent = s.cart.items.length;
    const unread = s.emails.filter(e => !e.read).length;
    const mb = document.querySelector('[data-mail-badge]');
    if (mb) { mb.textContent = unread; mb.style.display = unread ? '' : 'none'; }
    const panel = document.querySelector('[data-cart-panel]');
    if (panel) {
      panel.innerHTML = `<div class="fly-head"><span><span class="fly-title">Einkaufswagen</span>
        <span class="fly-sub"><span>${t.lines} Artikel</span><span>Zwischensumme: ${eur(t.net)}</span></span></span>
        <a class="fly-link" href="index.html">anzeigen</a></div>` +
        (s.cart.items.length ? `<div class="fly-list">${s.cart.items.map(i => `<div class="fly-item">
          <span class="fly-item-img">${img(i, 40)}</span>
          <span><span class="fly-item-name">${esc(i.name)}</span><span class="fly-item-qty">${i.qty} Stück</span></span>
          <span class="fly-item-right"><span class="fly-item-price">${eur(i.unitPrice * i.qty)}</span></span></div>`).join('')}</div>`
          : '<p class="fly-empty">Ihr Einkaufswagen ist leer</p>');
    }
  }

  function toast(msg) {
    let el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2400);
  }

  function mountDemoBar() {
    const bar = document.createElement('div');
    bar.className = 'demo-bar';
    bar.innerHTML = `<span class="demo-bar-label">Prototyp</span>
      <a href="index.html">Käufer: Warenkorb</a>
      <a href="email.html">Käufer: Postfach</a>
      <button type="button" data-reset>Demo zurücksetzen</button>`;
    bar.querySelector('[data-reset]').addEventListener('click', () => { reset(); location.href = 'index.html'; });
    document.body.appendChild(bar);
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (_) {} ta.remove();
    }
    toast('Link kopiert');
  }

  window.App = { load, save, update, reset, onChange, totals, status, eur, esc, fmtDate, fmtTime, fmtDateTime, img,
    createRequest, withdraw, respond, setQty, removeItem, linkFor, mountHeader, refreshHeader, toast, mountDemoBar, copy, BUYER };
})();

/* Shared state and helpers for the approval prototype.
   State lives in localStorage so every page (and a second tab) sees the same demo.
   Each page sets <body data-step="…"> and defines window.renderPage() returning its HTML. */
const BUYER = { name: 'Lisa Wagner', first: 'Lisa', email: 'lisa.wagner@mueller-elektrotechnik.de', company: 'Müller Elektrotechnik GmbH' };
const APPROVER = 'Thomas Becker';
const SEED = [
  { sku: '860530-62', kind: 'detector', name: 'Garrett Euro ACE Package Metalldetektor Suchtiefe (max.) 150 cm digital (LCD), akustisch 99616', unitPrice: 385.99, qty: 2, stock: 3, delivery: 'Sofort-Lieferung Mi., 19. Nov.' },
  { sku: '124407-62', kind: 'meter', name: 'Fluke 117 Hand-Multimeter digital CAT III 600 V Anzeige (Counts): 6000', unitPrice: 229.90, qty: 4, stock: 27, delivery: 'Sofort-Lieferung Mi., 19. Nov.' },
  { sku: '1563626-62', kind: 'solder', name: 'Weller WE 1010 Lötstation digital 70 W +100 bis +450 °C', unitPrice: 189.00, qty: 2, stock: 12, delivery: 'Sofort-Lieferung Mi., 19. Nov.' },
  { sku: '1186132-62', kind: 'cable', name: 'Helukabel JZ-500 Steuerleitung 3 G 1.50 mm² Grau 50 m', unitPrice: 89.90, qty: 5, stock: 140, delivery: 'Lieferung Do., 20. Nov.' },
];
const DEFAULT_NOTE = 'Messgeräte für das Projekt Neubau Halle 3, Kostenstelle 4711';
const DEFAULT_REPLY = 'Passt, bitte bis Freitag bestellen.';

/* ---------- state ---------- */
const KEY = 'conrad-approval-demo-v2';
// approvals: [{ id, createdAt, note, status: 'pending'|'approved'|'rejected', snapshot, name, message, respondedAt, read }]
// cartFrom: { id, version } — which approval the current cart came from, and the cart version at that moment
const fresh = () => ({ items: SEED.map(i => ({ ...i })), version: 1, approvals: [], cartFrom: null, orderNo: null });
let S = load();
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch (e) {}
  return fresh();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
function reset() { S = fresh(); save(); }

const clone = items => items.map(i => ({ ...i }));
const findApproval = id => S.approvals.find(a => a.id === id);
const currentApproval = () => (S.cartFrom && findApproval(S.cartFrom.id)) || null;
const isLoaded = a => !!S.cartFrom && S.cartFrom.id === a.id && S.cartFrom.version === S.version;
const activeApprovals = () => S.approvals.filter(a => a.status === 'pending' || a.status === 'approved');

function createApproval(note) {
  const a = { id: Math.random().toString(36).slice(2, 12), createdAt: Date.now(), note, status: 'pending', snapshot: clone(S.items), name: '', message: '', respondedAt: null, read: false };
  S.approvals = [a]; // prototype: one approval at a time, list-shaped data
  S.cartFrom = { id: a.id, version: S.version };
  return a;
}
function decide(a, status, name, message) {
  Object.assign(a, { status, name, message, respondedAt: Date.now(), read: false });
}
function loadIntoCart(a) {
  S.items = clone(a.snapshot);
  S.version++;
  S.cartFrom = { id: a.id, version: S.version };
}
/* Banner/summary status for the cart: derived from the approval the cart came from */
function status() {
  const a = currentApproval();
  if (!a) return 'none';
  const changed = S.cartFrom.version !== S.version;
  if (a.status === 'pending' && changed) return 'none'; // request no longer matches this cart
  if (a.status === 'approved' && changed) return 'approved-changed';
  return a.status;
}
const approvalLink = a => new URL('freigabe.html?id=' + a.id, location.href).href;
const displayLink = a => 'https://www.conrad.de/freigabe/' + a.id; // what the link looks like in the real shop

/* Prototype hand-off between perspectives: a clearly marked box, colored like the target's "Sie sehen" chip */
const PERSONAS = {
  buyer: { name: 'Lisa Wagner', initials: 'LW', role: 'Einkäuferin' },
  approver: { name: 'Thomas Becker', initials: 'TB', role: 'Freigebende Person' },
};
function handoff(target, text, href) {
  const p = PERSONAS[target];
  return `<div class="handoff handoff-${target}">
    <span class="handoff-label">Prototyp</span>
    <span class="handoff-text">${text}</span>
    <a class="handoff-btn" href="${href}"><span class="rb-avatar">${p.initials}</span>Als ${p.name} weiter ${ICONS.arrow}</a>
  </div>`;
}

/* Deep links: make sure the step has what it needs to render something meaningful */
function ensure(step) {
  if (step === 'approver' || step === 'approver-inbox' || step === 'email') {
    if (!S.approvals.length) createApproval(DEFAULT_NOTE);
  }
  if (step === 'email' && !S.approvals.some(a => a.status !== 'pending')) {
    decide(S.approvals[0], 'approved', APPROVER, DEFAULT_REPLY);
  }
  if (step === 'checkout' && !S.items.length) { S.items = clone(SEED); S.version++; }
  if (step === 'done' && !S.orderNo) S.orderNo = newOrderNo();
}
const newOrderNo = () => 'CO-' + Math.floor(10000000 + Math.random() * 89999999);

/* ---------- helpers ---------- */
const eur = n => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDateTime = ts => new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ', ' + new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr';
function totals(items) {
  const net = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const shipping = net === 0 || net >= 100 ? 0 : 5.95;
  const vat = (net + shipping) * 0.19;
  return { net, shipping, vat, gross: net + shipping + vat, count: items.reduce((n, i) => n + i.qty, 0), lines: items.length };
}
const GLYPHS = {
  detector: '<rect x="37" y="14" width="5" height="40" rx="2" fill="#5a6171"/><rect x="30" y="20" width="18" height="12" rx="3" fill="#376EEF"/><ellipse cx="40" cy="60" rx="22" ry="7" fill="none" stroke="#272C35" stroke-width="4"/>',
  meter: '<rect x="24" y="12" width="32" height="56" rx="6" fill="#f2c200"/><rect x="29" y="18" width="22" height="14" rx="2" fill="#cfe3d6"/><circle cx="40" cy="47" r="9" fill="#272C35"/><circle cx="32" cy="62" r="2.5" fill="#d9234c"/><circle cx="48" cy="62" r="2.5" fill="#272C35"/>',
  solder: '<rect x="12" y="38" width="38" height="26" rx="4" fill="#272C35"/><rect x="18" y="44" width="16" height="8" rx="1" fill="#d9234c"/><path d="M54 60 L66 22" stroke="#5a6171" stroke-width="5" stroke-linecap="round"/><path d="M50 40 Q56 52 54 60" stroke="#376EEF" stroke-width="2" fill="none"/>',
  cable: '<circle cx="40" cy="40" r="26" fill="#9aa1ad"/><circle cx="40" cy="40" r="18" fill="#cfd4dd"/><circle cx="40" cy="40" r="8" fill="#f4f5f7"/><path d="M62 52 Q72 60 70 70" stroke="#9aa1ad" stroke-width="4" fill="none"/>',
};
const img = (i, size = 80) => `<svg class="prod-img" width="${size}" height="${size}" viewBox="0 0 80 80" role="img" aria-label="${esc(i.name)}"><rect width="80" height="80" rx="6" fill="#f8f9fb"/>${GLYPHS[i.kind]}</svg>`;
const ICONS = {
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
  link: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  arrow: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  cartIn: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
};
const sized = (svg, n) => svg.replace('<svg', `<svg width="${n}" height="${n}"`);
function toast(msg, action) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.innerHTML = esc(msg) + (action ? ` <a class="toast-action" href="${action.href}">${esc(action.label)}</a>` : '');
  el.classList.toggle('has-action', !!action); el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), action ? 6000 : 2400);
}
function totalsHtml(t) {
  return `<div class="summary-row"><span>Nettopreis</span><span>${eur(t.net)}</span></div>
    <div class="summary-row"><span>Versand</span>${t.shipping ? `<span>${eur(t.shipping)}</span>` : '<span class="summary-free">Kostenfrei</span>'}</div>
    <div class="summary-row"><span>MwSt. (19 %)</span><span>${eur(t.vat)}</span></div>
    <div class="summary-row total"><span>Gesamtpreis</span><span>${eur(t.gross)}</span></div>
    <div class="summary-vat">inkl. MwSt.</div>`;
}
function roItems(items) {
  return items.map(i => `<div class="ro-item">${img(i, 64)}<div><div class="item-name">${esc(i.name)}</div>
    <div class="ro-meta"><span>Bestell-Nr.: ${i.sku}</span><span>${esc(i.delivery)}</span></div>
    <div class="ro-meta" style="margin-top:4px"><span>Menge: <span class="ro-qty">${i.qty} Stück</span></span></div></div>
    <div class="ro-price"><div class="line">${eur(i.unitPrice * i.qty)}</div><div class="unit">${eur(i.unitPrice)} / Stück</div></div></div>`).join('');
}

/* ---------- render ---------- */
function render() {
  document.getElementById('page').innerHTML = window.renderPage();
  const badge = document.querySelector('[data-cart-badge]');
  if (badge) badge.textContent = S.items.length;
  const unread = S.approvals.filter(a => a.status !== 'pending' && !a.read).length;
  const mb = document.querySelector('[data-mail-badge]');
  if (mb) { mb.textContent = unread; mb.style.display = unread ? '' : 'none'; }
  const panel = document.querySelector('[data-cart-panel]');
  if (panel) { const t = totals(S.items); panel.innerHTML = `<div class="fly-head"><span><span class="fly-title">Einkaufswagen</span><span class="fly-sub"><span>${t.lines} Artikel</span><span>Zwischensumme: ${eur(t.net)}</span></span></span><a class="fly-link" href="index.html">anzeigen</a></div>`; }
}
function commit() { save(); render(); }

/* Page actions; pages may add their own via window.pageActions */
const ACTIONS = {
  copy() {
    const a = currentApproval() || S.approvals[0]; if (!a) return;
    navigator.clipboard?.writeText(approvalLink(a)).catch(() => {});
    toast('Link kopiert');
  },
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = (window.pageActions || {})[el.dataset.act] || ACTIONS[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});
window.addEventListener('storage', e => { if (e.key === KEY) { S = load(); render(); } });

/* Boot: called at the end of each page */
function boot() {
  const step = document.body.dataset.step;
  const params = new URLSearchParams(location.search);
  if (params.has('reset')) { reset(); params.delete('reset'); history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash); }
  ensure(step);
  save();
  window.renderChrome();
  render();
}

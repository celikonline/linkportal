import { STORAGE_KEY, deriveKey, encryptVault, unlockVault, safeUrl, normalizeAccounts, formatVaultText } from './vault.mjs';
import { createShareLink, parseShareFragment, selectVaultData } from './share.mjs';

const $ = id => document.getElementById(id);
const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
  key: '<circle cx="8" cy="8" r="5"/><path d="m12 12 9 9m-4-4 3-3m-6 0 3-3M7 7h.01"/>',
  shield: '<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
  upload: '<path d="M12 15V3m-4 4 4-4 4 4M4 16v4h16v-4"/>',
  external: '<path d="M14 3h7v7m0-7L10 14M10 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-5"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="m16 3 5 5-12 12-6 1 1-6Zm-2 2 5 5"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));
const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let data = { products: [] }, vaultKey = null, vaultSalt = null, view = 'all', category = 'all', lastActivity = Date.now(), importEnvelope = null, detailId = null, toastTimer, saving = false;
let shareImport = false, shareRequest = 0, authRequest = 0;
const seed = () => ({ products: [
  ['Figma', 'https://figma.com', 'Tasarım', 'Fikirlerden arayüzlere. Tüm tasarım çalışmaların.', true],
  ['Notion', 'https://notion.so', 'Üretkenlik', 'Notların, projelerin ve aklına gelen her şey.', true],
  ['GitHub', 'https://github.com', 'Geliştirme', 'Kodların ve projelerin için ortak çalışma alanın.', false],
  ['Slack', 'https://slack.com', 'İletişim', 'Ekibinle iletişimde kal, konuşmaları bir araya getir.', false],
  ['Linear', 'https://linear.app', 'Üretkenlik', 'İşlerini planla, projelerine odaklan.', false],
].map(([name, url, category, notes, favorite], i) => ({ id: crypto.randomUUID(), name, url, category, notes, favorite, accounts: [], createdAt: Date.now() - i })) });
function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3000); }
function envelopeFromStorage() { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; }
async function persist(nextData) {
  if (!vaultKey) throw new Error('Kasa kilitli.');
  if (saving) throw new Error('Önceki kayıt tamamlanıyor. Birazdan tekrar dene.');
  saving = true;
  const sessionKey = vaultKey;
  try {
    const encrypted = await encryptVault(nextData, sessionKey, vaultSalt);
    if (vaultKey !== sessionKey) throw new Error('Kasa kilitlendi. Yeniden giriş yap.');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(encrypted));
    data = nextData;
    $('save-state').textContent = 'Tüm değişiklikler kaydedildi';
  } finally { saving = false; }
}
function nextData() { return structuredClone(data); }
function showAuth(message = '') {
  let existing = false;
  try { existing = !!envelopeFromStorage(); } catch { message = 'Kasa okunamadı. Şifreli yedeğini geri yükleyebilirsin.'; }
  $('auth-title').textContent = shareImport ? 'Paylaşılan kasayı aç.' : importEnvelope ? 'Yedeğini geri yükle.' : existing ? 'Tekrar hoş geldin.' : 'Kasana hoş geldin.';
  $('auth-description').textContent = shareImport ? 'Gönderenin ayrı ilettiği paylaşım parolasını gir. Kasanın bağımsız bir kopyası bu tarayıcıya kaydedilir. Mevcut kasan varsa değiştirmeden önce onayını soracağız.' : importEnvelope ? 'Yedek dosyanın ana parolasını gir. Doğrulandıktan sonra mevcut kasanın yerini alacak.' : existing ? 'Ürünlerine ve hesaplarına erişmek için ana parolanı gir.' : 'Ürünlerini ve hesaplarını bir arada tut. Başlamak için yalnızca senin bildiğin bir ana parola oluştur.';
  $('auth-password-label').textContent = shareImport ? 'Paylaşım parolası' : 'Ana parola';
  $('cancel-share-import').hidden = !shareImport;
  $('auth-import').hidden = shareImport;
  $('confirm-password-label').hidden = existing || !!importEnvelope;
  $('confirm-password').required = !existing && !importEnvelope;
  $('master-password').minLength = existing || importEnvelope ? 1 : 6;
  $('master-password').autocomplete = existing || importEnvelope ? 'current-password' : 'new-password';
  $('master-password').value = ''; $('confirm-password').value = '';
  $('master-password').type = 'password'; $('toggle-master').ariaLabel = 'Parolayı göster';
  $('unlock-button').textContent = shareImport ? 'Paylaşılan kasayı aç ↗' : importEnvelope ? 'Yedeği aç ve geri yükle ↗' : existing ? 'Kasamı aç ↗' : 'Kasamı oluştur ↗';
  $('unlock-button').disabled = false;
  $('auth-error').textContent = message;
  $('preview-button').hidden = existing || !!importEnvelope;
  if (!$('auth-dialog').open) $('auth-dialog').showModal();
}
function lockVault() {
  authRequest++;
  vaultKey = null; vaultSalt = null; data = { products: [] }; detailId = null;
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
  $('product-form').reset(); $('account-fields').replaceChildren(); $('detail-content').replaceChildren();
  $('search').value = ''; render(); $('save-state').textContent = 'Kasa kilitli'; showAuth();
}
$('cancel-share-import').onclick = () => { authRequest++; importEnvelope = null; shareImport = false; showAuth(); };
$('auth-dialog').addEventListener('cancel', e => e.preventDefault());
$('preview-button').onclick = () => { data = seed(); $('auth-dialog').close(); $('save-state').textContent = 'Önizleme · Kaydetmek için kasanı oluştur'; render(); toast('Örnek ürünleri inceleyebilirsin. Kayıt için kasanı oluştur.'); };
$('auth-form').addEventListener('submit', async e => {
  e.preventDefault(); $('auth-error').textContent = ''; const button = $('unlock-button'); button.disabled = true;
  const request = ++authRequest;
  try {
    const password = $('master-password').value;
    const envelope = importEnvelope || envelopeFromStorage();
    let opened;
    if (envelope) opened = await unlockVault(envelope, password);
    else {
      if (password.length < 6) throw new Error('En az 6 karakterlik bir ana parola belirle.');
      if (password !== $('confirm-password').value) throw new Error('Ana parolalar eşleşmiyor.');
      const salt = crypto.getRandomValues(new Uint8Array(16));
      opened = { key: await deriveKey(password, salt), salt, data: seed() };
    }
    if (request !== authRequest) return;
    if (shareImport && localStorage.getItem(STORAGE_KEY) && !window.confirm('Paylaşılan kasa doğrulandı. Bu tarayıcıdaki mevcut kasanın yerini alacak. Mevcut kasanın yedeğini aldıysan devam et. Kasa değiştirilsin mi?')) return;
    const encrypted = await encryptVault(opened.data, opened.key, opened.salt);
    if (request !== authRequest) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(encrypted));
    const wasShared = shareImport;
    vaultKey = opened.key; vaultSalt = opened.salt; data = opened.data; importEnvelope = null; shareImport = false;
    lastActivity = Date.now(); $('auth-form').reset(); $('auth-dialog').close(); $('save-state').textContent = 'Kasan açık · Bu tarayıcıda saklanır'; render();
    toast(wasShared ? 'Kopya kaydedildi. Bu kasayı paylaşım parolasıyla tekrar açabilirsin.' : 'Kasan hazır. Her şey elinin altında.');
  } catch (error) { if (request === authRequest) $('auth-error').textContent = error.name === 'OperationError' ? 'Parola yanlış veya şifreli kasa bozulmuş.' : error.message; }
  finally { if (request === authRequest) button.disabled = false; }
});
$('toggle-master').addEventListener('click', () => { const field = $('master-password'); field.type = field.type === 'password' ? 'text' : 'password'; $('toggle-master').ariaLabel = field.type === 'password' ? 'Parolayı göster' : 'Parolayı gizle'; });
function render() {
  const products = data.products;
  $('nav-count').textContent = products.length; $('total-products').textContent = products.length;
  $('total-accounts').textContent = products.reduce((n, p) => n + p.accounts.length, 0);
  $('total-favorites').textContent = products.filter(p => p.favorite).length;
  const categories = [...new Set(products.map(p => p.category))].sort((a, b) => a.localeCompare(b, 'tr'));
  if (category !== 'all' && !categories.includes(category)) category = 'all';
  $('category-nav').innerHTML = categories.map(c => `<button class="nav-item category-item ${category === c ? 'active' : ''}" data-category="${esc(c)}"><span class="category-dot"></span>${esc(c)}<span>${products.filter(p => p.category === c).length}</span></button>`).join('');
  $('filters').innerHTML = ['all', ...categories].map(c => `<button class="filter ${category === c ? 'active' : ''}" data-category="${esc(c)}">${c === 'all' ? 'Tüm kategoriler' : esc(c)}</button>`).join('');
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view && category === 'all'));
  const title = view === 'favorites' ? 'Favoriler' : category === 'all' ? 'Bağlantılar' : category;
  $('page-title').innerHTML = `${esc(title)}<span>.</span>`;
  $('breadcrumb-current').textContent = category !== 'all' ? category : view === 'favorites' ? 'Favoriler' : 'Tüm ürünler';
  const query = $('search').value.trim().toLocaleLowerCase('tr');
  let visible = products.filter(p => (view !== 'favorites' || p.favorite) && (category === 'all' || p.category === category) && [p.name, p.notes, p.category, p.url, ...p.accounts.flatMap(a => [a.username, a.label])].join(' ').toLocaleLowerCase('tr').includes(query));
  const sort = $('sort').value;
  visible.sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'tr') : sort === 'accounts' ? b.accounts.length - a.accounts.length : (b.createdAt || 0) - (a.createdAt || 0));
  $('section-title').innerHTML = `${view === 'favorites' ? 'Favori ürünler' : 'Tüm ürünler'} <span>${visible.length}</span>`;
  $('products').innerHTML = visible.map(noteLine).join('') + (!visible.length ? `<div class="empty-state"><p>${query ? 'Aradığın bağlantı bulunamadı.' : view === 'favorites' ? 'Yıldızla işaretlediğin bağlantılar burada görünür.' : 'Henüz bağlantı yok. İlk bağlantını ekleyebilirsin.'}</p></div>` : '') + (query || view === 'favorites' ? '' : '<button class="note-add" data-action="add">+ Bağlantı ekle</button>');
}
function logo(p) {
  const known = ['figma', 'notion', 'github', 'slack', 'linear', 'vercel'].find(n => p.name.toLowerCase() === n);
  const marks = { figma: 'F', notion: 'N', github: '⌘', slack: '✳', linear: '◒', vercel: '▲' };
  return `<span class="product-logo ${known ? `logo-${known}` : ''}">${esc(known ? marks[known] : p.name.charAt(0).toLocaleUpperCase('tr'))}</span>`;
}
function noteLine(p) {
  return `<article class="note-line" data-id="${esc(p.id)}"><span class="note-dash" aria-hidden="true">-</span><div class="note-text"><div class="note-link-line"><span class="note-name">${esc(p.name)}</span><span class="note-separator" aria-hidden="true">—</span><a class="note-url" href="${esc(safeUrl(p.url))}" target="_blank" rel="noopener noreferrer">${esc(p.url)}</a></div>${p.notes ? `<p class="note-description">${esc(p.notes)}</p>` : ''}</div><div class="note-actions"><button class="icon-button" data-action="copy-all" aria-label="${esc(p.name)}: tümünü kopyala">${icon('copy')}</button><button class="account-button" data-action="detail" aria-label="${esc(p.name)}: ${p.accounts.length ? 'hesapları gör' : 'hesap ekle'}">${p.accounts.length ? `${p.accounts.length} hesap` : 'Hesap ekle'}</button><button class="icon-button ${p.favorite ? 'is-favorite' : ''}" data-action="favorite" aria-label="${p.favorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}" aria-pressed="${p.favorite}">${icon('star')}</button><button class="icon-button" data-action="edit" aria-label="${esc(p.name)} ürününü düzenle">${icon('edit')}</button></div></article>`;
}
function addAccountFields(account = {}) {
  const row = document.createElement('div'); row.className = 'account-fields-row'; row.dataset.id = account.id || crypto.randomUUID();
  row.dataset.label = account.label || '';
  row.innerHTML = `<div class="form-row"><label>Kullanıcı adı / e-posta<input class="account-username" maxlength="300" autocomplete="off" placeholder="kullanici@ornek.com" value="${esc(account.username || '')}"></label><label>Şifre<div class="password-input"><input class="account-password" type="text" maxlength="1000" autocomplete="off" spellcheck="false" placeholder="Hesap şifresi" value="${esc(account.password || '')}"><button type="button" class="icon-button toggle-account" aria-label="Şifreyi gizle">${icon('eye')}</button></div></label></div><button type="button" class="icon-button remove-account" aria-label="Hesabı kaldır">${icon('trash')}</button>`;
  row.querySelector('.remove-account').onclick = () => { row.remove(); ensureAccountBlankRow(); };
  row.addEventListener('input', ensureAccountBlankRow);
  row.querySelector('.toggle-account').onclick = e => { const f = row.querySelector('.account-password'); f.type = f.type === 'password' ? 'text' : 'password'; e.currentTarget.ariaLabel = f.type === 'password' ? 'Şifreyi göster' : 'Şifreyi gizle'; };
  $('account-fields').append(row);
}
function ensureAccountBlankRow() {
  const rows = [...$('account-fields').children];
  for (const row of rows) {
    const username = row.querySelector('.account-username'), password = row.querySelector('.account-password');
    username.required = password.required = !!(username.value.trim() || password.value);
  }
  const last = rows.at(-1);
  if (!last || last.querySelector('.account-username').value.trim() || last.querySelector('.account-password').value) addAccountFields();
}
function editorAccounts() {
  return normalizeAccounts([...$('account-fields').children].map(row => ({ id: row.dataset.id, label: row.dataset.label, username: row.querySelector('.account-username').value, password: row.querySelector('.account-password').value })));
}
function openEditor(id) {
  if (!vaultKey) return showAuth();
  const p = data.products.find(p => p.id === id);
  $('product-form').reset(); $('account-fields').replaceChildren(); $('form-error').textContent = '';
  $('product-id').value = p?.id || ''; $('product-name').value = p?.name || ''; $('product-category').value = p?.category || (category !== 'all' ? category : ''); $('product-url').value = p?.url || ''; $('product-notes').value = p?.notes || '';
  $('form-title').textContent = p ? 'Ürünü düzenle' : 'Yeni ürün ekle';
  p?.accounts.forEach(addAccountFields);
  ensureAccountBlankRow();
  if ($('detail-dialog').open) $('detail-dialog').close();
  $('product-dialog').showModal();
}
$('add-product').onclick = () => openEditor();
$('copy-editor-accounts').onclick = async () => {
  try {
    const product = { id: $('product-id').value || 'draft', name: $('product-name').value.trim() || 'Ürün', url: safeUrl($('product-url').value.trim()), category: $('product-category').value, notes: '', favorite: false, accounts: editorAccounts() };
    await copyVaultData({ products: [product] });
  } catch (error) { $('form-error').textContent = error.message; }
};
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
$('product-dialog').addEventListener('close', () => { $('product-form').reset(); $('account-fields').replaceChildren(); });
$('detail-dialog').addEventListener('close', () => { $('detail-content').replaceChildren(); detailId = null; });
$('product-form').addEventListener('submit', async e => {
  e.preventDefault(); const submit = e.submitter; submit.disabled = true;
  try {
    const next = nextData(); const existing = next.products.find(p => p.id === $('product-id').value);
    const product = { id: existing?.id || crypto.randomUUID(), name: $('product-name').value.trim(), url: safeUrl($('product-url').value.trim()), category: $('product-category').value.trim(), notes: $('product-notes').value.trim(), favorite: existing?.favorite || false, createdAt: existing?.createdAt || Date.now(), accounts: editorAccounts() };
    if (!product.name || !product.category || product.accounts.some(a => !a.username || !a.password)) throw new Error('Ürün adı, kategori ve eklediğin hesapların bilgilerini doldur.');
    if (existing) next.products[next.products.indexOf(existing)] = product; else next.products.unshift(product);
    await persist(next); $('product-dialog').close(); render(); toast('Ürün kasana kaydedildi.');
  } catch (error) { $('form-error').textContent = error.message; }
  finally { submit.disabled = false; }
});
function openDetail(id) {
  const p = data.products.find(p => p.id === id); if (!p) return;
  if (!p.accounts.length) return openEditor(id);
  detailId = id;
  $('detail-content').innerHTML = `<div class="dialog-head"><div class="card-top">${logo(p)}<div><span class="eyebrow">ÜRÜN HESAPLARI</span><h2>${esc(p.name)}</h2></div></div><button class="icon-button close-detail" aria-label="Kapat">×</button></div>
    <a class="detail-product-url" href="${esc(safeUrl(p.url))}" target="_blank" rel="noopener noreferrer">${esc(p.url)}</a><p class="detail-intro">${esc(p.notes)}</p>
    <div class="account-bulk-actions"><button type="button" class="button secondary" id="copy-product-accounts">${icon('copy')} Tümünü kopyala</button><button type="button" class="button secondary" id="share-product-accounts">Seçerek paylaş</button></div>
    ${p.accounts.map((a, i) => `<section class="detail-account"><h3>Hesap ${i + 1}</h3><div class="credential-row"><span>Kullanıcı</span><span class="credential-value">${esc(a.username)}</span><button class="icon-button" data-copy="username" data-index="${i}" aria-label="Kullanıcı adını kopyala">${icon('copy')}</button></div><div class="credential-row"><span>Şifre</span><span class="credential-value secret-value">${esc(a.password)}</span><button class="icon-button" data-reveal="${i}" data-shown="true" aria-label="Şifreyi gizle">${icon('eye')}</button><button class="icon-button" data-copy="password" data-index="${i}" aria-label="Şifreyi kopyala">${icon('copy')}</button></div></section>`).join('')}
    <div class="detail-actions"><button class="button small secondary" id="delete-product">${icon('trash')} Ürünü sil</button><div><button class="button secondary" id="edit-detail">Düzenle</button><a class="button primary" href="${esc(safeUrl(p.url))}" target="_blank" rel="noopener noreferrer">Ürüne git ${icon('external')}</a></div></div>`;
  $('copy-product-accounts').onclick = () => copyVaultData({ products: [p] });
  $('share-product-accounts').onclick = () => openShareDialog(p.id);
  $('detail-content').querySelector('.close-detail').onclick = () => $('detail-dialog').close();
  $('edit-detail').onclick = () => openEditor(id); $('delete-product').onclick = () => deleteProduct(id);
  if (!$('detail-dialog').open) $('detail-dialog').showModal();
}
async function deleteProduct(id) {
  $('confirm-dialog').returnValue = '';
  $('confirm-dialog').showModal();
  const answer = await new Promise(resolve => $('confirm-dialog').addEventListener('close', () => resolve($('confirm-dialog').returnValue), { once: true }));
  if (answer !== 'delete' || !vaultKey) return;
  try { const next = nextData(); next.products = next.products.filter(p => p.id !== id); await persist(next); $('detail-dialog').close(); render(); toast('Ürün ve hesapları silindi.'); } catch (error) { toast(error.message); }
}
// Account-less products can also be deleted from the editor.
const deleteEditor = document.createElement('button'); deleteEditor.type = 'button'; deleteEditor.className = 'button secondary'; deleteEditor.textContent = 'Ürünü sil';
$('product-form').querySelector('.dialog-actions').prepend(deleteEditor);
deleteEditor.onclick = async () => { const id = $('product-id').value; if (id) { await deleteProduct(id); if (!data.products.some(p => p.id === id)) $('product-dialog').close(); } };
const editorObserver = new MutationObserver(() => { deleteEditor.hidden = !$('product-id').value; }); editorObserver.observe($('product-dialog'), { attributes: true, attributeFilter: ['open'] });
$('detail-content').addEventListener('click', async e => {
  const copy = e.target.closest('[data-copy]'), reveal = e.target.closest('[data-reveal]');
  const p = data.products.find(p => p.id === detailId); if (!p) return;
  if (copy) { try { await navigator.clipboard.writeText(p.accounts[Number(copy.dataset.index)][copy.dataset.copy]); toast(copy.dataset.copy === 'password' ? 'Şifre panoya kopyalandı.' : 'Kullanıcı adı kopyalandı.'); } catch { toast('Panoya erişilemedi. Bilgiyi seçerek kopyalayabilirsin.'); } }
  if (reveal) { const value = reveal.parentElement.querySelector('.secret-value'); const shown = reveal.dataset.shown === 'true'; value.textContent = shown ? '••••••••••••' : p.accounts[Number(reveal.dataset.reveal)].password; reveal.dataset.shown = String(!shown); reveal.ariaLabel = shown ? 'Şifreyi göster' : 'Şifreyi gizle'; }
});
document.addEventListener('click', async e => {
  const cat = e.target.closest('[data-category]'); if (cat) { category = cat.dataset.category; render(); }
  const nav = e.target.closest('[data-view]'); if (nav) { view = nav.dataset.view; category = 'all'; $('search').value = ''; render(); }
  const action = e.target.closest('[data-action]'); if (!action || action.disabled) return;
  const id = action.closest('[data-id]')?.dataset.id;
  if (action.dataset.action === 'add') openEditor();
  if (action.dataset.action === 'edit') openEditor(id);
  if (action.dataset.action === 'detail') openDetail(id);
  if (action.dataset.action === 'copy-all') { const product = data.products.find(p => p.id === id); if (product) await copyVaultData({ products: [product] }); }
  if (action.dataset.action === 'favorite') { action.disabled = true; try { const next = nextData(); const p = next.products.find(p => p.id === id); p.favorite = !p.favorite; await persist(next); render(); } catch (error) { action.disabled = false; toast(error.message); } }
});
$('search').addEventListener('input', render); $('sort').addEventListener('change', render); $('lock').onclick = lockVault;
document.addEventListener('keydown', e => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.querySelector('dialog[open]')) { e.preventDefault(); $('search').focus(); } });
$('backup').onclick = () => {
  if (!vaultKey) return showAuth();
  try { const raw = localStorage.getItem(STORAGE_KEY); if (!raw) throw new Error('Kasa bulunamadı.'); const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = `linkportal-yedek-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Şifreli yedeğin indirildi.'); } catch (error) { toast(error.message); }
};
async function copyVaultData(snapshot) {
  const sessionKey = vaultKey;
  if (!sessionKey) return showAuth();
  const text = formatVaultText(snapshot);
  try { await navigator.clipboard.writeText(text); if (vaultKey === sessionKey) toast('Link, kullanıcı adları ve şifreler kopyalandı.'); }
  catch {
    if (vaultKey !== sessionKey) return;
    $('copy-plain-text').value = text; $('copy-plain-dialog').showModal(); $('copy-plain-text').select();
  }
}
$('copy-plain-dialog').addEventListener('close', () => { $('copy-plain-text').value = ''; });
function invalidateShare() {
  shareRequest++; $('share-result').hidden = true; $('share-link').value = ''; $('create-share').disabled = false;
}
function updateShareSelection() {
  let products = 0, accounts = 0;
  $('share-selection').querySelectorAll('[data-share-product]').forEach(input => {
    const children = [...$('share-selection').querySelectorAll(`[data-share-account="${input.dataset.shareProduct}"]`)];
    if (children.length) {
      const count = children.filter(child => child.checked).length;
      input.checked = count === children.length; input.indeterminate = count > 0 && count < children.length;
      accounts += count; if (count) products++;
    } else if (input.checked) products++;
  });
  $('share-selection-summary').textContent = `${products} ürün · ${accounts} hesap seçildi`;
}
function selectedShareData() {
  const selections = [];
  data.products.forEach((product, index) => {
    const accountIndexes = [...$('share-selection').querySelectorAll(`[data-share-account="${index}"]:checked`)].map(input => Number(input.dataset.accountIndex));
    const productChecked = $('share-selection').querySelector(`[data-share-product="${index}"]`)?.checked;
    if (accountIndexes.length || productChecked) selections.push({ productId: product.id, accountIndexes });
  });
  return selectVaultData(data, selections);
}
function openShareDialog(productId) {
  if (!vaultKey) return showAuth();
  if ($('detail-dialog').open) $('detail-dialog').close();
  $('share-form').reset(); $('share-error').textContent = ''; $('share-result').hidden = true;
  $('share-selection').innerHTML = data.products.map((product, index) => `<section class="share-product"><label class="share-product-choice"><input type="checkbox" data-share-product="${index}" ${product.id === productId ? 'checked' : ''}><span><strong>${esc(product.name)}</strong><small>${esc(product.url)}</small></span></label>${product.accounts.map((account, accountIndex) => `<label class="share-account-choice"><input type="checkbox" data-share-account="${index}" data-account-index="${accountIndex}" ${product.id === productId ? 'checked' : ''}><span>${esc(account.username)}</span></label>`).join('')}</section>`).join('');
  updateShareSelection();
  $('share-local-hint').hidden = !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  $('share-dialog').showModal();
}
$('share').onclick = () => openShareDialog();
$('share-selection').addEventListener('change', e => {
  if (e.target.dataset.shareProduct !== undefined) $('share-selection').querySelectorAll(`[data-share-account="${e.target.dataset.shareProduct}"]`).forEach(input => { input.checked = e.target.checked; });
  invalidateShare(); updateShareSelection();
});
for (const [id, checked] of [['share-select-all', true], ['share-select-none', false]]) $(id).onclick = () => {
  $('share-selection').querySelectorAll('input').forEach(input => { input.checked = checked; input.indeterminate = false; });
  invalidateShare(); updateShareSelection();
};
for (const id of ['share-password', 'share-password-confirm']) $(id).addEventListener('input', invalidateShare);
$('copy-selected').onclick = async () => {
  try { $('share-error').textContent = ''; await copyVaultData(selectedShareData()); }
  catch (error) { $('share-error').textContent = error.message; }
};
$('share-dialog').addEventListener('close', () => {
  shareRequest++; $('share-form').reset(); $('share-link').value = ''; $('share-result').hidden = true;
  $('share-selection').replaceChildren(); $('share-selection-summary').textContent = '';
  $('create-share').disabled = false;
});
$('share-form').addEventListener('submit', async e => {
  e.preventDefault(); $('share-error').textContent = ''; $('share-result').hidden = true; $('share-link').value = '';
  const sessionKey = vaultKey, request = ++shareRequest;
  $('create-share').disabled = true;
  try {
    if (!sessionKey) throw new Error('Önce kasanı aç.');
    const password = $('share-password').value;
    if (password !== $('share-password-confirm').value) throw new Error('Paylaşım parolaları eşleşmiyor.');
    const link = await createShareLink(selectedShareData(), password, location.href);
    if (vaultKey !== sessionKey || request !== shareRequest || !$('share-dialog').open) return;
    $('share-link').value = link; $('share-result').hidden = false;
    $('share-password').value = ''; $('share-password-confirm').value = '';
  } catch (error) { if (request === shareRequest) $('share-error').textContent = error.message; }
  finally { if (request === shareRequest) $('create-share').disabled = false; }
});
$('copy-share').onclick = async () => {
  try { await navigator.clipboard.writeText($('share-link').value); toast('Paylaşım bağlantısı kopyalandı. Parolayı ayrı ilet.'); }
  catch { $('share-link').focus(); $('share-link').select(); toast('Bağlantıyı seçerek kopyalayabilirsin.'); }
};
$('import').onclick = $('auth-import').onclick = () => $('import-file').click();
$('import-file').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  try {
    if (file.size > 10000000) throw new Error('Yedek dosyası en fazla 10 MB olabilir.');
    const envelope = JSON.parse(await file.text());
    if (envelope.version !== 1 || !envelope.salt || !envelope.iv || !envelope.ciphertext) throw new Error('Geçerli bir LinkPortal yedeği seç.');
    if (!window.confirm('Yedek, parolası doğrulandıktan sonra bu tarayıcıdaki mevcut kasanın yerini alacak. Devam edilsin mi?')) return;
    shareImport = false; lockVault(); importEnvelope = envelope; showAuth();
  } catch (error) { toast(error instanceof SyntaxError ? 'Yedek dosyası okunamadı.' : error.message); }
  finally { e.target.value = ''; }
});
for (const event of ['pointerdown', 'keydown', 'mousemove', 'touchstart']) document.addEventListener(event, () => { lastActivity = Date.now(); }, { passive: true });
setInterval(() => { if (vaultKey && Date.now() - lastActivity > 5 * 60 * 1000) lockVault(); }, 10000);
window.addEventListener('storage', e => { if (e.key === STORAGE_KEY || e.key === null) { importEnvelope = null; shareImport = false; lockVault(); $('auth-error').textContent = 'Kasa başka bir sekmede değişti. Yeniden giriş yap.'; } });
function receiveShare() {
  if (!location.hash.startsWith('#share=')) return;
  const fragment = location.hash;
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const envelope = parseShareFragment(fragment);
    importEnvelope = null; shareImport = false; lockVault();
    importEnvelope = envelope; shareImport = true; showAuth();
  } catch (error) { toast(error.message); $('auth-error').textContent = error.message; }
}
render(); showAuth(); receiveShare();
window.addEventListener('hashchange', receiveShare);

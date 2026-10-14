export const STORAGE_KEY = 'linkportal.vault.v1';
const enc = new TextEncoder();
const to64 = bytes => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
};
const from64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
export async function deriveKey(password, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function encryptVault(data, key, salt) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data))));
  return { version: 1, salt: to64(salt), iv: to64(iv), ciphertext: to64(ciphertext) };
}
export async function unlockVault(envelope, password) {
  if (envelope.version !== 1 || typeof envelope.salt !== 'string' || typeof envelope.iv !== 'string' || typeof envelope.ciphertext !== 'string') throw new Error('Geçersiz kasa dosyası.');
  const salt = from64(envelope.salt);
  if (salt.length !== 16) throw new Error('Geçersiz kasa dosyası.');
  const key = await deriveKey(password, salt);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: from64(envelope.iv) }, key, from64(envelope.ciphertext));
  const data = JSON.parse(new TextDecoder().decode(plain));
  validateData(data);
  return { key, salt, data };
}
export function safeUrl(value) {
  const url = new URL(value.includes('://') ? value : `https://${value}`);
  if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error('Geçerli bir http veya https adresi girin.');
  return url.href;
}
export function validateData(data) {
  if (!data || !Array.isArray(data.products) || data.products.length > 10000) throw new Error('Geçersiz kasa içeriği.');
  const ids = new Set();
  for (const p of data.products) {
    if (typeof p.id !== 'string' || ids.has(p.id) || typeof p.name !== 'string' || !p.name.trim() || typeof p.category !== 'string' || typeof p.notes !== 'string' || typeof p.favorite !== 'boolean' || !Array.isArray(p.accounts)) throw new Error('Geçersiz ürün kaydı.');
    ids.add(p.id); safeUrl(p.url);
    for (const a of p.accounts) if (!a || !['id', 'label', 'username', 'password'].every(k => typeof a[k] === 'string')) throw new Error('Geçersiz hesap kaydı.');
  }
}

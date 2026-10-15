import { deriveKey, encryptVault, validateData } from './vault.mjs';

export const MAX_SHARE_LENGTH = 64000;
const prefix = '#share=';
const invalid = () => new Error('Paylaşım bağlantısı geçersiz veya eksik.');

export function selectVaultData(data, selections) {
  validateData(data);
  if (!Array.isArray(selections) || !selections.length) throw new Error('Paylaşmak için en az bir ürün veya hesap seç.');
  const seen = new Set();
  const products = selections.map(({ productId, accountIndexes }) => {
    const product = data.products.find(item => item.id === productId);
    if (!product || seen.has(productId) || !Array.isArray(accountIndexes)) throw new Error('Paylaşım seçimi geçersiz.');
    seen.add(productId);
    const indexes = new Set(accountIndexes);
    if ([...indexes].some(index => !Number.isInteger(index) || index < 0 || index >= product.accounts.length)) throw new Error('Paylaşım seçimi geçersiz.');
    return { ...product, accounts: product.accounts.filter((_, index) => indexes.has(index)) };
  });
  return structuredClone({ products });
}

export async function createShareLink(data, password, baseUrl) {
  if (typeof password !== 'string' || password.length < 6) throw new Error('En az 6 karakterlik bir paylaşım parolası belirle.');
  validateData(data);
  // Copy before deriving the key: later edits must not change this snapshot.
  const snapshot = structuredClone(data);
  const url = new URL(baseUrl);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Geçerli bir portal adresi gerekli.');
  url.search = '';
  url.hash = '';
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt);
  const envelope = await encryptVault(snapshot, key, salt);
  const payload = btoa(JSON.stringify(envelope)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  url.hash = `share=${payload}`;
  if (url.href.length > MAX_SHARE_LENGTH) throw new Error('Kasan bağlantıyla paylaşmak için çok büyük. Şifreli yedek indirerek paylaşabilirsin.');
  return url.href;
}

export function parseShareFragment(fragment) {
  if (!fragment.startsWith(prefix)) return null;
  if (fragment.length > MAX_SHARE_LENGTH) throw invalid();
  try {
    const payload = fragment.slice(prefix.length);
    if (!/^[A-Za-z0-9_-]+$/.test(payload)) throw invalid();
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const envelope = JSON.parse(atob(base64));
    if (!envelope || envelope.version !== 1) throw invalid();
    for (const field of ['salt', 'iv', 'ciphertext']) {
      const value = envelope[field];
      if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) throw invalid();
    }
    if (atob(envelope.salt).length !== 16 || atob(envelope.iv).length !== 12 || atob(envelope.ciphertext).length < 16) throw invalid();
    return { version: 1, salt: envelope.salt, iv: envelope.iv, ciphertext: envelope.ciphertext };
  } catch { throw invalid(); }
}

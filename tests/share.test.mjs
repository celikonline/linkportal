import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createShareLink, parseShareFragment, MAX_SHARE_LENGTH, selectVaultData } from '../share.mjs';
import { unlockVault } from '../vault.mjs';

const example = () => ({ products: [{ id: 'p1', name: 'Türkçe ürün 🔒', category: 'İş', url: 'https://example.com/', notes: '<script>alert(1)</script>', favorite: true, accounts: [{ id: 'a1', label: 'İş', username: 'test@example.com', password: 'private-account-password' }] }] });
const password = 'abc123';

test('share links preserve an encrypted snapshot with an independent password and no query data', async () => {
  const data = example(), expected = structuredClone(data);
  const pending = createShareLink(data, password, 'https://link.example.com/?tracking=1#old');
  data.products[0].accounts[0].password = 'changed-later';
  const link = await pending;
  const url = new URL(link);
  assert.equal(url.origin, 'https://link.example.com');
  assert.equal(url.search, '');
  assert.ok(url.hash.startsWith('#share='));
  const envelope = parseShareFragment(url.hash);
  assert.ok(!JSON.stringify(envelope).includes('private-account-password'));
  assert.deepEqual((await unlockVault(envelope, password)).data, expected);
  await assert.rejects(unlockVault(envelope, 'original-master-password'));
  const second = parseShareFragment(new URL(await createShareLink(expected, password, url.origin)).hash);
  assert.notEqual(envelope.salt, second.salt);
  assert.notEqual(envelope.iv, second.iv);
  const bytes = Buffer.from(envelope.ciphertext, 'base64'); bytes[0] ^= 1;
  await assert.rejects(unlockVault({ ...envelope, ciphertext: bytes.toString('base64') }, password));
});

test('share input rejects weak passwords, malformed payloads, unsafe destinations and oversized links', async () => {
  await assert.rejects(createShareLink(example(), 'short', 'https://example.com'), /6 karakter/);
  await assert.rejects(createShareLink(example(), password, 'javascript:alert(1)'), /portal adresi/);
  await assert.rejects(createShareLink(example(), password, 'https://user:pass@example.com'), /portal adresi/);
  assert.equal(parseShareFragment('#other'), null);
  for (const hash of ['#share=', '#share=%%%', '#share=' + 'x'.repeat(MAX_SHARE_LENGTH), '#share=' + btoa('null'), '#share=' + btoa('{}')]) assert.throws(() => parseShareFragment(hash), /geçersiz/);
  for (const invalid of [
    { version: 2 },
    { version: 1, salt: 'AAAA', iv: 'AAAA', ciphertext: 'AAAA' },
    { version: 1, salt: [], iv: 'AAAA', ciphertext: 'AAAA' },
  ]) assert.throws(() => parseShareFragment('#share=' + btoa(JSON.stringify(invalid)).replace(/=+$/, '')), /geçersiz/);
  const large = example(); large.products[0].notes = 'x'.repeat(MAX_SHARE_LENGTH);
  await assert.rejects(createShareLink(large, password, 'https://example.com'), /çok büyük/);
});

test('selective sharing encrypts only the chosen account, including when imported account IDs repeat', async () => {
  const data = example();
  data.products[0].accounts.push({ id: 'a1', label: '', username: 'exclude-me', password: 'excluded-secret' });
  data.products.push({ ...structuredClone(data.products[0]), id: 'p2', name: 'Unselected product' });
  data.products.push({ id: 'link-only', name: 'Sadece link', category: 'İş', url: 'https://link.example.com', notes: '', favorite: false, accounts: [] });
  const selected = selectVaultData(data, [{ productId: 'p1', accountIndexes: [0] }, { productId: 'link-only', accountIndexes: [] }]);
  assert.equal(selected.products.length, 2);
  assert.equal(selected.products[0].accounts.length, 1);
  assert.ok(!JSON.stringify(selected).includes('exclude-me'));
  const link = await createShareLink(selected, password, 'https://example.com/');
  const opened = await unlockVault(parseShareFragment(new URL(link).hash), password);
  assert.deepEqual(opened.data, selected);
  assert.ok(!JSON.stringify(opened.data).includes('excluded-secret'));
  selected.products[0].accounts[0].password = 'changed-copy';
  assert.equal(data.products[0].accounts[0].password, 'private-account-password');
  assert.throws(() => selectVaultData(data, []), /en az bir/);
  for (const selection of [[{ productId: 'missing', accountIndexes: [] }], [{ productId: 'p1', accountIndexes: [9] }], [{ productId: 'p1', accountIndexes: [-1] }]]) assert.throws(() => selectVaultData(data, selection), /geçersiz/);
});

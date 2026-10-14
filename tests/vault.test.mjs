import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveKey, encryptVault, unlockVault, safeUrl } from '../vault.mjs';
const example = { products: [{ id: 'p1', name: 'Test ürün', category: 'Test', url: 'https://example.com/', notes: '', favorite: false, accounts: [{ id: 'a1', label: 'İş', username: 'test@example.com', password: 'secret-for-test' }, { id: 'a2', label: 'Kişisel', username: 'other', password: 'different' }] }] };
test('encrypted vault round trip, independent IVs, wrong passwords and tamper rejection', async () => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey('a-long-test-password', salt);
  const envelope = await encryptVault(example, key, salt);
  assert.ok(!JSON.stringify(envelope).includes('secret-for-test'));
  assert.ok(!JSON.stringify(envelope).includes('test@example.com'));
  assert.deepEqual((await unlockVault(envelope, 'a-long-test-password')).data, example);
  assert.notEqual((await encryptVault(example, key, salt)).iv, envelope.iv);
  await assert.rejects(unlockVault(envelope, 'incorrect-password'));
  const bytes = Buffer.from(envelope.ciphertext, 'base64'); bytes[3] ^= 1;
  await assert.rejects(unlockVault({ ...envelope, ciphertext: bytes.toString('base64') }, 'a-long-test-password'));
});
test('only web URLs without embedded credentials are accepted', () => {
  assert.equal(safeUrl('example.com'), 'https://example.com/');
  assert.equal(safeUrl('https://example.com/path?q=1'), 'https://example.com/path?q=1');
  for (const value of ['javascript://alert(1)', 'data://text/html,test', 'file:///etc/passwd', 'https://user:secret@example.com']) assert.throws(() => safeUrl(value));
});
test('invalid imported account records are rejected after decryption', async () => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey('a-long-test-password', salt);
  const invalid = structuredClone(example); invalid.products[0].accounts[0].password = 123;
  const envelope = await encryptVault(invalid, key, salt);
  await assert.rejects(unlockVault(envelope, 'a-long-test-password'), /Geçersiz hesap/);
});

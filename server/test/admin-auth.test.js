'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createAdminAuth } = require('../admin-auth');

test('帳密沒設 → 後台關閉，任何帳密都登不進去', () => {
  const a = createAdminAuth({});
  assert.equal(a.enabled, false);
  assert.equal(a.checkLogin('admin', 'souland2026'), false);
  assert.equal(a.checkLogin('', ''), false);
});

test('只設帳號沒設密碼 → 仍關閉', () => {
  assert.equal(createAdminAuth({ ADMIN_USER: 'admin' }).enabled, false);
});

test('舊預設帳密 admin/souland2026 不再有效', () => {
  const a = createAdminAuth({ ADMIN_USER: 'ops', ADMIN_PASS: 'S3cure-pass' });
  assert.equal(a.checkLogin('admin', 'souland2026'), false);
  assert.equal(a.checkLogin('ops', 'S3cure-pass'), true);
  assert.equal(a.checkLogin('ops', 'S3cure-pas'), false);
});

test('token 簽發後可驗證，竄改或過期都失效', () => {
  const a = createAdminAuth({ ADMIN_USER: 'ops', ADMIN_PASS: 'p', ADMIN_SECRET: 'x'.repeat(40) });
  const t = a.signToken('ops');
  assert.equal(a.verifyToken(t), 'ops');
  const [u, exp, sig] = t.split('.');
  assert.equal(a.verifyToken([u, exp, sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A')].join('.')), null);
  assert.equal(a.verifyToken([Buffer.from('admin').toString('base64url'), exp, sig].join('.')), null);
  assert.equal(a.verifyToken(a.signToken('ops', -1000)), null);
  assert.equal(a.verifyToken('garbage'), null);
});

test('舊的公開預設密鑰簽出的 token 不被接受', () => {
  const old = createAdminAuth({ ADMIN_USER: 'admin', ADMIN_PASS: 'x', ADMIN_SECRET: 'souland-scent-island-secret-change-me' });
  const forged = old.signToken('admin');
  const now = createAdminAuth({ ADMIN_USER: 'admin', ADMIN_PASS: 'x' }); // ADMIN_SECRET 未設 → 隨機
  assert.equal(now.verifyToken(forged), null);
});

test('ADMIN_SECRET 未設時每個實例的密鑰不同', () => {
  const env = { ADMIN_USER: 'a', ADMIN_PASS: 'b' };
  const t = createAdminAuth(env).signToken('a');
  assert.equal(createAdminAuth(env).verifyToken(t), null);
});

// API 測試：真的啟動 server.js，對 /api/admin/* 發請求
const { spawn } = require('child_process');
const path = require('path');
const SERVER = path.join(__dirname, '..', 'server.js');

async function boot(port, extraEnv) {
  const env = { ...process.env, PORT: String(port), ADMIN_USER: '', ADMIN_PASS: '', ADMIN_SECRET: '', ...extraEnv };
  const p = spawn(process.execPath, [SERVER], { env, cwd: path.dirname(SERVER) });
  let log = ''; p.stdout.on('data', d => log += d); p.stderr.on('data', d => log += d);
  for (let i = 0; i < 50; i++) {
    try { await fetch(`http://localhost:${port}/api/health`); return { p, log: () => log }; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  p.kill(); throw new Error('server 沒起來\n' + log);
}
const post = (port, url, body) => fetch(`http://localhost:${port}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const results = [];
const check = (name, ok, detail) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); };

(async () => {
  // 情境 1：.env 沒設帳密
  let s = await boot(3901, {});
  let r = await post(3901, '/api/admin/login', { username: 'admin', password: 'souland2026' });
  check('沒設帳密時，用舊預設帳密登入 → 503（預期失敗）', r.status === 503, `status=${r.status} ${JSON.stringify(await r.json())}`);
  r = await fetch('http://localhost:3901/api/admin/brands');
  check('沒設帳密時，不帶 token 讀後台 → 401（預期失敗）', r.status === 401, `status=${r.status}`);
  check('啟動訊息顯示後台未啟用', /後台: 未啟用/.test(s.log()), '');
  s.p.kill();

  // 情境 2：.env 有設帳密
  s = await boot(3902, { ADMIN_USER: 'ops', ADMIN_PASS: 'S3cure-pass' });
  r = await post(3902, '/api/admin/login', { username: 'admin', password: 'souland2026' });
  check('有設帳密時，舊預設帳密 → 401（預期失敗）', r.status === 401, `status=${r.status}`);
  r = await post(3902, '/api/admin/login', { username: 'ops', password: 'S3cure-pass' });
  const j = await r.json();
  check('正確帳密 → 200 拿到 token', r.status === 200 && !!j.token, `status=${r.status}`);
  r = await fetch('http://localhost:3902/api/admin/me', { headers: { Authorization: 'Bearer ' + j.token } });
  check('帶 token 讀 /api/admin/me → 200', r.status === 200, `status=${r.status} ${JSON.stringify(await r.json())}`);
  r = await fetch('http://localhost:3902/api/admin/brands', { headers: { Authorization: 'Bearer ' + j.token } });
  check('帶 token 讀品牌列表 → 200', r.status === 200, `status=${r.status}`);
  // 用舊的公開預設密鑰自己簽 token
  const crypto = require('crypto');
  const head = Buffer.from('admin').toString('base64url') + '.' + (Date.now() + 3600e3);
  const forged = head + '.' + crypto.createHmac('sha256', 'souland-scent-island-secret-change-me').update(head).digest('base64url');
  r = await fetch('http://localhost:3902/api/admin/brands', { headers: { Authorization: 'Bearer ' + forged } });
  check('用舊公開密鑰偽造的 token → 401（預期失敗）', r.status === 401, `status=${r.status}`);
  s.p.kill();

  console.log(`\n${results.filter(Boolean).length}/${results.length} 通過`);
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });

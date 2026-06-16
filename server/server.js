/* ============================================================
   嗅覺島 SOULAND 2026 — 報名 + 金流後端
   - 靜態站服務 (../public)
   - POST /api/register        報名 → 寫入 Google Sheet (Apps Script webhook) + 本機備份
   - POST /api/payment/ecpay   建立綠界 ECPay (測試/STAGE) 付款表單
   - POST /api/payment/result  綠界付款結果 (browser redirect, OrderResultURL)
   - POST /api/payment/notify  綠界 server-to-server 通知 (ReturnURL，需公開網址)
   ============================================================ */
'use strict';

const express = require('express');
const crypto  = require('crypto');
const path    = require('path');
const fs      = require('fs');

// —— .env (簡易載入，無外部依賴) ——
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
}

const app  = express();
const PORT  = process.env.PORT || 3000;
const BASE  = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;

// —— 綠界 ECPay 測試 (STAGE) 公開測試特店；正式上線改 .env ——
const ECPAY = {
  MerchantID: process.env.ECPAY_MERCHANT_ID || '2000132',
  HashKey:    process.env.ECPAY_HASH_KEY    || '5294y06JbISpM5x9',
  HashIV:     process.env.ECPAY_HASH_IV     || 'v77hoKGq4kWxNNIS',
  ApiUrl:     process.env.ECPAY_API_URL     || 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5'
};
const SHEET_WEBHOOK = process.env.REGISTRATION_WEBHOOK_URL || ''; // Apps Script /exec URL

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// 開發/預覽期間關閉快取，避免瀏覽器顯示舊版（html/js/css 一律拿最新）
app.use(express.static(path.join(__dirname, '..', 'public'), {
  etag: false, lastModified: false,
  setHeaders: (res, p) => { if (/\.(html|js|css)$/.test(p)) res.setHeader('Cache-Control', 'no-store, max-age=0'); }
}));

// 本機報名備份
const DATA = path.join(__dirname, 'registrations.json');
const loadAll = () => fs.existsSync(DATA) ? JSON.parse(fs.readFileSync(DATA, 'utf8')) : [];
const saveAll = (a) => fs.writeFileSync(DATA, JSON.stringify(a, null, 2));

/* ---------- 寫入 Google Sheet (Apps Script webhook) ---------- */
async function pushToSheet(row) {
  if (!SHEET_WEBHOOK) return { ok: false, skipped: true, reason: 'REGISTRATION_WEBHOOK_URL 未設定，僅存本機' };
  try {
    const r = await fetch(SHEET_WEBHOOK, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row)
    });
    const t = await r.text();
    return { ok: r.ok, body: t };
  } catch (e) { return { ok: false, error: e.message }; }
}

/* ============================================================
   報名 → Google Sheet
   ============================================================ */
app.post('/api/register', async (req, res) => {
  const b = req.body || {};
  const s = (v) => (v ?? '').toString().trim();
  // docx 完整欄位（向後相容舊命名）
  const f = {
    companyZh: s(b.companyZh), companyEn: s(b.companyEn),
    brandZh:   s(b.brandZh ?? b.brand), brandEn: s(b.brandEn),
    displayName: s(b.displayName), taxId: s(b.taxId),
    address: s(b.address), zip: s(b.zip),
    contact: s(b.contact ?? b.name), owner: s(b.owner),
    phone: s(b.phone), mobile: s(b.mobile),
    email: s(b.email ?? b.mail), website: s(b.website),
    ig: s(b.ig), fb: s(b.fb),
    foundedYear: s(b.foundedYear), origin: s(b.origin),
    categories: Array.isArray(b.categories) ? b.categories.join('、') : s(b.categories),
    plan: s(b.plan ?? b.planName), qty: parseInt(b.qty, 10) || 1,
    priceType: s(b.priceType) || '一般', msg: s(b.msg ?? b.notes)
  };

  const miss = [];
  if (!f.brandZh && !f.companyZh) miss.push('公司/品牌名稱');
  if (!f.contact) miss.push('聯絡人');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) miss.push('有效 Email');
  if (!f.plan) miss.push('攤位方案');
  if (miss.length) return res.status(400).json({ ok: false, error: '缺少/格式錯誤: ' + miss.join('、') });

  const unit     = parseInt(b.unit, 10) || 0;
  const subtotal = parseInt(b.subtotal, 10) || unit * f.qty;
  const deposit  = parseInt(b.deposit, 10) || 10000 * f.qty;
  const downpay  = parseInt(b.downpay, 10) || Math.round(subtotal * 0.5);
  const payable  = parseInt(b.payable, 10) || downpay + deposit;

  const orderId = 'SI' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
  const record = {
    orderId, timestamp: new Date().toISOString(), status: 'pending_remit',
    ...f, unit, subtotal, deposit, downpay, payable
  };

  const all = loadAll(); all.push(record); saveAll(all);
  const sheet = await pushToSheet({ formType: 'vendor', action: 'register', ...record });

  console.log(`[register] ${orderId} ${f.brandZh || f.companyZh} ${f.plan}×${f.qty} (${f.priceType}) payable=${payable} sheet=${sheet.ok ? 'OK' : (sheet.skipped ? 'local-only' : 'FAIL')}`);
  res.json({ ok: true, orderId, payable, downpay, deposit, sheet });
});

/* ============================================================
   綠界 ECPay CheckMacValue
   ============================================================ */
function ecpayEncode(s) {
  // encodeURIComponent + 補編 JS 略過的字元，貼齊 .NET HttpUtility.UrlEncode
  return encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}
function genCheckMacValue(params) {
  const keys = Object.keys(params).sort((a, b) => {
    const x = a.toLowerCase(), y = b.toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  });
  let raw = 'HashKey=' + ECPAY.HashKey;
  keys.forEach(k => { raw += '&' + k + '=' + params[k]; });
  raw += '&HashIV=' + ECPAY.HashIV;
  let enc = ecpayEncode(raw).toLowerCase();
  enc = enc.replace(/%2d/g, '-').replace(/%5f/g, '_').replace(/%2e/g, '.')
           .replace(/%21/g, '!').replace(/%2a/g, '*').replace(/%28/g, '(')
           .replace(/%29/g, ')').replace(/%20/g, '+');
  return crypto.createHash('sha256').update(enc).digest('hex').toUpperCase();
}

/* ---------- 建立付款表單 ---------- */
app.post('/api/payment/ecpay', (req, res) => {
  const { orderId, amount, item } = req.body || {};
  const amt = parseInt(amount, 10);
  if (!orderId || !amt || amt < 1) return res.status(400).json({ ok: false, error: '訂單或金額無效' });

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const tradeDate = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const tradeNo = (orderId.replace(/[^A-Z0-9]/gi, '') + Date.now().toString(36)).toUpperCase().slice(0, 20);
  const itemName = String(item || '嗅覺島2026參展費用').replace(/[+×（）()]/g, ' ').slice(0, 100);

  const params = {
    MerchantID: ECPAY.MerchantID,
    MerchantTradeNo: tradeNo,
    MerchantTradeDate: tradeDate,
    PaymentType: 'aio',
    TotalAmount: amt,
    TradeDesc: ecpayEncode('嗅覺島 SOULAND 2026 參展報名'),
    ItemName: itemName,
    ReturnURL: `${BASE}/api/payment/notify`,        // server-to-server (需公開網址)
    OrderResultURL: `${BASE}/api/payment/result`,   // browser redirect (本機可用)
    ClientBackURL: `${BASE}/payment-complete.html`,
    ChoosePayment: 'ALL',
    EncryptType: 1,
    CustomField1: orderId
  };
  params.CheckMacValue = genCheckMacValue(params);

  // 記下 tradeNo ↔ orderId 對應
  const all = loadAll();
  const rec = all.find(r => r.orderId === orderId);
  if (rec) { rec.tradeNo = tradeNo; rec.payAmount = amt; saveAll(all); }

  const inputs = Object.entries(params)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${String(v).replace(/"/g, '&quot;')}">`).join('');
  const formHtml = `<form id="ecpayGo" method="post" action="${ECPAY.ApiUrl}">${inputs}</form>`;

  res.json({ ok: true, formHtml, tradeNo });
});

/* ---------- 付款結果 (browser, OrderResultURL) ---------- */
app.post('/api/payment/result', (req, res) => {
  const data = { ...req.body };
  const recv = data.CheckMacValue; delete data.CheckMacValue;
  const calc = genCheckMacValue(data);
  const valid = recv === calc;
  const success = valid && String(data.RtnCode) === '1';
  const orderId = data.CustomField1 || '';

  // 更新本機 + Sheet
  const all = loadAll();
  const rec = all.find(r => r.orderId === orderId || r.tradeNo === data.MerchantTradeNo);
  if (rec) { rec.status = success ? 'paid' : 'payment_failed'; rec.paidAt = new Date().toISOString(); saveAll(all); }
  pushToSheet({ action: 'payment', orderId, tradeNo: data.MerchantTradeNo, status: success ? 'paid' : 'failed', rtnCode: data.RtnCode, rtnMsg: data.RtnMsg, amount: data.TradeAmt });

  console.log(`[payment] order=${orderId} valid=${valid} rtn=${data.RtnCode} => ${success ? 'PAID' : 'FAILED'}`);
  const q = new URLSearchParams({ status: success ? 'success' : 'fail', order: orderId, msg: data.RtnMsg || '' });
  res.redirect(`/payment-complete.html?${q.toString()}`);
});

/* ---------- server-to-server 通知 (ReturnURL) ---------- */
app.post('/api/payment/notify', (req, res) => {
  const data = { ...req.body };
  const recv = data.CheckMacValue; delete data.CheckMacValue;
  const valid = recv === genCheckMacValue(data);
  const orderId = data.CustomField1 || '';
  if (valid && String(data.RtnCode) === '1') {
    const all = loadAll();
    const rec = all.find(r => r.orderId === orderId || r.tradeNo === data.MerchantTradeNo);
    if (rec && rec.status !== 'paid') { rec.status = 'paid'; rec.paidAt = new Date().toISOString(); saveAll(all); }
    pushToSheet({ action: 'payment', orderId, tradeNo: data.MerchantTradeNo, status: 'paid', source: 'notify' });
  }
  res.send(valid ? '1|OK' : '0|CheckMacValue Error');
});

/* ============================================================
   Admin 後台：帳密登入 + 參展廠商(品牌) CRUD
   ============================================================ */
const ADMIN_USER   = process.env.ADMIN_USER   || 'admin';
const ADMIN_PASS   = process.env.ADMIN_PASS   || 'souland2026';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'souland-scent-island-secret-change-me';
const BRANDS_DB = path.join(__dirname, 'brands.json');
const loadBrands = () => fs.existsSync(BRANDS_DB) ? JSON.parse(fs.readFileSync(BRANDS_DB, 'utf8')) : [];
const saveBrands = (a) => fs.writeFileSync(BRANDS_DB, JSON.stringify(a, null, 2));

// 無狀態簽章 token：base64url(user).exp.HMAC
function signToken(user, ttlMs = 8 * 3600 * 1000) {
  const exp = Date.now() + ttlMs;
  const head = Buffer.from(user).toString('base64url') + '.' + exp;
  const sig = crypto.createHmac('sha256', ADMIN_SECRET).update(head).digest('base64url');
  return head + '.' + sig;
}
function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const head = parts[0] + '.' + parts[1];
  const sig = crypto.createHmac('sha256', ADMIN_SECRET).update(head).digest('base64url');
  if (sig !== parts[2]) return null;
  if (Date.now() > Number(parts[1])) return null;
  return Buffer.from(parts[0], 'base64url').toString();
}
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : (req.query.token || '');
  const user = verifyToken(token);
  if (!user) return res.status(401).json({ ok: false, error: '未授權或登入逾時' });
  req.adminUser = user; next();
}

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    return res.json({ ok: true, token: signToken(username), user: username });
  }
  res.status(401).json({ ok: false, error: '帳號或密碼錯誤' });
});

app.get('/api/admin/me', requireAdmin, (req, res) => res.json({ ok: true, user: req.adminUser }));

// 廠商列表（後台，含未發布）
app.get('/api/admin/brands', requireAdmin, (req, res) => res.json({ ok: true, brands: loadBrands() }));

// 新增 / 更新
function normBrand(b, existing) {
  return {
    id: existing ? existing.id : 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    name: (b.name || '').toString(), en: (b.en || '').toString(),
    type: (b.type || '').toString(), country: (b.country || '').toString(),
    booth: (b.booth || '').toString(),
    top: (b.top || '').toString(), heart: (b.heart || '').toString(), base: (b.base || '').toString(),
    story: (b.story || '').toString(), social: (b.social || '').toString(), logo: (b.logo || '').toString(),
    products: Array.isArray(b.products) ? b.products.map(p => ({
      name: (p.name || '').toString(), note: (p.note || '').toString(), desc: (p.desc || '').toString()
    })) : [],
    published: b.published !== false,
    updatedAt: new Date().toISOString()
  };
}
app.post('/api/admin/brands', requireAdmin, (req, res) => {
  const b = req.body || {};
  if (!String(b.name || '').trim()) return res.status(400).json({ ok: false, error: '品牌名稱必填' });
  const all = loadBrands();
  const rec = normBrand(b);
  all.push(rec); saveBrands(all);
  res.json({ ok: true, brand: rec });
});
app.put('/api/admin/brands/:id', requireAdmin, (req, res) => {
  const all = loadBrands();
  const i = all.findIndex(x => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ ok: false, error: '找不到該廠商' });
  all[i] = normBrand({ ...all[i], ...req.body }, all[i]);
  saveBrands(all);
  res.json({ ok: true, brand: all[i] });
});
app.delete('/api/admin/brands/:id', requireAdmin, (req, res) => {
  const all = loadBrands();
  const next = all.filter(x => x.id !== req.params.id);
  if (next.length === all.length) return res.status(404).json({ ok: false, error: '找不到該廠商' });
  saveBrands(next);
  res.json({ ok: true });
});

// 公開：已發布的參展品牌（給 index 參展品牌頁讀）
app.get('/api/brands', (req, res) => {
  const pub = loadBrands().filter(b => b.published !== false)
    .map(({ updatedAt, published, ...rest }) => rest);
  res.json({ ok: true, brands: pub });
});

// Admin：報名資料（= 報名回寫 Sheet 的同一份資料），含改狀態
app.get('/api/admin/registrations', requireAdmin, (req, res) => {
  res.json({ ok: true, records: loadAll().slice().reverse() });
});
app.put('/api/admin/registrations/:orderId', requireAdmin, (req, res) => {
  const all = loadAll();
  const r = all.find(x => x.orderId === req.params.orderId);
  if (!r) return res.status(404).json({ ok: false, error: '找不到該筆報名' });
  if (req.body.status) r.status = String(req.body.status);
  if (req.body.note != null) r.adminNote = String(req.body.note);
  saveAll(all);
  pushToSheet({ action: 'status', orderId: r.orderId, status: r.status }); // 回寫 Sheet 狀態欄
  res.json({ ok: true, record: r });
});

/* ---------- 管理：查報名 ---------- */
app.get('/api/registrations', (req, res) => {
  if (process.env.ADMIN_KEY && req.query.key !== process.env.ADMIN_KEY)
    return res.status(403).json({ ok: false, error: 'forbidden' });
  res.json({ ok: true, count: loadAll().length, records: loadAll() });
});

app.get('/api/health', (req, res) => res.json({
  ok: true, ecpay: ECPAY.MerchantID === '2000132' ? 'STAGE-TEST' : 'PRODUCTION',
  sheet: SHEET_WEBHOOK ? 'configured' : 'local-only', base: BASE
}));

app.listen(PORT, () => {
  console.log(`\n  嗅覺島 SOULAND  ▸  http://localhost:${PORT}`);
  console.log(`  ECPay: ${ECPAY.MerchantID === '2000132' ? '測試 STAGE (2000132)' : '正式 ' + ECPAY.MerchantID}`);
  console.log(`  Sheet: ${SHEET_WEBHOOK ? 'webhook 已設定' : '未設定 webhook（僅存 registrations.json）'}\n`);
});

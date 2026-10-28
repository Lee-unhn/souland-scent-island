/* ============================================================
   Admin 後台登入：帳密只從環境變數讀，不設預設值
   - ADMIN_USER / ADMIN_PASS 任一未設 → 後台關閉（login 一律拒絕）
   - ADMIN_SECRET 未設 → 每次啟動隨機產生（重啟後舊 token 失效）
   ============================================================ */
const crypto = require('crypto');

function createAdminAuth(env = process.env) {
  const user   = env.ADMIN_USER || '';
  const pass   = env.ADMIN_PASS || '';
  const secret = env.ADMIN_SECRET || crypto.randomBytes(32).toString('hex');
  const enabled = Boolean(user && pass);

  const safeEqual = (a, b) => {
    const x = Buffer.from(String(a)), y = Buffer.from(String(b));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
  };
  const hmac = (head) => crypto.createHmac('sha256', secret).update(head).digest('base64url');

  // 無狀態簽章 token：base64url(user).exp.HMAC
  function signToken(u, ttlMs = 8 * 3600 * 1000) {
    const head = Buffer.from(u).toString('base64url') + '.' + (Date.now() + ttlMs);
    return head + '.' + hmac(head);
  }
  function verifyToken(token) {
    if (!enabled || !token) return null;
    const parts = String(token).split('.');
    if (parts.length !== 3) return null;
    if (!safeEqual(hmac(parts[0] + '.' + parts[1]), parts[2])) return null;
    if (Date.now() > Number(parts[1])) return null;
    return Buffer.from(parts[0], 'base64url').toString();
  }
  function checkLogin(username, password) {
    if (!enabled) return false;
    return safeEqual(username || '', user) && safeEqual(password || '', pass);
  }

  return { enabled, signToken, verifyToken, checkLogin, secretFromEnv: Boolean(env.ADMIN_SECRET) };
}

module.exports = { createAdminAuth };

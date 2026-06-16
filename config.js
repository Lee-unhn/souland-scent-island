/* =====================================================================
   嗅覺島 SOULAND 2026 — 全站設定檔
   上線前主要只需要編輯這個檔案。
   ===================================================================== */
window.SOULAND_CONFIG = {

  /* ── 1. 後端：Apps Script Web App（部署/GitHub Pages 用）──────────────
     貼上 apps-script/Code.gs 部署後的 /exec 網址。填了 = 全站走 Apps Script
     （報名 / 後台 / 品牌 / 工作坊…）。留空 = 走本機 Express /api/*（npm start）。 */
  APPS_SCRIPT_URL: "",   // 例:https://script.google.com/macros/s/AKfycb..../exec

  REGISTER_ENDPOINT: "/api/register",          // 本機 Express 用（APPS_SCRIPT_URL 留空時）
  BRANDS_SHEET_URL: "",                         // 參展品牌 Google Sheet 編輯網址（後台「到 Sheet 編輯」按鈕用）

  /* ── 3. 購票連結跳轉 ───────────────────────────────────────────────  */
  TICKET_URL: "",        // 留空 → 顯示「購票 8 月開放」

  /* ── 4. 報名完成頁要下載的招商簡章 PDF ─────────────────────────────  */
  PROSPECTUS_URL: "assets/souland-prospectus.pdf",
  PROSPECTUS_NAME: "嗅覺島SOULAND2026_招商簡章.pdf",

  /* ── 5. 繳費方式 ───────────────────────────────────────────────────
     目前採「報名審核通過後匯款」。線上金流（綠界 ECPay）已關閉但程式碼保留，
     未來要開通只需把 PAYMENT.ENABLED 改回 true（後端 /api/payment/ecpay 仍在）。 */
  REMITTANCE: {
    ACCOUNT_NAME: "六赫茲股份有限公司",
    NOTE: "本展採「報名審核後匯款」：送出申請後，主辦單位將於 5–7 個工作天完成審核，通過後以 Email 提供匯款帳號（戶名：六赫茲股份有限公司），請完成攤位費訂金（50%）與保證金（每格 NT$10,000）匯款。保證金於展後 45 天無息退還，尾款於展前一個月繳清。"
  },
  PAYMENT: {
    ENABLED: false,                              // ← 線上金流關閉（改回 true 即重新啟用）
    PROVIDER: "ECPay",
    MODE: "STAGE-TEST",
    CREATE_ORDER_ENDPOINT: "/api/payment/ecpay",
    CURRENCY: "TWD"
  },

  /* ── 6. 聯絡資訊（全站共用） ─────────────────────────────────────── */
  CONTACT_EMAIL: "Soulland@soullandtw.com",
  SITE_URL: "www.soullandtw.com",
  ORGANIZER: "六赫茲股份有限公司｜亞洲香研所"
};

/* =====================================================================
   後端轉接器：APPS_SCRIPT_URL 有填 → 走 Apps Script；否則走本機 Express。
   前端各頁用 SOULAND_NET.post(action,data) / SOULAND_NET.get(action)。
   ===================================================================== */
window.SOULAND_NET = {
  url(){ return (window.SOULAND_CONFIG || {}).APPS_SCRIPT_URL || ''; },
  live(){ return !!this.url(); },
  async post(action, data){
    const u = this.url();
    // text/plain = 簡單請求，避開 Apps Script 的 CORS preflight；redirect:follow 才讀得到回應
    const res = await fetch(u, { method:'POST', headers:{ 'Content-Type':'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action }, data||{})), redirect:'follow' });
    return res.json();
  },
  async get(action){
    const u = this.url();
    const res = await fetch(u + (u.indexOf('?')>=0?'&':'?') + 'action=' + encodeURIComponent(action), { redirect:'follow' });
    return res.json();
  }
};

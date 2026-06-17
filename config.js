/* =====================================================================
   嗅覺島 SOULAND 2026 — 全站設定檔
   上線前主要只需要編輯這個檔案。
   ===================================================================== */
window.SOULAND_CONFIG = {

  /* ── 1. 後端：Apps Script Web App（部署/GitHub Pages 用）──────────────
     貼上 apps-script/Code.gs 部署後的 /exec 網址。填了 = 全站走 Apps Script
     （報名 / 後台 / 品牌 / 工作坊…）。留空 = 走本機 Express /api/*（npm start）。 */
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwn5y1zWLQecQAFksHPLVvpS29KRjyZf5JVNxYXAnR_RKNcvc7UU3CytxuCl-52_TeF5g/exec",

  REGISTER_ENDPOINT: "/api/register",          // 本機 Express 用（APPS_SCRIPT_URL 留空時）
  BRANDS_SHEET_URL: "https://docs.google.com/spreadsheets/d/13UU6vBLE0S-tpJDwLMVD9UrgmAChmMkx1ff7SwuDbeQ/edit",  // 後台「到 Sheet 編輯」按鈕

  /* ── 3. 購票連結跳轉 ───────────────────────────────────────────────  */
  TICKET_URL: "",        // 留空 → 顯示「購票 8 月開放」

  /* ── 4. 報名完成頁的招商簡章 PDF（放 Google Drive，超連結下載）─────────
     把 PDF 上傳到 Drive → 共用設「知道連結的任何人皆可檢視」→ 貼檢視連結。
     例:https://drive.google.com/file/d/<檔案ID>/view                       */
  PROSPECTUS_URL: "https://drive.google.com/file/d/1mttDilVCFxIvDjB3UwRyuYIQXyuZZrdr/view?usp=sharing",
  PROSPECTUS_NAME: "嗅覺島SOULAND2026_招商簡章.pdf",

  /* ── 5. 繳費方式 ───────────────────────────────────────────────────
     目前採「報名審核通過後匯款」。線上金流（綠界 ECPay）已關閉但程式碼保留，
     未來要開通只需把 PAYMENT.ENABLED 改回 true（後端 /api/payment/ecpay 仍在）。 */
  REMITTANCE: {
    ACCOUNT_NAME: "六赫茲股份有限公司",
    NOTE: "本展採「報名審核後匯款」：送出申請後，主辦單位將於 5–7 個工作天完成審核，通過後以 Email 提供匯款帳號（戶名：六赫茲股份有限公司），請一次付清攤位費全額與保證金（每格 NT$10,000）。保證金於展後 45 天無息退還。"
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
  // 用 JSONP（<script> 標籤）呼叫 Apps Script：跨所有瀏覽器（含 Safari）皆穩，
  // 不受 CORS / fetch 轉址限制。資料放 d 參數的 JSON，回應走 callback。
  _call(action, data){
    const u = this.url();
    return new Promise((resolve, reject) => {
      if(!u) return reject(new Error('未設定後端'));
      const cb = '__sl_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      const q = u + (u.indexOf('?')>=0?'&':'?') + 'action=' + encodeURIComponent(action)
              + (data ? '&d=' + encodeURIComponent(JSON.stringify(data)) : '')
              + '&callback=' + cb;
      const s = document.createElement('script');
      let done = false;
      const cleanup = () => { try{ delete window[cb]; }catch(e){ window[cb] = undefined; } if(s.parentNode) s.parentNode.removeChild(s); };
      window[cb] = (resp) => { done = true; cleanup(); resolve(resp); };
      s.onerror = () => { if(!done){ cleanup(); reject(new Error('後端載入失敗（網路或部署）')); } };
      s.src = q;
      document.head.appendChild(s);
      setTimeout(() => { if(!done){ cleanup(); reject(new Error('後端回應逾時')); } }, 20000);
    });
  },
  post(action, data){ return this._call(action, data); },
  get(action){ return this._call(action, null); }
};

/* =====================================================================
   全站文字覆蓋（L3b）：讀「文案」Sheet 的「原文 → 新文字」對照表，
   頁面載入後把畫面上「等於原文」的文字換成「新文字」。
   ・沒填新文字的維持原文 → 不影響載入速度（原文一開始就顯示，只有改過的會更新）。
   ・後台(admin) 不套用。表單 placeholder 等屬性文字暫不替換（之後可擴充）。
   你只要在 Google「文案」Sheet 的「新文字」欄填字 → 重整官網即生效。
   ===================================================================== */
window.SOULAND_TEXT = {
  _skip(){ return /admin/i.test(location.pathname) || !window.SOULAND_NET || !SOULAND_NET.live(); },
  apply(){
    if(this._skip()) return;
    SOULAND_NET.get('textGet').then(function(resp){
      var map = resp && resp.ok && resp.map;
      if(!map || !Object.keys(map).length) return;
      // 標題（<title>，不在 body 內，單獨處理）
      var dt = (document.title || '').trim();
      if(map.hasOwnProperty(dt) && map[dt]) document.title = map[dt];
      // 走訪 body 內所有文字節點，整段相等才替換（保留前後空白）
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: function(n){
          var p = n.parentNode; if(!p) return NodeFilter.FILTER_REJECT;
          var tag = p.nodeName;
          if(tag==='SCRIPT'||tag==='STYLE'||tag==='TEXTAREA'||tag==='NOSCRIPT') return NodeFilter.FILTER_REJECT;
          return (n.nodeValue && n.nodeValue.trim()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
      var nodes=[], cur;
      while((cur=walker.nextNode())) nodes.push(cur);
      nodes.forEach(function(n){
        var t = n.nodeValue.trim();
        if(map.hasOwnProperty(t) && map[t]!=='') n.nodeValue = n.nodeValue.replace(t, map[t]);
      });
    }).catch(function(){ /* 後端未設定或逾時 → 靜默維持原文 */ });
  }
};
if(document.readyState==='loading')
  document.addEventListener('DOMContentLoaded', function(){ SOULAND_TEXT.apply(); });
else SOULAND_TEXT.apply();

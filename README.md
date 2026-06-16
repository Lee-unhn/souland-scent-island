# 嗅覺島 SOULAND 2026 · 招商報名網站

台灣第一個香氛產業年度展覽平台官網。多頁招商站 + 線上報名 + 綠界 ECPay 測試金流 + Google Sheet 報名回寫。

## 快速開始

```bash
cd server
npm install
npm start        # http://localhost:3000
```

## 結構

```
嗅覺島-souland/
├─ public/                  前端靜態站（多頁，非一頁式）
│  ├─ index.html            SPA 路由：首頁/關於/展覽資訊/特色體驗/參展品牌/年度大賞/B2B・媒體/聯絡我們
│  ├─ vendor.html           我要參展：六大效益 · 四方案 · 申請流程 · 費用試算 · 申請表
│  ├─ thank-you.html        報名完成：招商簡章 PDF 下載 + 匯款備註
│  ├─ admin.html / admin.js 參展廠商後台（帳密登入 + 品牌 CRUD，預設 admin/souland2026）
│  ├─ payment-complete.html 綠界付款結果（金流停用中，程式保留）
│  ├─ styles.css · app.js · vendor.js · config.js（全站設定改這支）
│  ├─ assets/ (logo PNG light/dark · poster.jpg · souland-prospectus.pdf 招商簡章)
│  └─ _legacy_singlepage/   舊單頁版（保留備查）
├─ server/
│  ├─ server.js             Express：報名 + 綠界金流(/Cashier/AioCheckOut/V5) + Sheet 寫入
│  ├─ package.json          僅依賴 express
│  └─ .env.example          設定範本（複製為 .env）
├─ apps-script/Code.gs      Google Apps Script（貼進你的 Sheet 後部署為 Web App）
├─ docs/diagrams/           互動架構圖（單頁版基線；多頁版待下次重畫）
└─ SOULAND.md               專案主文件（內容來源 / 階段 / PM / 交接）
```

## 繳費方式（目前：報名後匯款）

線上金流**已關閉**（`config.js` `PAYMENT.ENABLED:false`）——採報名審核通過後 Email 匯款。
網頁兩處顯示匯款備註（報名頁試算側欄、報名完成頁），文字由 `config.js` 的 `REMITTANCE.NOTE` 控制。

> 綠界 ECPay 整套程式碼保留（後端 `/api/payment/ecpay`、CheckMacValue、`/Cashier/AioCheckOut/V5`、測試特店 2000132）。
> 未來要恢復線上付款：`config.js` 把 `PAYMENT.ENABLED` 改回 `true` 即可；正式上線再改 `server/.env` 的特店資料與 `ECPAY_API_URL`。
> 測試卡：`4311-9522-2222-2222` / 期限任意未來 / CVV `222` / OTP `1234`。

## 報名回寫 Google Sheet

1. 你的 Sheet → 擴充功能 → Apps Script，貼上 `apps-script/Code.gs`。
2. 部署為 Web App（執行身分：我；存取：任何人）。
3. 把 `/exec` 網址填入 `server/.env` 的 `REGISTRATION_WEBHOOK_URL`。

未設定時報名仍會存進 `server/registrations.json`。

詳見 [SOULAND.md](SOULAND.md)。

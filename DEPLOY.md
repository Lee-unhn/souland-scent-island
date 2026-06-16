# 部署指南 · 嗅覺島 SOULAND 2026

架構：**靜態前端（GitHub Pages）+ Google Apps Script（後端）+ Google Sheet（資料庫）**。
無伺服器、無 .env、repo 內零密鑰。Sheet ID 與密碼放 Apps Script 的「指令碼屬性」。

---

## A. Google Apps Script（後端，一次設定）

1. 開 [script.google.com](https://script.google.com) → 新增專案 → 把 `apps-script/Code.gs` 整段貼上、存檔。
2. 左側齒輪 **專案設定 → 指令碼屬性 → 新增屬性**，加入：

   | 鍵 | 值 |
   |---|---|
   | `ADMIN_USER` | 後台帳號（例 `admin`） |
   | `ADMIN_PASS` | 後台密碼（**自訂強密碼**） |
   | `ADMIN_SECRET` | 隨機長字串（token 簽章用） |
   | `SHEET_REG` | 報名資料 Sheet 的 ID |
   | `SHEET_BRANDS` | 參展品牌 Sheet 的 ID |
   | `SHEET_WS` | 工作坊候補 Sheet 的 ID（可留空，則寫進報名 Sheet 分頁） |

   > Sheet ID = 網址 `/spreadsheets/d/<這段>/edit` 中間那串。三個 Sheet 的 ID 由建置者另以私訊提供（不放進公開 repo）。
3. 右上 **部署 → 新增部署 → 類型「網頁應用程式」**
   - 執行身分：**我**　｜　誰可以存取：**任何人**
4. 複製 **/exec** 結尾的網址。
5. 之後改 `Code.gs` 要 **管理部署 → 編輯 → 版本：新版本** 才生效。

> Apps Script 以「我」身分執行，能直接讀寫你自己的 Sheet，**不需要把 Sheet 設公開**。

---

## B. 前端設定（`public/config.js`）

填入：
```js
APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycb..../exec",  // A 步驟的 /exec
BRANDS_SHEET_URL: "https://docs.google.com/spreadsheets/d/<參展品牌 Sheet ID>/edit", // 後台「到 Sheet 編輯」按鈕
TICKET_URL: "",  // 開賣時填售票網址
```
`APPS_SCRIPT_URL` 一旦填好，全站（報名 / 後台 / 品牌 / 工作坊…）自動改走 Apps Script。
留空則走本機 Express（`cd server && npm start`）。

---

## C. GitHub Pages（自動部署）

1. 把整個 repo push 到 GitHub。
2. GitHub repo → **Settings → Pages → Build and deployment → Source 選「GitHub Actions」**。
3. 已內建 `.github/workflows/pages.yml`：每次 push 到 `main` 會自動把 `public/` 發佈到 Pages。
4. 完成後網址：`https://<帳號>.github.io/<repo>/`（或自訂網域 www.soullandtw.com → CNAME）。

---

## D. 資料管理（上線後）

| 要做的事 | 在哪裡 |
|---|---|
| 看報名 / 改報名狀態 | `/<repo>/admin.html` 登入 → 報名管理 |
| 改 / 增 參展品牌 | 直接編輯**參展品牌 Google Sheet**（攤位編號驅動官網展場分配） |
| 看工作坊候補 / 買手 / 聯絡 | 各自的 Google Sheet / 分頁 |
| 開放購票 | `config.js` 填 `TICKET_URL` |
| 開線上刷卡（綠界） | `config.js` 把 `PAYMENT.ENABLED` 改 `true` + 後端串接（目前採匯款，程式保留） |

---

## E. 安全注意

- **務必修改後台預設密碼**：`Code.gs` 走 Script Properties 的 `ADMIN_PASS`（不是 repo 裡的 `souland2026`，那只是本機 Express 預設）。
- 報名資料 Sheet（含申請人個資）的 **ID 不放進 repo**（只放 Apps Script 指令碼屬性）。
- `.env` / `registrations.json` 已被 `.gitignore` 排除，不會上傳。

---

## 本機開發（不需部署也能跑）

```bash
cd server && npm install && npm start   # http://localhost:3000
```
`config.js` 的 `APPS_SCRIPT_URL` 留空時走本機 Express，資料存 `server/*.json`。

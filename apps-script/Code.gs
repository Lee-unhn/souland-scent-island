/**********************************************************************
 * 嗅覺島 SOULAND 2026 — Apps Script 後端（靜態站 + GitHub Pages 用）
 * 一支 Web App 處理：報名 / 工作坊·買手·聯絡 / 後台登入 / 報名查詢 + 改狀態 /
 * 參展品牌公開讀取。所有密鑰與 Sheet ID 放「指令碼屬性 Script Properties」，
 * 不寫進 repo。
 *
 * ── 安裝 ──────────────────────────────────────────────────────────
 * 1. https://script.google.com → 新增專案，貼上本檔、存檔。
 * 2. 左側齒輪「專案設定」→「指令碼屬性」新增以下鍵值：
 *      ADMIN_USER     後台帳號（例 admin）
 *      ADMIN_PASS     後台密碼（自訂強密碼）
 *      ADMIN_SECRET   token 簽章密鑰（隨機長字串）
 *      SHEET_REG      報名資料 Sheet ID
 *      SHEET_BRANDS   參展品牌 Sheet ID
 *      SHEET_WS       工作坊候補 Sheet ID（可選；缺則寫在 SHEET_REG 分頁）
 * 3. 右上「部署」→「新增部署」→「網頁應用程式」
 *      執行身分：我　｜　存取權：任何人
 * 4. 複製 /exec 網址 → 貼到 public/config.js 的 APPS_SCRIPT_URL。
 * 5. 改程式後要「管理部署 → 編輯 → 版本：新版本」才生效。
 **********************************************************************/

var SP = PropertiesService.getScriptProperties();
function P(k){ return SP.getProperty(k) || ''; }

/* ---------- 共用 ---------- */
function json_(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function ssById_(id){ return id ? SpreadsheetApp.openById(id) : null; }
function firstSheet_(id, headers){
  var ss = ssById_(id); if(!ss) throw new Error('Sheet 未設定');
  var sh = ss.getSheets()[0];
  if(sh.getLastRow()===0 && headers){ sh.appendRow(headers); sh.getRange(1,1,1,headers.length).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}
function tab_(id, name, headers){
  var ss = ssById_(id); if(!ss) throw new Error('Sheet 未設定');
  var sh = ss.getSheetByName(name);
  if(!sh){ sh = ss.insertSheet(name); sh.appendRow(headers); sh.getRange(1,1,1,headers.length).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}
function mapStatus_(s){ return ({pending_remit:'待匯款',remitted:'已匯款 ✅',reviewing:'審核中',approved:'審核通過',payment_failed:'付款失敗'})[s]||s; }

/* ---------- token（HMAC，8 小時）---------- */
function sign_(user){
  var exp = (new Date().getTime()) + 8*3600*1000;
  var head = Utilities.base64EncodeWebSafe(user) + '.' + exp;
  var sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(head, P('ADMIN_SECRET')||'change-me'));
  return head + '.' + sig;
}
function verify_(token){
  if(!token) return null;
  var p = token.split('.'); if(p.length!==3) return null;
  var head = p[0]+'.'+p[1];
  var sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(head, P('ADMIN_SECRET')||'change-me'));
  if(sig!==p[2]) return null;
  if((new Date().getTime()) > Number(p[1])) return null;
  return Utilities.newBlob(Utilities.base64DecodeWebSafe(p[0])).getDataAsString();
}

var REG_HEADERS = ['時間','單號','狀態','公司名稱(中)','公司名稱(英)','品牌名稱(中)','品牌名稱(英)','平面圖顯示名稱','統一編號','公司地址','郵遞區號','展覽聯絡人','公司負責人','電話','手機','Email','公司網站','IG帳號','Facebook','品牌創立年份','主要產地','參展品類','攤位方案','攤位數量','計價別','單價','攤位費小計','保證金','簽約應繳','備註'];

/* ============================================================ 路由
   前端統一走 GET（?action=X&d=<JSON>），跨來源最穩。doPost 保留相容。 */
function route_(action, d){
  switch(action){
    case 'register':     return doRegister_(d);
    case 'workshop':     return doSimple_('workshop', d);
    case 'buyer':        return doSimple_('buyer', d);
    case 'contact':      return doSimple_('contact', d);
    case 'adminLogin':   return doLogin_(d);
    case 'adminRegs':    return doAdminRegs_(d);
    case 'regStatus':    return doRegStatus_(d);
    case 'brandsPublic': return brandsPublic_();
    case 'brandList':    return brandList_(d);
    case 'brandSave':    return brandSave_(d);
    case 'brandDelete':  return brandDelete_(d);
    case 'perfumersPublic': return perfumersPublic_();
    case 'perfumerList':    return perfumerList_(d);
    case 'perfumerSave':    return perfumerSave_(d);
    case 'perfumerDelete':  return perfumerDelete_(d);
    case 'layoutGet':    return layoutGet_();
    case 'layoutSave':   return layoutSave_(d);
    case 'textGet':      return textGet_();
    case 'textList':     return textList_(d);
    case 'textSave':     return textSave_(d);
    default:             return json_({ok:true,msg:'SOULAND endpoint alive ✦'});
  }
}
function doGet(e){
  var p = (e && e.parameter) || {};
  var out;
  try{
    var d = p.d ? JSON.parse(p.d) : {};
    out = route_(p.action, d);
  }catch(err){ out = json_({ok:false,error:String(err)}); }
  // JSONP：前端用 <script> 載入（跨瀏覽器最穩），把 JSON 包成 callback(...)
  if(p.callback){
    return ContentService.createTextOutput(p.callback + '(' + out.getContent() + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return out;
}
function doPost(e){
  try{
    var d = JSON.parse(e.postData.contents);
    return route_(d.action, d);
  }catch(err){ return json_({ok:false,error:String(err)}); }
}

/* ---------- 報名 ---------- */
function doRegister_(d){
  var sh = firstSheet_(P('SHEET_REG'), REG_HEADERS);
  var orderId = 'SI' + (new Date().getTime()).toString(36).toUpperCase() + Math.floor(Math.random()*1e4).toString(36).toUpperCase();
  sh.appendRow([new Date(), orderId, mapStatus_('pending_remit'),
    d.companyZh,d.companyEn,d.brandZh,d.brandEn,d.displayName,d.taxId,d.address,d.zip,
    d.contact,d.owner,d.phone,d.mobile,d.email,d.website,d.ig,d.fb,d.foundedYear,d.origin,
    Array.isArray(d.categories)?d.categories.join('、'):(d.categories||''),
    d.plan,d.qty,d.priceType,d.unit,d.subtotal,d.deposit,d.payable,d.msg]);
  return json_({ok:true,orderId:orderId,payable:d.payable});
}

/* ---------- 次要表單 ---------- */
function doSimple_(type, d){
  var cfg = {
    workshop:{id:P('SHEET_WS')||P('SHEET_REG'), name:'工作坊候補', headers:['時間','姓名','Email','偏好場次','狀態','備註'], row:[new Date(),d.name,d.mail,d.session,'',''] },
    buyer:   {id:P('SHEET_REG'), name:'B2B買手', headers:['時間','公司/通路','姓名職稱','Email','通路類型','需求備註'], row:[new Date(),d.company,d.name,d.mail,d.channel,d.msg] },
    contact: {id:P('SHEET_REG'), name:'聯絡我們', headers:['時間','洽詢主題','姓名/單位','Email','訊息'], row:[new Date(),d.topic,d.name,d.mail,d.msg] }
  }[type];
  tab_(cfg.id, cfg.name, cfg.headers).appendRow(cfg.row);
  return json_({ok:true});
}

/* ---------- 後台登入 ---------- */
function doLogin_(d){
  if(d.username===P('ADMIN_USER') && d.password===P('ADMIN_PASS') && P('ADMIN_USER'))
    return json_({ok:true,token:sign_(d.username),user:d.username});
  return json_({ok:false,error:'帳號或密碼錯誤'});
}

/* ---------- 後台：報名列表 ---------- */
function doAdminRegs_(d){
  if(!verify_(d.token)) return json_({ok:false,error:'未授權或逾時'});
  var sh = firstSheet_(P('SHEET_REG'), REG_HEADERS);
  var v = sh.getDataRange().getValues(); var H = v[0]; var out=[];
  for(var i=v.length-1;i>=1;i--){
    var r={}; for(var c=0;c<H.length;c++) r[H[c]]=v[i][c];
    out.push({ timestamp:r['時間'], orderId:r['單號'], status:r['狀態'],
      brandZh:r['品牌名稱(中)'], companyZh:r['公司名稱(中)'], contact:r['展覽聯絡人'], mobile:r['手機'],
      plan:r['攤位方案'], qty:r['攤位數量'], priceType:r['計價別'], payable:r['簽約應繳'] });
  }
  return json_({ok:true,records:out});
}

/* ---------- 後台：改狀態（同步回寫狀態欄）---------- */
function doRegStatus_(d){
  if(!verify_(d.token)) return json_({ok:false,error:'未授權或逾時'});
  var sh = firstSheet_(P('SHEET_REG'), REG_HEADERS);
  var v = sh.getDataRange().getValues();
  for(var i=1;i<v.length;i++){
    if(v[i][1]===d.orderId){ sh.getRange(i+1,3).setValue(mapStatus_(d.status));
      sh.getRange(i+1,1,1,REG_HEADERS.length).setBackground(d.status==='remitted'||d.status==='approved'?'#e7f0e4':'#f6e2dd');
      return json_({ok:true}); }
  }
  return json_({ok:false,error:'找不到該筆'});
}

/* ---------- 參展品牌（SHEET_BRANDS）讀 + 後台增改刪 ----------
   id = 試算表列號（第 2 列起）。產品推薦欄存 JSON（相容舊的｜分隔）。 */
var BRAND_HEADERS = ['品牌名稱(中)','品牌英文名','類型','產地','攤位編號','前調','中調','後調','品牌故事','產品推薦','社群連結','公開顯示'];

function brandSheet_(){
  var id = P('SHEET_BRANDS'); if(!id) return null;
  var sh = ssById_(id).getSheets()[0];
  if(sh.getLastRow()===0){ sh.appendRow(BRAND_HEADERS); sh.getRange(1,1,1,BRAND_HEADERS.length).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}
function parseProds_(cell){
  if(!cell) return [];
  var s = String(cell).trim();
  if(s.charAt(0)==='['){ try{ return JSON.parse(s); }catch(e){} }
  return s.split('｜').filter(function(x){return x.trim();}).map(function(x){ return {name:x.trim(),note:'',desc:''}; });
}
function rowToBrand_(H, row, rowNum){
  function c(n){ var i=H.indexOf(n); return i>=0 ? row[i] : ''; }
  var pub = String(c('公開顯示')).trim();
  return { id:String(rowNum), name:c('品牌名稱(中)'), en:c('品牌英文名'), type:c('類型'), country:c('產地'),
    booth:c('攤位編號'), top:c('前調'), heart:c('中調'), base:c('後調'), story:c('品牌故事'),
    products:parseProds_(c('產品推薦')), social:c('社群連結'), logo:'',
    published: !(pub && pub.indexOf('否')>=0) };
}
function brandToRow_(b){
  return [ b.name||'', b.en||'', b.type||'', b.country||'', b.booth||'', b.top||'', b.heart||'', b.base||'',
    b.story||'', JSON.stringify(b.products||[]), b.social||'', (b.published===false?'否':'是') ];
}
function brandsPublic_(){
  var sh = brandSheet_(); if(!sh) return json_({ok:true,brands:[]});
  var v = sh.getDataRange().getValues(); if(v.length<2) return json_({ok:true,brands:[]});
  var H = v[0]; var out=[];
  for(var i=1;i<v.length;i++){ if(!v[i][0]) continue; var b=rowToBrand_(H,v[i],i+1); if(b.published) out.push(b); }
  return json_({ok:true,brands:out});
}
function brandList_(d){
  if(!verify_(d.token)) return json_({ok:false,error:'未授權或逾時'});
  var sh = brandSheet_(); var v = sh.getDataRange().getValues(); var H = v[0]; var out=[];
  for(var i=1;i<v.length;i++){ if(!v[i][0]) continue; out.push(rowToBrand_(H,v[i],i+1)); }
  return json_({ok:true,brands:out});
}
function brandSave_(d){
  if(!verify_(d.token)) return json_({ok:false,error:'未授權或逾時'});
  if(!String(d.name||'').trim()) return json_({ok:false,error:'品牌名稱必填'});
  var sh = brandSheet_(); var rowArr = brandToRow_(d);
  if(d.id){ sh.getRange(Number(d.id),1,1,BRAND_HEADERS.length).setValues([rowArr]); }
  else { sh.appendRow(rowArr); }
  return json_({ok:true});
}
function brandDelete_(d){
  if(!verify_(d.token)) return json_({ok:false,error:'未授權或逾時'});
  if(!d.id) return json_({ok:false,error:'缺少 id'});
  var sh = brandSheet_(); sh.deleteRow(Number(d.id));
  return json_({ok:true});
}

/* ---------- 調香師專區（CRUD，Script Property: SHEET_PERFUMERS）----------
   欄位：姓名 / 照片URL / 介紹 / 社群連結 / 公開顯示。id = 試算表列號。 */
var PERFUMER_HEADERS = ['姓名','照片URL','介紹','社群連結','公開顯示'];
function perfumerSheet_(){
  var id = P('SHEET_PERFUMERS'); if(!id) return null;
  var sh = ssById_(id).getSheets()[0];
  if(sh.getLastRow()===0){ sh.appendRow(PERFUMER_HEADERS); sh.getRange(1,1,1,PERFUMER_HEADERS.length).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}
function rowToPerfumer_(H, row, rowNum){
  function c(n){ var i=H.indexOf(n); return i>=0 ? row[i] : ''; }
  var pub = String(c('公開顯示')).trim();
  return { id:String(rowNum), name:c('姓名'), photo:c('照片URL'), bio:c('介紹'), social:c('社群連結'),
    published: !(pub && pub.indexOf('否')>=0) };
}
function perfumerToRow_(p){ return [ p.name||'', p.photo||'', p.bio||'', p.social||'', (p.published===false?'否':'是') ]; }
function perfumersPublic_(){
  var sh = perfumerSheet_(); if(!sh) return json_({ok:true,perfumers:[]});
  var v = sh.getDataRange().getValues(); if(v.length<2) return json_({ok:true,perfumers:[]});
  var H = v[0]; var out=[];
  for(var i=1;i<v.length;i++){ if(!v[i][0]) continue; var p=rowToPerfumer_(H,v[i],i+1); if(p.published) out.push(p); }
  return json_({ok:true,perfumers:out});
}
function perfumerList_(d){
  if(!verify_(d.token)) return json_({ok:false,error:'未授權或逾時'});
  var sh = perfumerSheet_(); if(!sh) return json_({ok:false,error:'未設定 SHEET_PERFUMERS'});
  var v = sh.getDataRange().getValues(); var H = v[0]; var out=[];
  for(var i=1;i<v.length;i++){ if(!v[i][0]) continue; out.push(rowToPerfumer_(H,v[i],i+1)); }
  return json_({ok:true,perfumers:out});
}
function perfumerSave_(d){
  if(!verify_(d.token)) return json_({ok:false,error:'未授權或逾時'});
  if(!String(d.name||'').trim()) return json_({ok:false,error:'姓名必填'});
  var sh = perfumerSheet_(); if(!sh) return json_({ok:false,error:'未設定 SHEET_PERFUMERS'});
  var rowArr = perfumerToRow_(d);
  if(d.id){ sh.getRange(Number(d.id),1,1,PERFUMER_HEADERS.length).setValues([rowArr]); }
  else { sh.appendRow(rowArr); }
  return json_({ok:true});
}
function perfumerDelete_(d){
  if(!verify_(d.token)) return json_({ok:false,error:'未授權或逾時'});
  if(!d.id) return json_({ok:false,error:'缺少 id'});
  var sh = perfumerSheet_(); if(!sh) return json_({ok:false,error:'未設定 SHEET_PERFUMERS'});
  sh.deleteRow(Number(d.id));
  return json_({ok:true});
}

/* ---------- 版面設定（首頁區塊顯示/排序 + 導覽/購票/報名開關）----------
   存 Script Properties 'LAYOUT'（JSON）。layoutGet 公開（前台載入用）。 */
var DEFAULT_LAYOUT = {
  sections: [
    { key:'stats',      visible:true },
    { key:'awaken',     visible:true },
    { key:'highlights', visible:true },
    { key:'awards',     visible:true },
    { key:'schedule',   visible:true },
    { key:'perfumers',  visible:true },
    { key:'media',      visible:true }
  ],
  nav: { about:true, visit:true, experience:true, brands:true, awards:true },
  ticket: true,
  register: true
};
function layoutGet_(){
  var raw = P('LAYOUT');
  var lay = DEFAULT_LAYOUT;
  if(raw){ try{ lay = JSON.parse(raw); }catch(e){} }
  return json_({ ok:true, layout:lay });
}
function layoutSave_(d){
  if(!verify_(d.token)) return json_({ok:false,error:'未授權或逾時'});
  if(!d.layout) return json_({ok:false,error:'缺少 layout'});
  SP.setProperty('LAYOUT', JSON.stringify(d.layout));
  return json_({ok:true});
}

/* ---------- 全站文字覆蓋（L3b）----------
   「文案」Sheet（Script Property: SHEET_TEXT）：
     第1欄=頁面提示、第2欄=原文、第3欄=新文字。
   textGet 公開（前台載入用），只回傳「有填新文字」的原文→新文字對照，
   前台把頁面上等於『原文』的文字替換成『新文字』；沒填的維持原文。 */
function textSheet_(){
  var id = P('SHEET_TEXT'); if(!id) return null;
  return ssById_(id).getSheets()[0];
}
function textGet_(){
  var sh = textSheet_(); if(!sh) return json_({ok:true,map:{}});
  var v = sh.getDataRange().getValues(); var map={};
  for(var i=1;i<v.length;i++){
    var from = String(v[i][1]||'').trim();
    var to   = String(v[i][2]||'').trim();
    if(from && to) map[from] = to;
  }
  return json_({ok:true, map:map});
}
/* 後台用：列出全部文案（含原文+新文字+試算表列號），需 token */
function textList_(d){
  if(!verify_(d.token)) return json_({ok:false,error:'未授權或逾時'});
  var sh = textSheet_(); if(!sh) return json_({ok:false,error:'未設定 SHEET_TEXT'});
  var v = sh.getDataRange().getValues(); var out=[];
  for(var i=1;i<v.length;i++){
    var from = String(v[i][1]||'').trim(); if(!from) continue;
    out.push({ row:i+1, page:String(v[i][0]||''), from:from, to:String(v[i][2]||'') });
  }
  return json_({ok:true, items:out});
}
/* 後台用：只寫有變更的列的「新文字」（C 欄），需 token */
function textSave_(d){
  if(!verify_(d.token)) return json_({ok:false,error:'未授權或逾時'});
  var items = (d && d.items) || []; if(!items.length) return json_({ok:true,saved:0});
  var sh = textSheet_(); if(!sh) return json_({ok:false,error:'未設定 SHEET_TEXT'});
  for(var i=0;i<items.length;i++){
    var r = Number(items[i].row);
    if(r>=2) sh.getRange(r,3).setValue(String(items[i].to||''));
  }
  return json_({ok:true, saved:items.length});
}

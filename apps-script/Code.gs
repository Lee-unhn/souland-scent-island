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

/* ---------- 公開：參展品牌（讀 SHEET_BRANDS）---------- */
function brandsPublic_(){
  var id = P('SHEET_BRANDS'); if(!id) return json_({ok:true,brands:[]});
  var sh = ssById_(id).getSheets()[0];
  var v = sh.getDataRange().getValues(); if(v.length<2) return json_({ok:true,brands:[]});
  var H = v[0]; var col = function(n){ return H.indexOf(n); };
  var ci={ name:col('品牌名稱(中)'),en:col('品牌英文名'),type:col('類型'),country:col('產地'),booth:col('攤位編號'),
    top:col('前調'),heart:col('中調'),base:col('後調'),story:col('品牌故事'),prod:col('產品推薦'),social:col('社群連結'),pub:col('公開顯示') };
  var out=[];
  for(var i=1;i<v.length;i++){
    var row=v[i]; if(!row[ci.name]) continue;
    if(ci.pub>=0 && String(row[ci.pub]).trim() && String(row[ci.pub]).indexOf('否')>=0) continue;
    var prods=[]; if(ci.prod>=0 && row[ci.prod]) String(row[ci.prod]).split('｜').forEach(function(p){ if(p.trim()) prods.push({name:p.trim(),note:'',desc:''}); });
    out.push({ id:'r'+i, name:row[ci.name], en:ci.en>=0?row[ci.en]:'', type:ci.type>=0?row[ci.type]:'', country:ci.country>=0?row[ci.country]:'',
      booth:ci.booth>=0?row[ci.booth]:'', top:ci.top>=0?row[ci.top]:'', heart:ci.heart>=0?row[ci.heart]:'', base:ci.base>=0?row[ci.base]:'',
      story:ci.story>=0?row[ci.story]:'', products:prods, social:ci.social>=0?row[ci.social]:'', logo:'' });
  }
  return json_({ok:true,brands:out});
}

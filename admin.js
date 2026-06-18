/* =====================================================================
   嗅覺島 SOULAND 2026 — 參展廠商後台
   登入(帳密) + 品牌 CRUD，呼叫 server.js 的 /api/admin/*
   ===================================================================== */
const TKEY = 'souland_admin_token';
const $ = id => document.getElementById(id);
let TOKEN = localStorage.getItem(TKEY) || '';
let BRANDS = [];

function toast(msg){
  let t=$('toast'); if(!t){ t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent=msg; t.classList.add('show'); clearTimeout(t._tm); t._tm=setTimeout(()=>t.classList.remove('show'),2600);
}
function authHeaders(extra){ return Object.assign({ 'Authorization':'Bearer '+TOKEN }, extra||{}); }

async function api(path, opts){
  const res = await fetch(path, opts);
  if(res.status===401){ // token 失效
    localStorage.removeItem(TKEY); TOKEN=''; showLogin(); toast('登入逾時，請重新登入');
    throw new Error('unauthorized');
  }
  return res.json();
}

/* ---------- 畫面切換 ---------- */
function showLogin(){ $('login').style.display='grid'; $('app').style.display='none'; }
function showApp(user){ $('login').style.display='none'; $('app').style.display='block'; $('who').textContent=user||'admin'; loadList(); }

/* ---------- 登入 ---------- */
async function doLogin(){
  const username=$('l-user').value.trim(), password=$('l-pass').value;
  $('l-err').textContent='';
  if(!username||!password){ $('l-err').textContent='請輸入帳號與密碼'; return; }
  const btn=$('l-btn'); btn.disabled=true; btn.textContent='登入中…';
  try{
    const live = window.SOULAND_NET && SOULAND_NET.live();
    const j = live ? await SOULAND_NET.post('adminLogin',{username,password})
                   : await (await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})})).json();
    if(!j.ok){ $('l-err').textContent=j.error||'登入失敗'; return; }
    TOKEN=j.token; localStorage.setItem(TKEY,TOKEN); showApp(j.user);
  }catch(e){ $('l-err').textContent='連線錯誤：'+((e&&e.message)||e); }
  finally{ btn.disabled=false; btn.textContent='登入'; }
}
$('l-pass').addEventListener('keydown',e=>{ if(e.key==='Enter') doLogin(); });

function logout(){ localStorage.removeItem(TKEY); TOKEN=''; showLogin(); }

/* ---------- 列表 ---------- */
const LIVE = () => window.SOULAND_NET && SOULAND_NET.live();
async function loadList(){
  try{
    // 部署模式用 brandList（含未公開、需 token）；本機用 Express
    const j = LIVE() ? await SOULAND_NET.post('brandList',{token:TOKEN}) : await api('/api/admin/brands',{headers:authHeaders()});
    if(j && j.ok===false && /授權|逾時/.test(j.error||'')){ logout(); toast('登入逾時，請重新登入'); return; }
    BRANDS=(j&&j.brands)||[];
    renderList();
  }catch(e){ /* 401 已處理 */ }
}
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function renderList(){
  $('count').textContent='（共 '+BRANDS.length+' 家）';
  const addBtn = document.querySelector('#view-brands .bar .btn-p');
  if(addBtn){ addBtn.textContent='＋ 新增參展廠商'; addBtn.onclick=()=>openEditor(); }
  const box=$('list');
  if(!BRANDS.length){ box.innerHTML='<div class="empty">尚無參展廠商資料。點右上「＋ 新增參展廠商」開始建立（會寫入 Google Sheet，並同步顯示在官網「參展品牌」頁）。</div>'; return; }
  box.innerHTML='<table><thead><tr><th>品牌</th><th>類型</th><th>產地</th><th>攤位</th><th>狀態</th><th></th></tr></thead><tbody>'+
    BRANDS.map(b=>'<tr>'+
      '<td><b>'+esc(b.name)+'</b>'+(b.en?'<br><small style="color:#8a8170">'+esc(b.en)+'</small>':'')+'</td>'+
      '<td>'+esc(b.type||'—')+'</td><td>'+esc(b.country||'—')+'</td><td>'+esc(b.booth||'—')+'</td>'+
      '<td><span class="pill '+(b.published!==false?'on':'off')+'">'+(b.published!==false?'已公開':'未公開')+'</span></td>'+
      '<td><div class="acts">'+
        '<button class="btn btn-g btn-s" onclick="openEditor(\''+b.id+'\')">編輯</button>'+
        '<button class="btn btn-d btn-s" onclick="delBrand(\''+b.id+'\',\''+esc(b.name).replace(/\'/g,"")+'\')">刪除</button>'+
      '</div></td>'+
      '</tr>').join('')+'</tbody></table>';
}

/* ---------- 編輯器 ---------- */
function addProd(p){
  p=p||{name:'',note:'',desc:''};
  const wrap=document.createElement('div'); wrap.className='prod';
  wrap.innerHTML='<button class="rm" type="button">移除</button>'+
    '<div class="g3"><div class="fld"><label>品名</label><input class="p-name" value="'+esc(p.name)+'"></div>'+
    '<div class="fld"><label>備註（香調/容量）</label><input class="p-note" value="'+esc(p.note)+'"></div></div>'+
    '<div class="fld"><label>說明</label><input class="p-desc" value="'+esc(p.desc)+'"></div>';
  wrap.querySelector('.rm').onclick=()=>wrap.remove();
  $('prods').appendChild(wrap);
}
function openEditor(id){
  const b = id ? BRANDS.find(x=>x.id===id) : null;
  $('m-title').textContent = b ? '編輯參展廠商' : '新增參展廠商';
  $('m-id').value=b?b.id:'';
  ['name','en','type','country','booth','social','logo','top','heart','base','story'].forEach(k=>{ $('m-'+k).value=b?(b[k]||''):''; });
  $('m-pub').checked = b ? (b.published!==false) : true;
  $('prods').innerHTML='';
  (b&&b.products||[]).forEach(addProd);
  $('mask').classList.add('show');
}
function closeEditor(){ $('mask').classList.remove('show'); }

function collectProds(){
  return Array.from(document.querySelectorAll('#prods .prod')).map(d=>({
    name:d.querySelector('.p-name').value.trim(),
    note:d.querySelector('.p-note').value.trim(),
    desc:d.querySelector('.p-desc').value.trim()
  })).filter(p=>p.name);
}
async function saveBrand(btn){
  const payload={
    name:$('m-name').value.trim(), en:$('m-en').value.trim(),
    type:$('m-type').value, country:$('m-country').value.trim(), booth:$('m-booth').value.trim(),
    social:$('m-social').value.trim(), logo:$('m-logo').value.trim(),
    top:$('m-top').value.trim(), heart:$('m-heart').value.trim(), base:$('m-base').value.trim(),
    story:$('m-story').value.trim(), products:collectProds(), published:$('m-pub').checked
  };
  if(!payload.name){ toast('品牌名稱必填'); return; }
  const id=$('m-id').value;
  btn.disabled=true; btn.textContent='儲存中…';
  try{
    const j = LIVE()
      ? await SOULAND_NET.post('brandSave', Object.assign({token:TOKEN, id:id||''}, payload))
      : await api(id?'/api/admin/brands/'+id:'/api/admin/brands', { method:id?'PUT':'POST', headers:authHeaders({'Content-Type':'application/json'}), body:JSON.stringify(payload) });
    if(!j.ok){ toast(j.error||'儲存失敗'); return; }
    toast(id?'已更新':'已新增'); closeEditor(); loadList();
  }catch(e){ toast('儲存錯誤：'+((e&&e.message)||e)); }
  finally{ btn.disabled=false; btn.textContent='儲存'; }
}
async function delBrand(id,name){
  if(!confirm('確定刪除「'+name+'」？此動作無法復原。')) return;
  try{
    const j = LIVE()
      ? await SOULAND_NET.post('brandDelete', {token:TOKEN, id})
      : await api('/api/admin/brands/'+id,{method:'DELETE',headers:authHeaders()});
    if(j.ok){ toast('已刪除'); loadList(); } else toast(j.error||'刪除失敗');
  }catch(e){ toast('刪除錯誤：'+((e&&e.message)||e)); }
}
$('mask').addEventListener('click',e=>{ if(e.target===$('mask')) closeEditor(); });

/* ---------- 調香師 CRUD ---------- */
let PERFUMERS=[];
async function loadPerf(){
  try{
    const j = LIVE() ? await SOULAND_NET.post('perfumerList',{token:TOKEN}) : {ok:false,error:'本機模式不支援'};
    if(j && j.ok===false && /授權|逾時/.test(j.error||'')){ logout(); toast('登入逾時，請重新登入'); return; }
    if(!j || !j.ok){ $('pfList').innerHTML='<div class="empty">無法載入：'+esc((j&&j.error)||'未設定 SHEET_PERFUMERS（請在 Apps Script 設定屬性並重新部署）')+'</div>'; $('pfCount').textContent=''; return; }
    PERFUMERS=j.perfumers||[]; renderPerf();
  }catch(e){ $('pfList').innerHTML='<div class="empty">載入錯誤：'+esc((e&&e.message)||e)+'</div>'; }
}
function renderPerf(){
  $('pfCount').textContent='（共 '+PERFUMERS.length+' 位）';
  const box=$('pfList');
  if(!PERFUMERS.length){ box.innerHTML='<div class="empty">尚無調香師資料。點右上「＋ 新增調香師」開始建立（會寫入 Google Sheet，並同步顯示在官網「調香師專區」）。</div>'; return; }
  box.innerHTML='<table><thead><tr><th>調香師</th><th>介紹</th><th>狀態</th><th></th></tr></thead><tbody>'+
    PERFUMERS.map(p=>'<tr>'+
      '<td><b>'+esc(p.name)+'</b></td>'+
      '<td><small style="color:#8a8170">'+esc((p.bio||'').slice(0,40))+((p.bio||'').length>40?'…':'')+'</small></td>'+
      '<td><span class="pill '+(p.published!==false?'on':'off')+'">'+(p.published!==false?'已公開':'未公開')+'</span></td>'+
      '<td><div class="acts">'+
        '<button class="btn btn-g btn-s" onclick="openPerf(\''+p.id+'\')">編輯</button>'+
        '<button class="btn btn-d btn-s" onclick="delPerf(\''+p.id+'\',\''+esc(p.name).replace(/\'/g,"")+'\')">刪除</button>'+
      '</div></td></tr>').join('')+'</tbody></table>';
}
function openPerf(id){
  const p = id ? PERFUMERS.find(x=>x.id===id) : null;
  $('pf-title').textContent = p ? '編輯調香師' : '新增調香師';
  $('pf-id').value=p?p.id:'';
  ['name','photo','bio','social'].forEach(k=>{ $('pf-'+k).value=p?(p[k]||''):''; });
  $('pf-pub').checked = p ? (p.published!==false) : true;
  $('mask-pf').classList.add('show');
}
function closePerf(){ $('mask-pf').classList.remove('show'); }
async function savePerf(btn){
  const payload={ name:$('pf-name').value.trim(), photo:$('pf-photo').value.trim(),
    bio:$('pf-bio').value.trim(), social:$('pf-social').value.trim(), published:$('pf-pub').checked };
  if(!payload.name){ toast('姓名必填'); return; }
  const id=$('pf-id').value;
  btn.disabled=true; btn.textContent='儲存中…';
  try{
    const j = LIVE() ? await SOULAND_NET.post('perfumerSave', Object.assign({token:TOKEN,id:id||''},payload)) : {ok:false,error:'本機模式不支援'};
    if(!j.ok){ toast(j.error||'儲存失敗'); return; }
    toast(id?'已更新':'已新增'); closePerf(); loadPerf();
  }catch(e){ toast('儲存錯誤：'+((e&&e.message)||e)); }
  finally{ btn.disabled=false; btn.textContent='儲存'; }
}
async function delPerf(id,name){
  if(!confirm('確定刪除「'+name+'」？此動作無法復原。')) return;
  try{
    const j = LIVE() ? await SOULAND_NET.post('perfumerDelete',{token:TOKEN,id}) : {ok:false};
    if(j.ok){ toast('已刪除'); loadPerf(); } else toast(j.error||'刪除失敗');
  }catch(e){ toast('刪除錯誤：'+((e&&e.message)||e)); }
}
$('mask-pf').addEventListener('click',e=>{ if(e.target===$('mask-pf')) closePerf(); });

/* ---------- 報名管理（= 報名回寫 Sheet 的同一份資料）---------- */
const REG_STATUSES=[['pending_remit','待匯款'],['remitted','已匯款'],['reviewing','審核中'],['approved','審核通過'],['payment_failed','付款失敗']];
function switchTab(which){
  ['brands','perfumers','regs','layout','text'].forEach(t=>{
    const v=$('view-'+t); if(v) v.style.display=(t===which)?'block':'none';
    const b=$('tab-'+t); if(b) b.classList.toggle('on', t===which);
  });
  if(which==='perfumers') loadPerf();
  if(which==='regs') loadRegs();
  if(which==='layout') loadLayout();
  if(which==='text') loadText();
}
async function loadRegs(){
  try{
    const j = LIVE() ? await SOULAND_NET.post('adminRegs',{token:TOKEN}) : await api('/api/admin/registrations',{headers:authHeaders()});
    if(j && j.ok===false && /授權|逾時/.test(j.error||'')){ logout(); toast('登入逾時，請重新登入'); return; }
    renderRegs((j&&j.records)||[]);
  }catch(e){}
}
function fmtTime(iso){ try{ return new Date(iso).toLocaleString('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}); }catch(e){ return iso||''; } }
function renderRegs(list){
  $('regCount').textContent='（共 '+list.length+' 筆）';
  const box=$('regList');
  if(!list.length){ box.innerHTML='<div class="empty">尚無報名資料。報名表送出後會出現在這裡（同步寫進報名 Google Sheet）。</div>'; return; }
  box.innerHTML='<table><thead><tr><th>時間</th><th>單號</th><th>品牌 / 公司</th><th>聯絡人</th><th>方案</th><th>應繳</th><th>狀態</th></tr></thead><tbody>'+
    list.map(r=>{
      const brand=esc(r.brandZh||r.brand||r.companyZh||'—'), company=esc(r.companyZh||'');
      const opts=REG_STATUSES.map(s=>'<option value="'+s[0]+'"'+(r.status===s[0]?' selected':'')+'>'+s[1]+'</option>').join('');
      return '<tr><td><small>'+esc(fmtTime(r.timestamp))+'</small></td><td><small>'+esc(r.orderId||'')+'</small></td>'+
        '<td class="reg-brand"><b>'+brand+'</b>'+(company&&company!==brand?'<br><small>'+company+'</small>':'')+'</td>'+
        '<td>'+esc(r.contact||r.name||'')+(r.mobile?'<br><small style="color:#8a8170">'+esc(r.mobile)+'</small>':'')+'</td>'+
        '<td>'+esc(r.plan||'')+' ×'+(r.qty||1)+(r.priceType?'<br><small style="color:#8a8170">'+esc(r.priceType)+'</small>':'')+'</td>'+
        '<td class="reg-amt">NT$'+Number(r.payable||0).toLocaleString('en-US')+'</td>'+
        '<td><select class="st-sel" onchange="updateRegStatus(\''+esc(r.orderId)+'\',this.value)">'+opts+'</select></td></tr>';
    }).join('')+'</tbody></table>';
}
async function updateRegStatus(orderId,status){
  try{
    const j = LIVE() ? await SOULAND_NET.post('regStatus',{token:TOKEN,orderId,status})
                     : await api('/api/admin/registrations/'+encodeURIComponent(orderId),{method:'PUT',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify({status})});
    if(j.ok) toast('狀態已更新'+(LIVE()?'（已回寫 Sheet）':'')); else toast(j.error||'更新失敗');
  }catch(e){}
}

/* ---------- 版面設定（首頁區塊顯示/排序 + 導覽/購票/報名）---------- */
const SECTION_LABELS={stats:'展覽規模數據',awaken:'嗅覺五覺醒',highlights:'特色體驗',awards:'年度香氛大賞',schedule:'展期時間表',media:'媒體夥伴'};
const NAV_LABELS={about:'關於',visit:'展覽資訊',experience:'特色體驗',brands:'參展品牌',perfumers:'調香師',awards:'年度大賞'};
let LAYOUT=null;
function defaultLayout(){
  return { sections:[{key:'stats',visible:true},{key:'awaken',visible:true},{key:'highlights',visible:true},{key:'awards',visible:true},{key:'schedule',visible:true},{key:'media',visible:true}],
    nav:{about:true,visit:true,experience:true,brands:true,perfumers:true,awards:true}, ticket:true, register:true };
}
async function loadLayout(){
  try{ const j = LIVE() ? await SOULAND_NET.get('layoutGet') : {ok:false};
    LAYOUT = (j&&j.ok&&j.layout) ? j.layout : defaultLayout();
  }catch(e){ LAYOUT = defaultLayout(); }
  if(!LAYOUT.sections) LAYOUT.sections=defaultLayout().sections;
  if(!LAYOUT.nav) LAYOUT.nav=defaultLayout().nav;
  renderLayout();
}
function setSecVis(i,v){ LAYOUT.sections[i].visible=v; }
function setNavVis(k,v){ LAYOUT.nav[k]=v; }
function setFlag(k,v){ LAYOUT[k]=v; }
function moveSection(i,dir){ const a=LAYOUT.sections,j=i+dir; if(j<0||j>=a.length) return; const t=a[i];a[i]=a[j];a[j]=t; renderLayout(); }
function renderLayout(){
  const L=LAYOUT;
  const sec=L.sections.map((s,i)=>'<div class="lay-row"><div class="ord">'+
    '<button onclick="moveSection('+i+',-1)" '+(i===0?'disabled':'')+'>↑</button>'+
    '<button onclick="moveSection('+i+',1)" '+(i===L.sections.length-1?'disabled':'')+'>↓</button></div>'+
    '<span class="nm">'+esc(SECTION_LABELS[s.key]||s.key)+'</span>'+
    '<label class="vis"><input type="checkbox" '+(s.visible!==false?'checked':'')+' onchange="setSecVis('+i+',this.checked)"> 顯示</label></div>').join('');
  const nav=Object.keys(NAV_LABELS).map(k=>'<div class="lay-row"><span class="nm">'+esc(NAV_LABELS[k])+'</span>'+
    '<label class="vis"><input type="checkbox" '+(L.nav[k]!==false?'checked':'')+' onchange="setNavVis(\''+k+'\',this.checked)"> 顯示</label></div>').join('');
  const glob='<div class="lay-row"><span class="nm">購票按鈕</span><label class="vis"><input type="checkbox" '+(L.ticket!==false?'checked':'')+' onchange="setFlag(\'ticket\',this.checked)"> 顯示</label></div>'+
    '<div class="lay-row"><span class="nm">「我要參展」報名入口</span><label class="vis"><input type="checkbox" '+(L.register!==false?'checked':'')+' onchange="setFlag(\'register\',this.checked)"> 顯示</label></div>';
  $('layoutBox').innerHTML='<div class="lay-group"><h4>首頁區塊</h4><div class="hint2">↑↓ 調整官網首頁區塊順序；取消勾選＝隱藏。</div>'+sec+'</div>'+
    '<div class="lay-group"><h4>導覽列項目</h4>'+nav+'</div>'+
    '<div class="lay-group"><h4>其他</h4>'+glob+'</div>';
}
async function saveLayout(btn){
  if(!LAYOUT) return;
  btn.disabled=true; btn.textContent='儲存中…';
  try{
    const j = LIVE() ? await SOULAND_NET.post('layoutSave',{token:TOKEN,layout:LAYOUT}) : {ok:false,error:'本機模式不支援版面儲存'};
    if(j.ok) toast('已儲存，官網重整即套用'); else toast(j.error||'儲存失敗');
  }catch(e){ toast('儲存錯誤：'+((e&&e.message)||e)); }
  finally{ btn.disabled=false; btn.textContent='儲存並套用到官網'; }
}

/* ---------- 文案編輯（全站文字：原文 → 新文字，寫回文案 Sheet）---------- */
let TEXTROWS=[];
async function loadText(){
  const box=$('textBox');
  box.innerHTML='<div class="empty">載入中…</div>';
  try{
    const j = LIVE() ? await SOULAND_NET.post('textList',{token:TOKEN}) : {ok:false,error:'本機模式不支援文案'};
    if(j && j.ok===false && /授權|逾時/.test(j.error||'')){ logout(); toast('登入逾時，請重新登入'); return; }
    if(!j || !j.ok){ box.innerHTML='<div class="empty">無法載入文案：'+esc((j&&j.error)||'未設定 SHEET_TEXT（請在 Apps Script 設定屬性並重新部署）')+'</div>'; return; }
    TEXTROWS=j.items||[];
    renderText();
  }catch(e){ box.innerHTML='<div class="empty">載入錯誤：'+esc((e&&e.message)||e)+'</div>'; }
}
function renderText(){
  $('textCount').textContent='（共 '+TEXTROWS.length+' 段）';
  if(!TEXTROWS.length){ $('textBox').innerHTML='<div class="empty">文案 Sheet 沒有資料，或尚未設定 SHEET_TEXT。</div>'; return; }
  $('textBox').innerHTML='<div class="text-list">'+TEXTROWS.map(r=>
    '<div class="text-row" data-row="'+r.row+'" data-from="'+esc(r.from)+'" data-page="'+esc(r.page)+'">'+
      '<div class="text-orig"><span class="text-pg">'+esc(r.page)+'</span>'+esc(r.from)+'</div>'+
      '<input class="text-new" type="text" value="'+esc(r.to||'')+'" data-orig="'+esc(r.to||'')+'" placeholder="（留空＝維持原文）" oninput="markEdited(this)">'+
    '</div>').join('')+'</div>';
}
function markEdited(inp){
  const row=inp.closest('.text-row');
  if(row) row.classList.toggle('edited', inp.value!==inp.getAttribute('data-orig'));
}
function filterText(q){
  q=(q||'').trim().toLowerCase();
  const only=$('textOnlyEdited') && $('textOnlyEdited').checked;
  document.querySelectorAll('#textBox .text-row').forEach(row=>{
    const hay=(row.getAttribute('data-from')+' '+row.getAttribute('data-page')).toLowerCase();
    const inp=row.querySelector('.text-new');
    const matchQ = !q || hay.indexOf(q)>=0;
    const matchEdited = !only || (inp && inp.value.trim()!=='');
    row.style.display=(matchQ && matchEdited)?'':'none';
  });
}
async function saveText(btn){
  const items=[];
  document.querySelectorAll('#textBox .text-new').forEach(inp=>{
    if(inp.value!==inp.getAttribute('data-orig')){
      items.push({ row:Number(inp.closest('.text-row').getAttribute('data-row')), to:inp.value });
    }
  });
  if(!items.length){ toast('沒有變更'); return; }
  btn.disabled=true; btn.textContent='儲存中…';
  try{
    const j = LIVE() ? await SOULAND_NET.post('textSave',{token:TOKEN,items}) : {ok:false,error:'本機模式不支援文案儲存'};
    if(j && j.ok){
      // 更新基準值，清除 edited 標記
      document.querySelectorAll('#textBox .text-new').forEach(inp=>{ inp.setAttribute('data-orig',inp.value); inp.closest('.text-row').classList.remove('edited'); });
      toast('已儲存 '+items.length+' 段，官網重整即套用');
    } else toast((j&&j.error)||'儲存失敗');
  }catch(e){ toast('儲存錯誤：'+((e&&e.message)||e)); }
  finally{ btn.disabled=false; btn.textContent='儲存變更並套用到官網'; }
}

/* ---------- 啟動：驗證既有 token ---------- */
(async function init(){
  if(!TOKEN){ showLogin(); return; }
  if(LIVE()){ showApp(''); return; }  // 部署模式：信任已存 token，伺服器在使用時驗證
  try{
    const res=await fetch('/api/admin/me',{headers:authHeaders()});
    const j=await res.json();
    if(res.ok&&j.ok){ showApp(j.user); } else { localStorage.removeItem(TKEY); TOKEN=''; showLogin(); }
  }catch(e){ showLogin(); }
})();

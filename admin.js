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

/* ---------- 報名管理（= 報名回寫 Sheet 的同一份資料）---------- */
const REG_STATUSES=[['pending_remit','待匯款'],['remitted','已匯款'],['reviewing','審核中'],['approved','審核通過'],['payment_failed','付款失敗']];
function switchTab(which){
  const isB=which==='brands';
  $('view-brands').style.display=isB?'block':'none';
  $('view-regs').style.display=isB?'none':'block';
  $('tab-brands').classList.toggle('on',isB);
  $('tab-regs').classList.toggle('on',!isB);
  if(!isB) loadRegs();
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

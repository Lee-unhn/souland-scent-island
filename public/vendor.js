/* =====================================================================
   嗅覺島 SCENT ISLAND 2026 — 攤商報名頁邏輯
   方案單一價（依新版活動簡介 2026）；完整公司基本資訊 + 參展品類。
   ===================================================================== */
const CFG = window.SOULAND_CONFIG || {};

/* 方案：單一價 / 格數上限（依新版活動簡介 2026） */
const PLANS = {
  '市集攤位':     { price: 6000,  max: 1,  spec: '攤車形式（靈活陳列）' },
  '2×2 精巧攤位': { price: 28000, max: 2,  spec: '4㎡ 含桌架、隔板、配電、門牌' },
  '3×3 標準攤位': { price: 35000, max: 6,  spec: '9㎡ 含桌架、隔板、配電、門牌' },
  '供應鏈攤位':   { price: 30000, max: 12, spec: '專區 原料/包材/設備供應商' }
};
const DEPOSIT_PER = 10000;
let qty = 1;

function fmt(n){ return 'NT$'+n.toLocaleString('en-US'); }
function planName(){ return document.getElementById('f-plan').value; }
function currentMax(){ return (PLANS[planName()]||{}).max || 1; }
function unitPrice(){ return (PLANS[planName()]||{}).price || 0; }

function changeQty(d){ qty=Math.min(currentMax(),Math.max(1,qty+d)); recalc(); }
function onPlanChange(){ if(qty>currentMax()) qty=currentMax(); recalc(); }
function pickPlan(name){
  document.getElementById('f-plan').value=name; qty=1; recalc();
  document.getElementById('applyForm').scrollIntoView({behavior:'smooth'});
}
function recalc(){
  const max=currentMax(), unit=unitPrice();
  const sub=unit*qty, dep=DEPOSIT_PER*qty;
  document.getElementById('qtyval').textContent=qty;
  document.getElementById('qminus').disabled=(qty<=1);
  document.getElementById('qplus').disabled=(qty>=max);
  document.getElementById('qtyHint').textContent='此方案最少 1 格、最多 '+max+' 格';
  document.getElementById('calcPlan').textContent=planName()+' × '+qty+' 格';
  document.getElementById('cUnit').textContent=fmt(unit);
  document.getElementById('cSub').textContent=fmt(sub);
  document.getElementById('cDep').textContent=fmt(dep);
  document.getElementById('cTotal').textContent=fmt(sub+dep);
}

function toast(msg){
  let t=document.getElementById('toast');
  if(!t){ t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent=msg; t.classList.add('show');
  clearTimeout(t._tm); t._tm=setTimeout(()=>t.classList.remove('show'),2800);
}
function validEmail(s){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
const V=id=>{ const e=document.getElementById(id); return e?e.value.trim():''; };

/* =====================================================================
   送出申請 → 後端 /api/register（寫 Google Sheet + 本機備份）→ 報名完成頁
   ===================================================================== */
async function submitApply(btn){
  const sub=unitPrice()*qty, dep=DEPOSIT_PER*qty;
  const display=(document.querySelector('input[name=display]:checked')||{}).value||'品牌名稱';
  const categories=Array.from(document.querySelectorAll('input[name=cat]:checked')).map(c=>c.value);

  const rec={
    formType:'vendor',
    companyZh:V('f-companyZh'), companyEn:V('f-companyEn'),
    brandZh:V('f-brandZh'),     brandEn:V('f-brandEn'),
    displayName:display, taxId:V('f-tax'),
    address:V('f-addr'), zip:V('f-zip'),
    contact:V('f-contact'), owner:V('f-owner'),
    phone:V('f-phone'), mobile:V('f-mobile'),
    email:V('f-mail'), website:V('f-web'),
    ig:V('f-ig'), fb:V('f-fb'),
    foundedYear:V('f-year'), origin:V('f-origin'),
    categories,
    plan:planName(), qty,
    priceType:'單一價',
    unit:unitPrice(), subtotal:sub, deposit:dep, payable:sub+dep,
    msg:V('f-msg'), ts:new Date().toISOString()
  };

  // 驗證
  const bad=[];
  if(!rec.companyZh && !rec.brandZh) bad.push('f-companyZh','f-brandZh');
  if(!rec.contact) bad.push('f-contact');
  if(!rec.mobile)  bad.push('f-mobile');
  if(!validEmail(rec.email)) bad.push('f-mail');
  ['f-companyZh','f-brandZh','f-contact','f-mobile','f-mail'].forEach(id=>{
    const e=document.getElementById(id); if(e) e.classList.toggle('bad',bad.includes(id));
  });
  if(bad.length){ toast('請確認：公司或品牌名稱、聯絡人、手機、有效 Email'); return; }
  if(!document.getElementById('f-agree').checked){ toast('請勾選同意參展辦法與注意事項'); return; }

  // 本機備份
  try{ const k='souland_applications'; const l=JSON.parse(localStorage.getItem(k)||'[]'); l.push(rec); localStorage.setItem(k,JSON.stringify(l)); }catch(e){}

  if(btn){ btn.disabled=true; btn.dataset._t=btn.textContent; btn.textContent='送出中…'; }
  try{
    const live = window.SOULAND_NET && SOULAND_NET.live();
    const j = live
      ? await SOULAND_NET.post('register', rec)
      : await (await fetch(CFG.REGISTER_ENDPOINT||'/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(rec)})).json();
    if(j.ok===false) throw new Error(j.error||'server');
    const q=new URLSearchParams({
      order:j.orderId||'', brand:(rec.brandZh||rec.companyZh),
      plan:rec.plan, qty:String(rec.qty), pay:String(rec.payable)
    });
    window.location.href='thank-you.html?'+q.toString();
  }catch(err){
    console.error(err);
    if(btn){ btn.disabled=false; btn.textContent=btn.dataset._t||'送出申請'; }
    toast('送出失敗，請確認後端 server 已啟動，或來信 '+(CFG.CONTACT_EMAIL||''));
  }
}

recalc();

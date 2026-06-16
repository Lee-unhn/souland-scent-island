/* =====================================================================
   嗅覺島 SOULAND 2026 — 主站互動(唯讀,無後台編輯)
   ===================================================================== */
const CFG = window.SOULAND_CONFIG || {};

/* ---- 等高線場(hero 背景動畫) ---- */
function buildContours(){
  const svg=document.getElementById('contours');
  if(!svg) return;
  const H=800, lines=48; let out='<g class="drift">';
  for(let i=0;i<lines;i++){
    const y=50+i*(H-100)/lines;
    const amp=26+38*Math.sin(i*0.42);
    const ph=i*0.55;
    let d='M -60 '+y.toFixed(1);
    for(let x=0;x<=1260;x+=28){
      const yy=y+amp*Math.sin(x/175+ph)*Math.cos(x/520+ph*0.5);
      d+=' L '+x+' '+yy.toFixed(1);
    }
    const gold=(i%12===6);
    const col=gold?'#B89A5C':'#ffffff';
    const op=gold?0.42:(0.1+0.16*Math.abs(Math.sin(i*0.7)));
    out+='<path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="'+(gold?1:0.75)+'" stroke-opacity="'+op.toFixed(2)+'"/>';
  }
  out+='</g>';
  out+='<circle cx="640" cy="360" r="6" fill="#284664"/><circle cx="640" cy="360" r="13" fill="none" stroke="#284664" stroke-opacity=".5"/>';
  out+='<circle cx="430" cy="500" r="5" fill="#fff"/><circle cx="430" cy="500" r="11" fill="none" stroke="#B89A5C"/>';
  out+='<circle cx="780" cy="560" r="5" fill="#fff"/>';
  svg.innerHTML=out;
}

/* ---- SPA 換頁 ---- */
function go(p){
  document.querySelectorAll('.page').forEach(el=>el.classList.remove('show'));
  const pg=document.getElementById('page-'+p); if(pg) pg.classList.add('show');
  document.querySelectorAll('.nav-links [data-nav]').forEach(b=>b.classList.remove('on'));
  const nb=document.getElementById('nav-'+p); if(nb) nb.classList.add('on');
  if(p==='brands') Brands.render();
  if(p==='visit') renderAllocation();
  const nav=document.querySelector('.nav'); if(nav) nav.classList.remove('open');
  window.scrollTo({top:0,behavior:'smooth'});
}

/* ---- 展場分配（展覽資訊→展場規劃與動線）：由參展品牌的攤位編號動態分區 ---- */
const ALLOC_ZONES=[
  {key:'A',name:'A 區・品牌展區'},{key:'B',name:'B 區・品牌展區'},
  {key:'C',name:'C 區・品牌展區'},{key:'D',name:'D 區・品牌展區'},
  {key:'M',name:'市集攤位區'},{key:'S',name:'供應鏈專區'}
];
function renderAllocation(){
  const box=document.getElementById('allocation'); if(!box) return;
  const e=s=>(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const groups={};
  BRANDS.forEach(b=>{ const code=(b.booth||'').trim().toUpperCase(); const z=code?code.charAt(0):'?'; (groups[z]=groups[z]||[]).push(b); });
  const order=ALLOC_ZONES.map(z=>z.key);
  const zoneName=k=>(ALLOC_ZONES.find(z=>z.key===k)||{}).name||(k+' 區');
  const keys=[...order.filter(k=>groups[k]),...Object.keys(groups).filter(k=>!order.includes(k))];
  if(!keys.length){ box.innerHTML='<div class="alloc-empty">展場分配將於品牌陣容確認後公布。</div>'; return; }
  box.innerHTML=keys.map(k=>{
    const items=groups[k].slice().sort((a,b)=>(a.booth||'').localeCompare(b.booth||''));
    return '<div class="alloc-zone"><div class="alloc-zone-h"><span class="zk">'+e(k)+'</span><span class="zn">'+e(zoneName(k))+'</span><span class="zc">'+items.length+' 家</span></div>'+
      items.map(b=>'<div class="alloc-item" onclick="Brands.openDetail(\''+b.id+'\')"><span class="ab">'+e(b.booth||'—')+'</span><span class="anm">'+e(b.name)+'</span><span class="aty">'+e(b.type||'')+'</span></div>').join('')+
      '</div>';
  }).join('');
}

/* ---- 開幕倒數 ---- */
const OPENING=new Date('2026-10-30T10:00:00+08:00');
function tick(){
  const d=document.getElementById('cd-d'); if(!d) return;
  const pad=n=>String(n).padStart(2,'0');
  let ms=OPENING-new Date(); if(ms<0)ms=0;
  d.textContent=Math.floor(ms/864e5);
  document.getElementById('cd-h').textContent=pad(Math.floor(ms%864e5/36e5));
  document.getElementById('cd-m').textContent=pad(Math.floor(ms%36e5/6e4));
  const s=document.getElementById('cd-s'); if(s) s.textContent=pad(Math.floor(ms%6e4/1e3));
}

/* ---- 購票連結跳轉 ---- */
function openTickets(){
  const u=CFG.TICKET_URL;
  if(u){ window.open(u,'_blank','noopener'); }
  else { toast('購票將於 8 月開放'); }
}
function applyTicketUrl(){
  const u=CFG.TICKET_URL;
  document.querySelectorAll('[data-ticket]').forEach(el=>{
    if(u){
      el.disabled=false; el.style.opacity='';
      el.innerHTML=el.dataset.ticketLabel||'購票';
      el.classList.remove('btn-ghost'); if(el.classList.contains('btn')) el.classList.add('btn-primary');
      el.onclick=openTickets;
    } else {
      el.disabled=true;
      el.innerHTML=(el.dataset.ticketLabel||'購票')+' <span class="nav-soon">8月開放</span>';
      el.onclick=null;
    }
  });
}

/* ---- Toast ---- */
function toast(msg){
  let t=document.getElementById('toast');
  if(!t){ t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent=msg; t.classList.add('show');
  clearTimeout(t._tm); t._tm=setTimeout(()=>t.classList.remove('show'),2200);
}

/* =====================================================================
   參展品牌(唯讀目錄)
   ── 要上架品牌:把資料物件加進下面的 BRANDS 陣列即可,版面自動生成。
      欄位:{id,name,en,type,country,booth,top,heart,base,story,products,social,logo}
      products:[{name,note,desc}]
   ===================================================================== */
const BRANDS = [
  // 範例(上線前請以正式簽約品牌替換或清空):
  // {id:'b1',name:'品牌名',en:'Brand',type:'香水',country:'台灣',booth:'A-12',
  //  top:'前調',heart:'中調',base:'後調',story:'品牌故事…',products:[],social:''}
];

const Brands = {
  filterType:'全部', filterCountry:'全部', q:'',
  esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); },
  uniq(key){ return ['全部',...Array.from(new Set(BRANDS.map(b=>b[key]).filter(Boolean)))]; },
  filtered(){
    return BRANDS.filter(b=>{
      if(this.filterType!=='全部'&&b.type!==this.filterType) return false;
      if(this.filterCountry!=='全部'&&b.country!==this.filterCountry) return false;
      if(this.q){ const q=this.q.toLowerCase(); if(!((b.name||'').toLowerCase().includes(q)||(b.en||'').toLowerCase().includes(q))) return false; }
      return true;
    });
  },
  logoHTML(b){
    if(b.logo) return '<div class="blogo"><img src="'+this.esc(b.logo)+'" alt="'+this.esc(b.name)+'"></div>';
    return '<div class="blogo"><span class="mono">'+((b.name||'·').trim().charAt(0))+'</span></div>';
  },
  cardHTML(b){
    const meta=[b.type,b.country,b.booth?'攤位 '+b.booth:''].filter(Boolean).join(' · ');
    const intro=(b.story||'').replace(/\n/g,' ');
    return '<article class="bcard" onclick="Brands.openDetail(\''+b.id+'\')">'+
      this.logoHTML(b)+
      '<h3>'+this.esc(b.name)+'</h3><div class="ben">'+this.esc(b.en||'')+'</div>'+
      '<p class="bdesc">'+this.esc(intro)+'</p>'+
      '<div class="bcard-foot"><span>'+this.esc(meta)+'</span><span class="arrow">探索 →</span></div>'+
      '</article>';
  },
  render(){
    const fb=document.getElementById('filterbar');
    const grid=document.getElementById('brandgrid');
    const cnt=document.getElementById('bcount');
    if(!grid) return;
    if(!BRANDS.length){
      if(fb) fb.innerHTML=''; if(cnt) cnt.textContent='';
      grid.innerHTML='<div class="brand-empty"><div class="big">品牌陣容陸續公布中</div>'+
        '正式參展品牌名單將於展前兩週於本頁公告,敬請期待。<br>品牌欲參展,歡迎前往「我要參展」提交申請。</div>';
      return;
    }
    if(fb){
      const types=this.uniq('type'), countries=this.uniq('country');
      const chip=(v,active,fn)=>'<button class="chip'+(v===active?' on':'')+'" onclick="Brands.'+fn+'(\''+v+'\')">'+v+'</button>';
      fb.innerHTML=
        '<div class="fgroup"><span class="flabel">類型</span>'+types.map(t=>chip(t,this.filterType,'setType')).join('')+'</div>'+
        '<div class="fgroup"><span class="flabel">產地</span>'+countries.map(c=>chip(c,this.filterCountry,'setCountry')).join('')+'</div>'+
        '<div class="searchbox">🔍<input id="bsearch" placeholder="搜尋品牌" value="'+this.esc(this.q)+'" oninput="Brands.search(this.value)"></div>';
    }
    this.updateGrid();
  },
  updateGrid(){
    const list=this.filtered();
    const cnt=document.getElementById('bcount'); if(cnt) cnt.textContent='共 '+list.length+' 個品牌';
    const grid=document.getElementById('brandgrid');
    grid.innerHTML=list.length?list.map(b=>this.cardHTML(b)).join(''):'<div class="brand-empty">沒有符合條件的品牌。</div>';
  },
  setType(t){ this.filterType=t; this.render(); },
  setCountry(c){ this.filterCountry=c; this.render(); },
  search(v){ this.q=v; this.updateGrid(); },
  openDetail(id){
    const b=BRANDS.find(x=>x.id===id); if(!b) return;
    const logo=b.logo?'<div class="bd-logo"><img src="'+this.esc(b.logo)+'" alt="'+this.esc(b.name)+'"></div>'
                     :'<div class="bd-logo"><span>'+((b.name||'·').trim().charAt(0))+'</span></div>';
    document.getElementById('bd-head').innerHTML=
      logo+'<div class="bd-cat">'+[b.type,b.country].filter(Boolean).join(' · ')+'</div>'+
      '<h1>'+this.esc(b.name)+'</h1><div class="bd-en">'+this.esc(b.en||'')+'</div>'+
      (b.booth?'<div class="bd-booth">攤位編號 '+this.esc(b.booth)+'</div>':'');
    const notes=[['TOP',b.top],['HEART',b.heart],['BASE',b.base]].filter(n=>n[1])
      .map(n=>'<div class="note-line"><span>'+n[0]+'</span><span>'+this.esc(n[1])+'</span></div>').join('');
    const prods=(b.products&&b.products.length)?
      '<div class="bd-products"><h4>產品推薦</h4>'+b.products.map(p=>
        '<div class="product"><div class="pname">'+this.esc(p.name)+'</div>'+
        (p.note?'<div class="pnote">'+this.esc(p.note)+'</div>':'')+
        (p.desc?'<div class="pdesc">'+this.esc(p.desc)+'</div>':'')+'</div>').join('')+'</div>':'';
    document.getElementById('bd-body').innerHTML=
      '<div class="bd-story"><h4>品牌故事</h4><p>'+this.esc(b.story||'')+'</p>'+prods+'</div>'+
      '<aside class="bd-side">'+(notes?'<h4>香調結構</h4>'+notes:'')+
        (b.social?'<a class="bd-social" href="'+this.esc(b.social)+'" target="_blank" rel="noopener">品牌社群 →</a>':'')+'</aside>';
    document.querySelectorAll('.page').forEach(el=>el.classList.remove('show'));
    document.getElementById('page-brand').classList.add('show');
    document.querySelectorAll('.nav-links [data-nav]').forEach(x=>x.classList.remove('on'));
    const nb=document.getElementById('nav-brands'); if(nb) nb.classList.add('on');
    window.scrollTo({top:0,behavior:'smooth'});
  }
};

/* =====================================================================
   次要表單(工作坊候補 / 買手登記 / 一般聯絡)
   與攤商報名共用同一個 Apps Script;Code.gs 依 formType 寫到不同分頁。
   ===================================================================== */
function validEmail(s){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
async function submitSimple(formType, rec, okElId){
  if(!validEmail(rec.mail||'')){ toast('請填寫有效 Email'); return; }
  rec.formType=formType; rec.ts=new Date().toISOString();
  try{
    const k='souland_'+formType;
    const list=JSON.parse(localStorage.getItem(k)||'[]'); list.push(rec);
    localStorage.setItem(k,JSON.stringify(list));
  }catch(e){}
  const live = window.SOULAND_NET && SOULAND_NET.live();
  if(live){
    try{ await SOULAND_NET.post(formType, rec); }catch(e){ console.error(e); }
  }
  const ok=document.getElementById(okElId); if(ok) ok.style.display='block';
  toast(live?'已送出,感謝您':'資料已暫存(報名通道部署後開通)');
}
function val(id){ const e=document.getElementById(id); return e?e.value.trim():''; }
function submitWorkshop(){ submitSimple('workshop',{name:val('w-name'),mail:val('w-mail'),session:document.getElementById('w-session').value},'wOk'); }
function submitBuyer(){ submitSimple('buyer',{company:val('bz-co'),name:val('bz-name'),mail:val('bz-mail'),channel:document.getElementById('bz-type').value,msg:val('bz-msg')},'bzOk'); }
function submitContact(){ submitSimple('contact',{topic:document.getElementById('c-topic').value,name:val('c-name'),mail:val('c-mail'),msg:val('c-msg')},'cOk'); }

/* ---- 從後台讀取已發布的參展品牌（admin 後台維護）---- */
async function loadBrands(){
  let j = null;
  try{
    j = (window.SOULAND_NET && SOULAND_NET.live())
      ? await SOULAND_NET.get('brandsPublic')
      : await (await fetch('/api/brands')).json();
  }catch(e){ j = null; }
  // 靜態站 fallback：無後端（GitHub Pages）時讀打包進站的 brands.json
  if(!(j && j.ok && Array.isArray(j.brands) && j.brands.length)){
    try{ const b = await (await fetch('brands.json',{cache:'no-store'})).json(); if(Array.isArray(b)) j = { ok:true, brands:b }; }catch(e){}
  }
  if(j && j.ok && Array.isArray(j.brands)){ BRANDS.length=0; BRANDS.push(...j.brands); }
  if(document.getElementById('page-brands')) Brands.render();
  renderAllocation();
}

/* ---- 套用後台「版面設定」：首頁區塊顯示/排序 + 導覽/購票/報名開關 ---- */
async function applyLayout(){
  if(!(window.SOULAND_NET && SOULAND_NET.live())) return;  // 無後端 → 維持原始版面
  let cfg;
  try{ const j = await SOULAND_NET.get('layoutGet'); if(!(j && j.ok && j.layout)) return; cfg = j.layout; }catch(e){ return; }
  // 首頁區塊：依設定排序 + 顯示/隱藏
  const home = document.getElementById('page-home');
  if(home && Array.isArray(cfg.sections)){
    cfg.sections.forEach(s=>{
      const el = home.querySelector('[data-section="'+s.key+'"]');
      if(!el) return;
      el.style.display = (s.visible===false) ? 'none' : '';
      home.appendChild(el);  // 移到設定順序（hero 之後）
    });
  }
  // 導覽列項目
  if(cfg.nav){ Object.keys(cfg.nav).forEach(k=>{ const b=document.getElementById('nav-'+k); if(b) b.style.display = (cfg.nav[k]===false)?'none':''; }); }
  // 購票鈕
  if(cfg.ticket===false){ document.querySelectorAll('[data-ticket],[data-ticket-foot]').forEach(el=>el.style.display='none'); }
  // 我要參展 / 報名 CTA
  if(cfg.register===false){ document.querySelectorAll('a[href="vendor.html"]').forEach(el=>el.style.display='none'); }
}

/* ---- init ---- */
buildContours();
tick(); setInterval(tick,1000);
applyTicketUrl();
loadBrands();
applyLayout();

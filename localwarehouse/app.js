const $=s=>document.querySelector(s);
const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))||d}catch(e){return d}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// The review text decides: a fault word means defect, otherwise personal dissatisfaction.
const DEFECT=/(stopp|broke|snap|crack|damag|defect|faulty|not work|doesn.t work|dead|leak|torn|tear|burn|short.?circuit|malfunction|stuck|rust)/i;
const mSeason=m=>m>=2&&m<=5?'summer':m>=6&&m<=10?'monsoon':'winter';
const NOW=mSeason(new Date().getMonth());
const FIT={summer:true,monsoon:true,winter:false}; // Does the local climate suit this season's items?
const LABEL={repair:'Local repair',local:'Local warehouse',far:'Central hub'};
const COLOR={summer:'#e0a800',monsoon:'#3a9aa8',winter:'#7b6bd6'};

// Local warehouse stock list: name, category, units in stock, price
const RAW={
summer:[['Tower Air Cooler 40L','Appliances',24,6499],['Desert Air Cooler 70L','Appliances',12,9499],['Table Fan 400 mm','Appliances',46,1499],['Pedestal Fan 500 mm','Appliances',28,2799],['Portable Neck Fan','Accessories',60,899],['Polarised Sunglasses','Accessories',85,799],['SPF 50 Sunscreen 100 ml','Personal care',120,349],['Aloe Vera Cooling Gel','Personal care',70,199],['Insulated Steel Bottle 1 L','Home',55,599],['Cotton Summer Shirt','Apparel',64,699],['Linen Shorts','Apparel',48,549],['Wide-brim Sun Hat','Accessories',40,399],['Cooling Towel','Accessories',75,249],['Ice Gel Pack Set','Home',30,349],['Electrolyte Drink Mix (20)','Food',90,399],['UV Protection Arm Sleeves','Apparel',58,299]],
monsoon:[['Auto-open Umbrella','Accessories',70,449],['Compact Folding Umbrella','Accessories',52,349],['Rain Jacket and Pants Set','Apparel',38,899],['Poncho Raincoat','Apparel',66,399],['Waterproof Gumboots','Footwear',32,749],['Anti-slip Rain Sandals','Footwear',44,649],['Waterproof Dry Bag 20 L','Bags',50,549],['Waterproof Backpack Cover','Bags',80,249],['Waterproof Phone Pouch','Accessories',110,199],['Quick-dry Microfibre Towel','Home',90,299],['Folding Clothes Drying Stand','Home',26,1299],['Mosquito Repellent Liquid','Personal care',100,149],['Dehumidifier Bags (6)','Home',62,299],['Car Windshield Rain Repellent','Auto',36,349],['Waterproof Boot Spray','Footwear',42,399],['Water Absorbent Door Mat','Home',54,349]],
winter:[['Wool Blend Sweater','Apparel',34,1299],['Hooded Fleece Jacket','Apparel',22,1799],['Room Heater 2000 W','Appliances',18,1899],['Oil-filled Radiator 9 Fin','Appliances',9,6999],['Storage Water Heater 15 L','Appliances',14,5999],['Instant Water Geyser 3 L','Appliances',20,2999],['Thermal Gloves','Accessories',88,299],['Woollen Cap','Accessories',72,249],['Wool Muffler','Accessories',60,399],['Thermal Innerwear Set','Apparel',46,799],['Fleece Blanket','Home',40,999],['Electric Blanket','Appliances',11,2499],['Wool Socks (3 pairs)','Apparel',96,349],['Moisturising Body Lotion 400 ml','Personal care',130,299],['Lip Balm Pack (3)','Personal care',140,199],['Hot Water Bag','Home',48,399]]
};
const STOCK=[];
Object.keys(RAW).forEach(s=>RAW[s].forEach((a,i)=>{const n=String(i+1).padStart(2,'0');STOCK.push({sku:s.slice(0,3).toUpperCase()+'-'+n,name:a[0],season:s,cat:a[1],qty:a[2],price:a[3]})}));

let sel=null,ovId=null;
const cfg=()=>Object.assign({cap:3500},load('warehub_cfg',{}));
const rets=()=>load('seasonmart_returns',[]).slice().reverse();
const st=()=>load('warehub_admin',{});
const stockTotal=()=>STOCK.reduce((a,p)=>a+p.qty,0);
const localUsed=()=>stockTotal()+Object.values(st()).filter(x=>x.dest==='local').length;
const toast=t=>{const e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2500)};
const when=r=>new Date(r.at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});

function classify(r){const m=DEFECT.exec(r.reasonText||'');return m?{cls:'Defect',hit:m[0].toLowerCase()}:{cls:'Dissatisfaction'}}
function recommend(r){
  const c=classify(r),cf=cfg(),used=localUsed();
  if(c.cls==='Defect')return {c,dest:'repair',steps:[`Review mentions "${c.hit}", so it is classed as a defect.`,'Defects go to a local repair shop.','After repair, the unit is re-checked for local demand if the customer wants a refund.']};
  const high=r.season===NOW,fit=FIT[r.season];
  const steps=['Review does not describe a fault, so it is classed as dissatisfaction.',`Local demand for ${r.season} items is ${high?'high':'low'} this month.`];
  let dest;
  if(high)dest='local';else{steps.push(`Chennai climate ${fit?'suits':'does not suit'} ${r.season} items.`);dest=fit?'local':'far'}
  if(dest==='local'&&used>=cf.cap){steps.push(`Local warehouse is full (${used}/${cf.cap} units), so it goes to the far warehouse.`);dest='far'}
  return {c,dest,steps};
}
function apply(id,dest,how){const s=st();s[id]={dest,at:new Date().toISOString()};save('warehub_admin',s);toast((how||'Approved')+' — Return '+id+' sent to: '+LABEL[dest]);render()}

function statusMeta(x){
  if(!x)return {cls:'pending',label:'Awaiting decision'};
  if(x.dest==='repair')return {cls:'repair',label:'In repair'};
  if(x.repaired)return {cls:x.dest==='far'?'hub':'local',label:'Repaired · '+LABEL[x.dest]};
  if(x.dest==='far')return {cls:'hub',label:'Central hub'};
  return {cls:'local',label:'Local warehouse'};
}

function renderKpi(){
  const R=rets(),s=st();
  const available=stockTotal(),cf=cfg();
  const hub=Object.values(s).filter(x=>x.dest==='far').length;
  $('#kp').innerHTML=`<div class="k"><small>Available in this warehouse</small><b>${available.toLocaleString('en-IN')}</b><small class="sub">of ${cf.cap.toLocaleString('en-IN')} capacity</small></div>
  <div class="k"><small>Returned items</small><b>${R.length}</b></div>
  <div class="k"><small>Sent to central hub</small><b>${hub}</b></div>`;
}

function seasonBars(){
  const s=st(),cnt={summer:0,monsoon:0,winter:0};
  STOCK.forEach(p=>cnt[p.season]+=p.qty);
  load('seasonmart_returns',[]).forEach(r=>{const x=s[r.returnId];if(x&&x.dest==='local'&&cnt[r.season]!==undefined)cnt[r.season]++});
  const mx=Math.max(...Object.values(cnt),1);
  return Object.keys(cnt).map(k=>`<div class="row"><span>${k[0].toUpperCase()+k.slice(1)}</span><div class="b"><i style="width:${cnt[k]/mx*100}%;background:${COLOR[k]}"></i></div><b>${cnt[k]}</b></div>`).join('');
}

function renderActivity(){
  const R=rets(),s=st();
  if(!R.length){$('#actList').innerHTML='<p class="empty">No activity yet. Returns submitted from the store will appear here.</p>';return}
  if(!sel||!R.find(r=>r.returnId===sel))sel=(R.find(r=>!s[r.returnId])||R[0]).returnId;
  $('#actList').innerHTML=R.map(r=>{
    const meta=statusMeta(s[r.returnId]),active=r.returnId===sel?'active':'';
    return `<button class="queue-row ${active}" data-sel="${esc(r.returnId)}">
      <span class="qr-dot ${meta.cls}"></span>
      <span class="qr-main"><span class="qr-product">${esc(r.product)}</span>
      <span class="qr-meta">${esc(r.season)} &middot; ${when(r)}</span></span>
      <span class="qr-status ${meta.cls}">${meta.label}</span>
    </button>`;
  }).join('');
}

function renderDetail(){
  const R=rets();
  if(!R.length){
    $('#detail').innerHTML=`<div class="detail-placeholder"><p>Select a product from the warehouse activity to view its decision analysis.</p></div>
    <section class="panel"><p class="panel-title">Stock by season</p>${seasonBars()}</section>`;
    return;
  }
  const r=R.find(x=>x.returnId===sel),s=st(),rec=recommend(r),done=s[sel],meta=statusMeta(done);
  const badgeClass=rec.c.cls==='Defect'?'badge-defect':'badge-dissatisfaction';
  let html=`<div class="detail-header">
    <div><p class="detail-eyebrow">RETURN ${esc(r.returnId.toUpperCase())}</p><h2>${esc(r.product)}</h2>
    <p class="detail-sub">${esc(r.season[0].toUpperCase()+r.season.slice(1))} &middot; received ${when(r)}</p></div>
    <span class="status-badge ${meta.cls}">${meta.label}</span>
  </div>`;
  html+=`<section class="panel"><p class="panel-title">Customer review</p><p class="review-text">&ldquo;${esc(r.reasonText)}&rdquo;</p></section>`;
  html+=`<section class="panel"><p class="panel-title">Classification</p><span class="badge ${badgeClass}">${esc(rec.c.cls)}</span></section>`;
  html+=`<section class="panel"><p class="panel-title">Why this decision?</p>${rec.steps.map((t,i)=>`<div class="step"><i>${i+1}</i><span>${esc(t)}</span></div>`).join('')}</section>`;
  let actions='';
  if(!done)actions=`<div class="dact"><button class="btn p1" data-ap="${esc(sel)}">Approve</button><button class="btn" data-ov="${esc(sel)}">Override</button></div>`;
  else if(done.dest==='repair'&&!done.repaired)actions=`<div class="dact"><button class="btn p1" data-fix="${esc(sel)}">Mark repaired</button></div>`;
  html+=`<section class="panel"><div class="decision-banner ${done?done.dest:rec.dest}">
    <p class="route-label">${done?'Placed: '+LABEL[done.dest]:'Recommended: '+LABEL[rec.dest]}</p>
    ${actions}
  </div></section>`;
  html+=`<section class="panel"><p class="panel-title">Stock by season</p>${seasonBars()}</section>`;
  $('#detail').innerHTML=html;
}

function render(){renderKpi();renderActivity();renderDetail()}

document.addEventListener('click',e=>{
  const t=e.target.closest('button,[data-sel]')||e.target,d=t.dataset||{};
  if(d.close!==undefined){t.closest('dialog').close()}
  else if(d.sel){sel=d.sel;render()}
  else if(d.ap){apply(d.ap,recommend(rets().find(r=>r.returnId===d.ap)).dest,'Approved')}
  else if(d.ov){ovId=d.ov;$('#ovTitle').textContent='Override '+d.ov;$('#ovDlg').showModal()}
  else if(d.fix){
    const s=st(),full=localUsed()>=cfg().cap;
    s[d.fix]={dest:full?'far':'local',repaired:true,at:new Date().toISOString()};save('warehub_admin',s);
    toast(full?'Repaired, but local warehouse is full. Sent to central hub.':'Repaired and added to local inventory.');render();
  }
});
$('#ovForm').onsubmit=e=>{e.preventDefault();apply(ovId,new FormData(e.target).get('d'),'Overridden');$('#ovDlg').close()};
$('#ovCancel').onclick=()=>$('#ovDlg').close();
window.addEventListener('storage',render);

// ---- Dark mode ----
function setTheme(m){document.documentElement.dataset.theme=m;localStorage.setItem('warehub_theme',m);$('#themeBtn').textContent=m==='dark'?'Light mode':'Dark mode'}
$('#themeBtn').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
setTheme(localStorage.getItem('warehub_theme')||'light');

render();

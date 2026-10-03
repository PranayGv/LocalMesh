const $=s=>document.querySelector(s);
const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))||d}catch(e){return d}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// The review text decides: a fault word means defect, otherwise personal dissatisfaction.
const DEFECT=/(stopp|broke|snap|crack|damag|defect|faulty|not work|doesn.t work|dead|leak|torn|tear|burn|short.?circuit|malfunction|stuck|rust)/i;
const mSeason=m=>m>=2&&m<=5?'summer':m>=6&&m<=10?'monsoon':'winter';
const NOW=mSeason(new Date().getMonth());
const LABEL={repair:'Local repair',local:'Local warehouse',far:'Central hub'};
const COLOR={summer:'#e0a800',monsoon:'#3a9aa8',winter:'#7b6bd6'};
const LOW=15; // units at or below this count as low stock

// Warehouse locations — mirrors backend mock_data.AREAS, so routing decisions
// made here (climate fit, nearest-pincode resolution) line up with the real
// LocalMesh WMS admin panel.
const AREAS=[
  {code:'RAJ',name:'Jaipur',pincode:'302001',climate_zone:'Hot'},
  {code:'DEL',name:'Delhi',pincode:'110001',climate_zone:'Hot'},
  {code:'BLR',name:'Bengaluru',pincode:'560001',climate_zone:'Moderate'},
  {code:'PUN',name:'Pune',pincode:'411001',climate_zone:'Moderate'},
  {code:'SHM',name:'Shimla',pincode:'171001',climate_zone:'Cold'},
  {code:'MUM',name:'Mumbai',pincode:'400001',climate_zone:'Hot'},
  {code:'CHE',name:'Chennai',pincode:'600001',climate_zone:'Hot'},
  {code:'KOL',name:'Kolkata',pincode:'700001',climate_zone:'Moderate'},
  {code:'LKO',name:'Lucknow',pincode:'226001',climate_zone:'Hot'},
  {code:'LEH',name:'Leh',pincode:'194101',climate_zone:'Cold'},
];
const AREA_BY_CODE=Object.fromEntries(AREAS.map(a=>[a.code,a]));
// Which climate zones each season's items suit — mirrors backend
// mock_data.SEASON_SUITED_CLIMATES.
const SEASON_SUITED={summer:['Hot','Moderate'],monsoon:['Hot','Moderate','Cold'],winter:['Cold','Moderate']};

function resolveArea(pincode){
  pincode=(pincode||'').trim();
  if(!pincode)return AREAS[0];
  const exact=AREAS.find(a=>a.pincode===pincode);
  if(exact)return exact;
  const shared=(a,b)=>{let n=0;for(let i=0;i<Math.min(a.length,b.length);i++){if(a[i]!==b[i])break;n++}return n};
  return AREAS.reduce((best,a)=>shared(a.pincode,pincode)>shared(best.pincode,pincode)?a:best,AREAS[0]);
}

// Local warehouse stock catalog: name, category, units in stock, price. Every
// local warehouse carries the same catalog; each location keeps its own
// counts (see stockList below).
const RAW={
summer:[['Tower Air Cooler 40L','Appliances',24,6499],['Desert Air Cooler 70L','Appliances',12,9499],['Table Fan 400 mm','Appliances',46,1499],['Pedestal Fan 500 mm','Appliances',28,2799],['Portable Neck Fan','Accessories',60,899],['Polarised Sunglasses','Accessories',85,799],['SPF 50 Sunscreen 100 ml','Personal care',120,349],['Aloe Vera Cooling Gel','Personal care',70,199],['Insulated Steel Bottle 1 L','Home',55,599],['Cotton Summer Shirt','Apparel',64,699],['Linen Shorts','Apparel',48,549],['Wide-brim Sun Hat','Accessories',40,399],['Cooling Towel','Accessories',75,249],['Ice Gel Pack Set','Home',30,349],['Electrolyte Drink Mix (20)','Food',90,399],['UV Protection Arm Sleeves','Apparel',58,299]],
monsoon:[['Auto-open Umbrella','Accessories',70,449],['Compact Folding Umbrella','Accessories',52,349],['Rain Jacket and Pants Set','Apparel',38,899],['Poncho Raincoat','Apparel',66,399],['Waterproof Gumboots','Footwear',32,749],['Anti-slip Rain Sandals','Footwear',44,649],['Waterproof Dry Bag 20 L','Bags',50,549],['Waterproof Backpack Cover','Bags',80,249],['Waterproof Phone Pouch','Accessories',110,199],['Quick-dry Microfibre Towel','Home',90,299],['Folding Clothes Drying Stand','Home',26,1299],['Mosquito Repellent Liquid','Personal care',100,149],['Dehumidifier Bags (6)','Home',62,299],['Car Windshield Rain Repellent','Auto',36,349],['Waterproof Boot Spray','Footwear',42,399],['Water Absorbent Door Mat','Home',54,349]],
winter:[['Wool Blend Sweater','Apparel',34,1299],['Hooded Fleece Jacket','Apparel',22,1799],['Room Heater 2000 W','Appliances',18,1899],['Oil-filled Radiator 9 Fin','Appliances',9,6999],['Storage Water Heater 15 L','Appliances',14,5999],['Instant Water Geyser 3 L','Appliances',20,2999],['Thermal Gloves','Accessories',88,299],['Woollen Cap','Accessories',72,249],['Wool Muffler','Accessories',60,399],['Thermal Innerwear Set','Apparel',46,799],['Fleece Blanket','Home',40,999],['Electric Blanket','Appliances',11,2499],['Wool Socks (3 pairs)','Apparel',96,349],['Moisturising Body Lotion 400 ml','Personal care',130,299],['Lip Balm Pack (3)','Personal care',140,199],['Hot Water Bag','Home',48,399]]
};
const STOCK=[];
Object.keys(RAW).forEach(s=>RAW[s].forEach((a,i)=>{const n=String(i+1).padStart(2,'0');STOCK.push({sku:s.slice(0,3).toUpperCase()+'-'+n,name:a[0],season:s,cat:a[1],qty:a[2],price:a[3]})}));

const CENTRAL='CENTRAL';
let loc=localStorage.getItem('warehub_location')||'CHE';
let view='act';
let sel=null,ovId=null,invQ='',invS='all',invLow=false;

const cfg=()=>Object.assign({cap:3500},load('warehub_cfg',{}));
const rets=()=>load('seasonmart_returns',[]).slice().reverse();
const st=()=>load('warehub_admin',{});
const areaFor=r=>resolveArea(r.pincode).code;
const retsFor=code=>rets().filter(r=>areaFor(r)===code);
const toast=t=>{const e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2500)};
const when=r=>new Date(r.at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const inr=n=>n===''||n==null?'-':'₹'+n.toLocaleString('en-IN');

// Each local warehouse keeps its own stock-count overrides, starting from
// the shared catalog above.
const stockList=code=>{const ov=load('warehub_stock_'+code,{});return STOCK.map(p=>Object.assign({},p,{qty:p.sku in ov?ov[p.sku]:p.qty}))};
const stockTotal=code=>stockList(code).reduce((a,p)=>a+p.qty,0);
const localUsed=code=>{const s=st();return stockTotal(code)+retsFor(code).filter(r=>s[r.returnId]&&s[r.returnId].dest==='local').length};

function classify(r){const m=DEFECT.exec(r.reasonText||'');return m?{cls:'Defect',hit:m[0].toLowerCase()}:{cls:'Dissatisfaction'}}

// Routing decision is based on the return's own resolved origin warehouse —
// not whichever location the viewer currently has selected — so switching
// the "Active warehouse" dropdown never changes how an item is classified.
function recommend(r){
  const origin=resolveArea(r.pincode),c=classify(r),cf=cfg(),used=localUsed(origin.code);
  if(c.cls==='Defect')return {c,origin,dest:'repair',steps:[`Review mentions "${c.hit}", so it is classed as a defect.`,`Defects go to ${origin.name}'s local repair shop.`,'After repair, the unit is re-checked for local demand if the customer wants a refund.']};
  const high=r.season===NOW,suited=SEASON_SUITED[r.season].includes(origin.climate_zone);
  const steps=['Review does not describe a fault, so it is classed as dissatisfaction.',`Local demand for ${r.season} items is ${high?'high':'low'} this month.`];
  let dest;
  if(high)dest='local';else{steps.push(`${origin.name} is a ${origin.climate_zone} climate zone, which ${suited?'suits':'does not suit'} ${r.season} items.`);dest=suited?'local':'far'}
  if(dest==='local'&&used>=cf.cap){steps.push(`${origin.name}'s warehouse is full (${used}/${cf.cap} units), so it goes to the central hub.`);dest='far'}
  return {c,origin,dest,steps};
}
function apply(id,dest,how){const s=st();s[id]={dest,at:new Date().toISOString()};save('warehub_admin',s);toast((how||'Approved')+' — Return '+id+' sent to: '+LABEL[dest]);render()}

function statusMeta(x){
  if(!x)return {cls:'pending',label:'Awaiting decision'};
  if(x.dest==='repair')return {cls:'repair',label:'In repair'};
  if(x.repaired)return {cls:x.dest==='far'?'hub':'local',label:'Repaired · '+LABEL[x.dest]};
  if(x.dest==='far')return {cls:'hub',label:'Central hub'};
  return {cls:'local',label:'Local warehouse'};
}

function isCentral(){return loc===CENTRAL}

function initLocationPicker(){
  const sel2=$('#whSel');
  const localGroup=document.createElement('optgroup');
  localGroup.label='Local warehouses';
  AREAS.forEach(a=>{const o=document.createElement('option');o.value=a.code;o.textContent=a.name;localGroup.appendChild(o)});
  const hubGroup=document.createElement('optgroup');
  hubGroup.label='Hub';
  const hubOpt=document.createElement('option');hubOpt.value=CENTRAL;hubOpt.textContent='Central Warehouse (Hub)';
  hubGroup.appendChild(hubOpt);
  sel2.appendChild(localGroup);sel2.appendChild(hubGroup);
  sel2.value=loc;
  sel2.addEventListener('change',()=>{
    loc=sel2.value;localStorage.setItem('warehub_location',loc);
    sel=null;invQ='';invS='all';invLow=false;
    if($('#invQ'))$('#invQ').value='';
    if($('#invS'))$('#invS').value='all';
    if($('#invLow'))$('#invLow').checked=false;
    render();
  });
}

function renderKpi(){
  const cf=cfg();
  if(isCentral()){
    const all=rets(),hub=all.filter(r=>{const x=st()[r.returnId];return x&&x.dest==='far'});
    const origins=new Set(hub.map(r=>areaFor(r)));
    $('#kp').innerHTML=`<div class="k"><small>Items at central hub</small><b>${hub.length.toLocaleString('en-IN')}</b></div>
    <div class="k"><small>Local warehouses feeding in</small><b>${origins.size}</b><small class="sub">of ${AREAS.length} locations</small></div>
    <div class="k"><small>Returned items (all locations)</small><b>${all.length.toLocaleString('en-IN')}</b></div>`;
    return;
  }
  const R=retsFor(loc),s=st(),available=stockTotal(loc);
  const hub=R.filter(r=>{const x=s[r.returnId];return x&&x.dest==='far'}).length;
  $('#kp').innerHTML=`<div class="k"><small>Available in this warehouse</small><b>${available.toLocaleString('en-IN')}</b><small class="sub">of ${cf.cap.toLocaleString('en-IN')} capacity</small></div>
  <div class="k"><small>Returned items</small><b>${R.length}</b></div>
  <div class="k"><small>Sent to central hub</small><b>${hub}</b></div>`;
}

function seasonBars(code){
  const s=st(),cnt={summer:0,monsoon:0,winter:0};
  stockList(code).forEach(p=>cnt[p.season]+=p.qty);
  retsFor(code).forEach(r=>{const x=s[r.returnId];if(x&&x.dest==='local'&&cnt[r.season]!==undefined)cnt[r.season]++});
  const mx=Math.max(...Object.values(cnt),1);
  return Object.keys(cnt).map(k=>`<div class="row"><span>${k[0].toUpperCase()+k.slice(1)}</span><div class="b"><i style="width:${cnt[k]/mx*100}%;background:${COLOR[k]}"></i></div><b>${cnt[k]}</b></div>`).join('');
}
function hubBySeasonBars(){
  const s=st(),cnt={summer:0,monsoon:0,winter:0};
  rets().forEach(r=>{const x=s[r.returnId];if(x&&x.dest==='far'&&cnt[r.season]!==undefined)cnt[r.season]++});
  const mx=Math.max(...Object.values(cnt),1);
  return Object.keys(cnt).map(k=>`<div class="row"><span>${k[0].toUpperCase()+k.slice(1)}</span><div class="b"><i style="width:${cnt[k]/mx*100}%;background:${COLOR[k]}"></i></div><b>${cnt[k]}</b></div>`).join('');
}

function activityList(){return isCentral()?rets().filter(r=>{const x=st()[r.returnId];return x&&x.dest==='far'}):retsFor(loc)}

function renderActivity(){
  const R=activityList(),s=st();
  $('#actTitle').textContent=isCentral()?'Items at the central hub':'Activity in this warehouse';
  $('#actHint').textContent=isCentral()?'Sent here from every local warehouse':'Returns, repairs and central hub transfers';
  if(!R.length){$('#actList').innerHTML=`<p class="empty">${isCentral()?'No items have reached the central hub yet.':'No activity yet. Returns submitted from the store will appear here.'}</p>`;return}
  if(!sel||!R.find(r=>r.returnId===sel))sel=(R.find(r=>!s[r.returnId])||R[0]).returnId;
  $('#actList').innerHTML=R.map(r=>{
    const meta=statusMeta(s[r.returnId]),active=r.returnId===sel?'active':'',origin=resolveArea(r.pincode);
    return `<button class="queue-row ${active}" data-sel="${esc(r.returnId)}">
      <span class="qr-dot ${meta.cls}"></span>
      <span class="qr-main"><span class="qr-product">${esc(r.product)}</span>
      <span class="qr-meta">${isCentral()?esc(origin.name)+' &middot; ':''}${esc(r.season)} &middot; ${when(r)}</span></span>
      <span class="qr-status ${meta.cls}">${meta.label}</span>
    </button>`;
  }).join('');
}

function renderDetail(){
  const R=activityList();
  if(!R.length){
    $('#detail').innerHTML=`<div class="detail-placeholder"><p>${isCentral()?'Select an item at the hub to view its routing history.':'Select a product from the warehouse activity to view its decision analysis.'}</p></div>
    <section class="panel"><p class="panel-title">${isCentral()?'Hub inventory by season':'Stock by season'}</p>${isCentral()?hubBySeasonBars():seasonBars(loc)}</section>`;
    return;
  }
  const r=R.find(x=>x.returnId===sel),s=st(),rec=recommend(r),done=s[sel],meta=statusMeta(done);
  const badgeClass=rec.c.cls==='Defect'?'badge-defect':'badge-dissatisfaction';
  let html=`<div class="detail-header">
    <div><p class="detail-eyebrow">RETURN ${esc(r.returnId.toUpperCase())}</p><h2>${esc(r.product)}</h2>
    <p class="detail-sub">${esc(rec.origin.name)} (${esc(rec.origin.climate_zone)}) &middot; ${esc(r.season[0].toUpperCase()+r.season.slice(1))} &middot; received ${when(r)}</p></div>
    <span class="status-badge ${meta.cls}">${meta.label}</span>
  </div>`;
  html+=`<section class="panel"><p class="panel-title">Customer review</p><p class="review-text">&ldquo;${esc(r.reasonText)}&rdquo;</p></section>`;
  html+=`<section class="panel"><p class="panel-title">Classification</p><span class="badge ${badgeClass}">${esc(rec.c.cls)}</span></section>`;
  html+=`<section class="panel"><p class="panel-title">Why this decision?</p>${rec.steps.map((t,i)=>`<div class="step"><i>${i+1}</i><span>${esc(t)}</span></div>`).join('')}</section>`;
  let actions='';
  if(!isCentral()&&!done)actions=`<div class="dact"><button class="btn p1" data-ap="${esc(sel)}">Approve</button><button class="btn" data-ov="${esc(sel)}">Override</button></div>`;
  else if(!isCentral()&&done.dest==='repair'&&!done.repaired)actions=`<div class="dact"><button class="btn p1" data-fix="${esc(sel)}">Mark repaired</button></div>`;
  html+=`<section class="panel"><div class="decision-banner ${done?done.dest:rec.dest}">
    <p class="route-label">${done?'Placed: '+LABEL[done.dest]:'Recommended: '+LABEL[rec.dest]}</p>
    ${actions}
  </div></section>`;
  if(!isCentral())html+=`<section class="panel"><p class="panel-title">Stock by season</p>${seasonBars(loc)}</section>`;
  $('#detail').innerHTML=html;
}

function invRows(){
  if(isCentral()){
    let L=rets().filter(r=>{const x=st()[r.returnId];return x&&x.dest==='far'}).map(r=>{const o=resolveArea(r.pincode);return {sku:r.returnId,name:r.product,season:r.season,cat:'Returned (from '+o.name+')',origin:o.name,price:'',qty:1}});
    const q=invQ.toLowerCase();
    L=L.filter(p=>(invS==='all'||p.season===invS)&&(!q||(p.name+p.sku+p.cat).toLowerCase().includes(q)));
    return {n:L.length,html:L.map(p=>`<tr><td>${esc(p.sku)}</td><td>${esc(p.name)}</td><td>${esc(p.origin)}</td><td>${esc(p.season)}</td><td>${esc(p.cat)}</td><td>${inr(p.price)}</td><td>1</td><td><span class="t s">At hub</span></td></tr>`).join('')||'<tr><td colspan="8" class="empty-cell">No items at the hub match.</td></tr>'};
  }
  let L=stockList(loc).map(p=>Object.assign({},p,{origin:AREA_BY_CODE[loc].name}));
  retsFor(loc).filter(r=>{const x=st()[r.returnId];return x&&x.dest==='local'}).forEach(r=>L.push({sku:r.returnId,name:r.product,season:r.season,cat:'Returned (open-box)',origin:AREA_BY_CODE[loc].name,qty:1,price:'',ret:true}));
  const q=invQ.toLowerCase();
  L=L.filter(p=>(invS==='all'||(invS==='ret'?p.ret:p.season===invS))&&(!q||(p.name+p.sku+p.cat).toLowerCase().includes(q))&&(!invLow||(!p.ret&&p.qty<=LOW)));
  const status=p=>p.ret?['Open-box','s']:p.qty===0?['Out of stock','bad']:p.qty<=LOW?['Low','wn']:['In stock','ok'];
  return {n:L.length,html:L.map(p=>{const t=status(p);return `<tr><td>${esc(p.sku)}</td><td>${esc(p.name)}</td><td>${esc(p.origin)}</td><td>${esc(p.season)}</td><td>${esc(p.cat)}</td><td>${inr(p.price)}</td>
   <td>${p.ret?'1':`<span class="qb"><button data-adj="${p.sku}|-1" aria-label="Decrease">-</button>${p.qty}<button data-adj="${p.sku}|1" aria-label="Increase">+</button></span>`}</td>
   <td><span class="t ${t[1]}">${t[0]}</span></td></tr>`}).join('')||'<tr><td colspan="8" class="empty-cell">No products match.</td></tr>'};
}
function renderInventory(){
  $('#invTitle').textContent=isCentral()?'Inventory at the central hub':'Inventory in this warehouse';
  $('#invS').querySelectorAll('option[value=ret]').forEach(o=>o.remove());
  if(!isCentral()){
    const opt=document.createElement('option');opt.value='ret';opt.textContent='Returned items';
    $('#invS').appendChild(opt);
  }
  $('#invLow').closest('label').hidden=isCentral();
  $('#invS').value=invS;
  const r=invRows();
  $('#invBody').innerHTML=r.html;
}

function render(){renderKpi();renderActivity();renderDetail();if(view==='inv')renderInventory()}

document.addEventListener('click',e=>{
  const t=e.target.closest('button,[data-sel]')||e.target,d=t.dataset||{};
  if(d.close!==undefined){t.closest('dialog').close()}
  else if(d.v){view=d.v;document.querySelectorAll('#viewTabs button').forEach(b=>b.classList.toggle('on',b.dataset.v===view));$('#actView').hidden=view!=='act';$('#invView').hidden=view!=='inv';if(view==='inv')renderInventory()}
  else if(d.sel){sel=d.sel;renderDetail();renderActivity()}
  else if(d.ap){apply(d.ap,recommend(rets().find(r=>r.returnId===d.ap)).dest,'Approved')}
  else if(d.ov){ovId=d.ov;$('#ovTitle').textContent='Override '+d.ov;$('#ovDlg').showModal()}
  else if(d.fix){
    const s=st(),full=localUsed(loc)>=cfg().cap;
    s[d.fix]={dest:full?'far':'local',repaired:true,at:new Date().toISOString()};save('warehub_admin',s);
    toast(full?'Repaired, but local warehouse is full. Sent to central hub.':'Repaired and added to local inventory.');render();
  }
  else if(d.adj){
    const [sku,n]=d.adj.split('|'),ov=load('warehub_stock_'+loc,{}),p=stockList(loc).find(x=>x.sku===sku);
    ov[sku]=Math.max(0,p.qty+ +n);save('warehub_stock_'+loc,ov);renderKpi();renderInventory();
  }
});
document.addEventListener('input',e=>{if(e.target.id==='invQ'){invQ=e.target.value;renderInventory()}});
document.addEventListener('change',e=>{
  if(e.target.id==='invS'){invS=e.target.value;renderInventory()}
  if(e.target.id==='invLow'){invLow=e.target.checked;renderInventory()}
});
$('#ovForm').onsubmit=e=>{e.preventDefault();apply(ovId,new FormData(e.target).get('d'),'Overridden');$('#ovDlg').close()};
$('#ovCancel').onclick=()=>$('#ovDlg').close();
window.addEventListener('storage',render);

// ---- Dark mode ----
function setTheme(m){document.documentElement.dataset.theme=m;localStorage.setItem('warehub_theme',m);$('#themeBtn').textContent=m==='dark'?'Light mode':'Dark mode'}
$('#themeBtn').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
setTheme(localStorage.getItem('warehub_theme')||'light');

initLocationPicker();
render();

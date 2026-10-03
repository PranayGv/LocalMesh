const $=s=>document.querySelector(s);
const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))||d}catch(e){return d}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// The review text decides: a fault word means defect, otherwise personal dissatisfaction.
const DEFECT=/(stopp|broke|snap|crack|damag|defect|faulty|not work|doesn.t work|dead|leak|torn|tear|burn|short.?circuit|malfunction|stuck|rust)/i;
const mSeason=m=>m>=2&&m<=5?'summer':m>=6&&m<=10?'monsoon':'winter';
const NOW=mSeason(new Date().getMonth());
const FIT={summer:true,monsoon:true,winter:false}; // Does the local climate suit this season's items?
const LABEL={repair:'Local repair',local:'Local warehouse',far:'Far warehouse'};
const COLOR={summer:'#e0a800',monsoon:'#3a9aa8',winter:'#7b6bd6'};
const LOW=15; // units at or below this count as low stock

// Local warehouse stock list: name, category, units in stock, price
const RAW={
summer:[['Tower Air Cooler 40L','Appliances',24,6499],['Desert Air Cooler 70L','Appliances',12,9499],['Table Fan 400 mm','Appliances',46,1499],['Pedestal Fan 500 mm','Appliances',28,2799],['Portable Neck Fan','Accessories',60,899],['Polarised Sunglasses','Accessories',85,799],['SPF 50 Sunscreen 100 ml','Personal care',120,349],['Aloe Vera Cooling Gel','Personal care',70,199],['Insulated Steel Bottle 1 L','Home',55,599],['Cotton Summer Shirt','Apparel',64,699],['Linen Shorts','Apparel',48,549],['Wide-brim Sun Hat','Accessories',40,399],['Cooling Towel','Accessories',75,249],['Ice Gel Pack Set','Home',30,349],['Electrolyte Drink Mix (20)','Food',90,399],['UV Protection Arm Sleeves','Apparel',58,299]],
monsoon:[['Auto-open Umbrella','Accessories',70,449],['Compact Folding Umbrella','Accessories',52,349],['Rain Jacket and Pants Set','Apparel',38,899],['Poncho Raincoat','Apparel',66,399],['Waterproof Gumboots','Footwear',32,749],['Anti-slip Rain Sandals','Footwear',44,649],['Waterproof Dry Bag 20 L','Bags',50,549],['Waterproof Backpack Cover','Bags',80,249],['Waterproof Phone Pouch','Accessories',110,199],['Quick-dry Microfibre Towel','Home',90,299],['Folding Clothes Drying Stand','Home',26,1299],['Mosquito Repellent Liquid','Personal care',100,149],['Dehumidifier Bags (6)','Home',62,299],['Car Windshield Rain Repellent','Auto',36,349],['Waterproof Boot Spray','Footwear',42,399],['Water Absorbent Door Mat','Home',54,349]],
winter:[['Wool Blend Sweater','Apparel',34,1299],['Hooded Fleece Jacket','Apparel',22,1799],['Room Heater 2000 W','Appliances',18,1899],['Oil-filled Radiator 9 Fin','Appliances',9,6999],['Storage Water Heater 15 L','Appliances',14,5999],['Instant Water Geyser 3 L','Appliances',20,2999],['Thermal Gloves','Accessories',88,299],['Woollen Cap','Accessories',72,249],['Wool Muffler','Accessories',60,399],['Thermal Innerwear Set','Apparel',46,799],['Fleece Blanket','Home',40,999],['Electric Blanket','Appliances',11,2499],['Wool Socks (3 pairs)','Apparel',96,349],['Moisturising Body Lotion 400 ml','Personal care',130,299],['Lip Balm Pack (3)','Personal care',140,199],['Hot Water Bag','Home',48,399]]
};
const STOCK=[];
Object.keys(RAW).forEach(s=>RAW[s].forEach((a,i)=>{const n=String(i+1).padStart(2,'0');STOCK.push({sku:s.slice(0,3).toUpperCase()+'-'+n,name:a[0],season:s,cat:a[1],qty:a[2],price:a[3],bin:{summer:'A',monsoon:'B',winter:'C'}[s]+'-'+n})}));

let tab='queue',sel=null,ovId=null,invQ='',invS='all',invLow=false;
const cfg=()=>Object.assign({cap:3500},load('warehub_cfg',{}));
const rets=()=>load('seasonmart_returns',[]).slice().reverse();
const st=()=>load('warehub_admin',{});
const stockList=()=>{const ov=load('warehub_stock',{});return STOCK.map(p=>Object.assign({},p,{qty:p.sku in ov?ov[p.sku]:p.qty}))};
const stockTotal=()=>stockList().reduce((a,p)=>a+p.qty,0);
const localUsed=()=>stockTotal()+Object.values(st()).filter(x=>x.dest==='local').length;
const toast=t=>{const e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2500)};
const when=r=>new Date(r.at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const inr=n=>n===''?'-':'\u20B9'+n.toLocaleString('en-IN');

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
function logAct(type,text){const L=load('warehub_log',[]);L.unshift({t:new Date().toISOString(),type,text});save('warehub_log',L.slice(0,100))}
function apply(id,dest,how){const s=st();s[id]={dest,at:new Date().toISOString()};save('warehub_admin',s);logAct(how==='Overridden'?'override':'approve',(how||'Approved')+' '+id+': '+LABEL[dest]);toast('Return '+id+' sent to: '+LABEL[dest]);render()}

function renderKpi(){
  const R=rets(),s=st(),cf=cfg(),used=localUsed(),pct=Math.round(used/cf.cap*100);
  const today=R.filter(r=>new Date(r.at).toDateString()===new Date().toDateString()).length;
  const pend=R.filter(r=>!s[r.returnId]).length;
  const rep=Object.values(s).filter(x=>x.dest==='repair'&&!x.repaired).length;
  const far=Object.values(s).filter(x=>x.dest==='far').length;
  const low=stockList().filter(p=>p.qty<=LOW).length;
  $('#kp').innerHTML=`<div class="k"><small>New returns today</small><b>${today}</b></div>
  <div class="k"><small>Awaiting decision</small><b>${pend}</b></div>
  <div class="k"><small>In repair</small><b>${rep}</b></div>
  <div class="k"><small>Sent to far warehouse</small><b>${far}</b></div>
  <div class="k"><small>Low stock products</small><b>${low}</b></div>
  <div class="k"><small>Capacity used (${used.toLocaleString('en-IN')}/${cf.cap.toLocaleString('en-IN')})</small><b>${pct}%</b><div class="bar"><i style="width:${Math.min(pct,100)}%;background:${pct>=90?'#c0392b':'#e8710a'}"></i></div></div>`;
}

function seasonBars(){
  const s=st(),cnt={summer:0,monsoon:0,winter:0};
  stockList().forEach(p=>cnt[p.season]+=p.qty);
  load('seasonmart_returns',[]).forEach(r=>{const x=s[r.returnId];if(x&&x.dest==='local'&&cnt[r.season]!==undefined)cnt[r.season]++});
  const mx=Math.max(...Object.values(cnt),1);
  return Object.keys(cnt).map(k=>`<div class="row"><span>${k[0].toUpperCase()+k.slice(1)}</span><div class="b"><i style="width:${cnt[k]/mx*100}%;background:${COLOR[k]}"></i></div><b>${cnt[k]}</b></div>`).join('');
}

function viewQueue(){
  const R=rets(),s=st();
  if(!R.length)return '<div class="p"><p class="empty">No returns yet. Submit one from the store, or open Settings and click "Add demo returns".</p></div>';
  if(!sel||!R.find(r=>r.returnId===sel))sel=(R.find(r=>!s[r.returnId])||R[0]).returnId;
  const r0=R.find(r=>r.returnId===sel),rec=recommend(r0),done=s[sel];
  const rows=R.map(r=>{const c=classify(r),x=s[r.returnId];return `<tr data-sel="${esc(r.returnId)}" class="${r.returnId===sel?'sel':''}">
   <td>${esc(r.returnId)}</td><td>${esc(r.product)}</td><td>${esc(r.reasonText)}</td>
   <td><span class="t ${c.cls==='Defect'?'d':'s'}">${c.cls}</span></td>
   <td>${x?'<span class="btn done">Done</span>':`<button class="btn p1" data-ap="${esc(r.returnId)}">Approve</button><button class="btn" data-ov="${esc(r.returnId)}">Override</button>`}</td></tr>`}).join('');
  return `<div class="g"><div class="p"><h4>Returns queue</h4><div class="sc"><table>
   <tr><th>Return</th><th>Product</th><th>Customer reason</th><th>Class</th><th></th></tr>${rows}</table></div></div>
   <div class="p"><h4>Why this decision? (${esc(sel)})</h4>
   ${rec.steps.map((t,i)=>`<div class="step"><i>${i+1}</i><span>${esc(t)}</span></div>`).join('')}
   <div class="rec">${done?'Placed: '+LABEL[done.dest]:'Recommended: '+LABEL[rec.dest]}</div>
   <div class="cap"><b>Units in stock by season</b>${seasonBars()}</div></div></div>`;
}

function invRows(){
  const s=st();
  let L=stockList();
  load('seasonmart_returns',[]).filter(r=>s[r.returnId]&&s[r.returnId].dest==='local').forEach(r=>L.push({sku:r.returnId,name:r.product,season:r.season,cat:'Returned (open-box)',qty:1,price:'',bin:'R-'+String(r.returnId).slice(-4),ret:true}));
  const q=invQ.toLowerCase();
  L=L.filter(p=>(invS==='all'||(invS==='ret'?p.ret:p.season===invS))&&(!q||(p.name+p.sku+p.cat).toLowerCase().includes(q))&&(!invLow||(!p.ret&&p.qty<=LOW)));
  const status=p=>p.ret?['Open-box','s']:p.qty===0?['Out of stock','bad']:p.qty<=LOW?['Low','wn']:['In stock','ok'];
  return {n:L.length,html:L.map(p=>{const t=status(p);return `<tr><td>${esc(p.sku)}</td><td>${esc(p.name)}</td><td>${esc(p.season)}</td><td>${esc(p.cat)}</td><td>${esc(p.bin)}</td><td>${inr(p.price)}</td>
   <td>${p.ret?'1':`<span class="qb"><button data-adj="${p.sku}|-1" aria-label="Decrease">-</button>${p.qty}<button data-adj="${p.sku}|1" aria-label="Increase">+</button></span>`}</td>
   <td><span class="t ${t[1]}">${t[0]}</span></td></tr>`}).join('')||'<tr><td colspan="8" class="empty">No products match.</td></tr>'};
}
function viewInv(){
  const r=invRows(),cf=cfg();
  return `<div class="g"><div class="p"><h4>Local warehouse inventory <span id="invCount">(${r.n})</span></h4>
   <div class="flt"><input type="search" id="invQ" placeholder="Search product, SKU or category" value="${esc(invQ)}">
   <select id="invS" aria-label="Filter"><option value="all">All seasons</option>${['summer','monsoon','winter'].map(k=>`<option value="${k}" ${invS===k?'selected':''}>${k[0].toUpperCase()+k.slice(1)}</option>`).join('')}<option value="ret" ${invS==='ret'?'selected':''}>Returned items</option></select>
   <label><input type="checkbox" id="invLow" ${invLow?'checked':''}> Low stock only</label></div>
   <div class="sc tall"><table><thead><tr><th>SKU</th><th>Product</th><th>Season</th><th>Category</th><th>Bin</th><th>Price</th><th>In stock</th><th>Status</th></tr></thead><tbody id="invBody">${r.html}</tbody></table></div></div>
   <div class="p"><h4>Units in stock by season</h4>${seasonBars()}
   <div class="cap">Total: <b>${localUsed().toLocaleString('en-IN')}</b> of ${cf.cap.toLocaleString('en-IN')} units across ${STOCK.length} products.</div></div></div>`;
}
function invUpdate(){const r=invRows();$('#invBody').innerHTML=r.html;$('#invCount').textContent='('+r.n+')'}

function listView(title,filter,extra){
  const R=rets(),s=st(),L=R.filter(r=>s[r.returnId]&&filter(s[r.returnId]));
  return `<div class="p"><h4>${title} (${L.length})</h4>${L.length?`<div class="sc"><table><tr><th>Return</th><th>Product</th><th>Season</th><th>Customer reason</th><th>Date</th><th></th></tr>
   ${L.map(r=>`<tr><td>${esc(r.returnId)}</td><td>${esc(r.product)}</td><td>${esc(r.season)}</td><td>${esc(r.reasonText)}</td><td>${when(s[r.returnId])}</td><td>${extra(r)}</td></tr>`).join('')}</table></div>`:'<p class="empty">Nothing here yet.</p>'}</div>`;
}
function viewSet(){
  const c=cfg();
  return `<div class="p set"><h4>Warehouse settings</h4>
   <label>Capacity (units)</label><input id="sCap" type="number" min="1" value="${c.cap}">
   <div class="acts"><button class="btn p1" data-act="save">Save settings</button><button class="btn" data-act="fill">Fill to near capacity (demo)</button><button class="btn" data-act="resetstock">Reset stock counts</button></div>
   <div class="acts"><button class="btn" data-act="demo">Add demo returns</button><button class="btn" data-act="clear">Clear all returns and decisions</button></div></div>`;
}

function render(){
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===tab));
  renderKpi();
  $('#view').innerHTML=tab==='queue'?viewQueue():tab==='inv'?viewInv()
   :tab==='rep'?listView('Items in repair',x=>x.dest==='repair'&&!x.repaired,r=>`<button class="btn p1" data-fix="${esc(r.returnId)}">Mark repaired</button>`)
   :tab==='tr'?listView('Sent to far warehouse',x=>x.dest==='far',()=>'Central hub'):viewSet();
}

document.addEventListener('click',e=>{
  const t=e.target.closest('button,tr')||e.target,d=t.dataset||{};
  if(d.close!==undefined){t.closest('dialog').close()}
  else if(d.t){tab=d.t;render()}
  else if(d.ap){apply(d.ap,recommend(rets().find(r=>r.returnId===d.ap)).dest,'Approved')}
  else if(d.ov){ovId=d.ov;$('#ovTitle').textContent='Override '+d.ov;$('#ovDlg').showModal()}
  else if(d.adj){
    const [sku,n]=d.adj.split('|'),ov=load('warehub_stock',{}),p=stockList().find(x=>x.sku===sku);
    ov[sku]=Math.max(0,p.qty+ +n);save('warehub_stock',ov);logAct('stock',p.name+': '+p.qty+' to '+ov[sku]+' units');render();
  }
  else if(d.fix){
    const s=st(),full=localUsed()>=cfg().cap;
    s[d.fix]={dest:full?'far':'local',repaired:true,at:new Date().toISOString()};save('warehub_admin',s);logAct('repair','Repaired '+d.fix+(full?' (sent to far warehouse)':' (added to local inventory)'));
    toast(full?'Repaired, but local warehouse is full. Sent to far warehouse.':'Repaired and added to local inventory.');render();
  }
  else if(d.sel){sel=d.sel;render()}
  else if(d.act==='save'){save('warehub_cfg',{cap:+$('#sCap').value||3500});toast('Settings saved.');render()}
  else if(d.act==='fill'){save('warehub_cfg',{cap:localUsed()+3});toast('Capacity set to '+(localUsed()+3)+' units. Three more local returns will fill it.');render()}
  else if(d.act==='resetstock'){localStorage.removeItem('warehub_stock');toast('Stock counts reset.');render()}
  else if(d.act==='demo'){
    const R=load('seasonmart_returns',[]),now=Date.now();
    [['R1023','Anti-slip Rain Sandals','monsoon','Strap broke on first use',2200],
     ['R1024','Cotton Summer Shirt','summer','Changed my mind about the style',1800],
     ['R1025','Insulated Steel Bottle 1 L','summer','Dent on the side, arrived damaged',1500],
     ['R1026','Oil-filled Radiator 9 Fin','winter','Burning smell when switched on',1200],
     ['R1027','Quick-dry Microfibre Towel','monsoon','Not as soft as I expected',900],
     ['R1028','Waterproof Phone Pouch','monsoon','Zip is stuck and will not close',700],
     ['R1029','Wide-brim Sun Hat','summer','Does not fit well',540],
     ['R1030','Portable Neck Fan','summer','Battery dead after two charges',420],
     ['R1031','Fleece Blanket','winter','Colour is different from the photo',330],
     ['R1032','Storage Water Heater 15 L','winter','Not heating at all, seems faulty',260],
     ['R1033','Thermal Gloves','winter','Too small for my hands',200],
     ['R1034','Waterproof Gumboots','monsoon','Sole is torn at the edge',150],
     ['R1035','Table Fan 400 mm','summer','Too noisy, I do not like it',120],
     ['R1036','Polarised Sunglasses','summer','Lens cracked on arrival',90],
     ['R1037','Tower Air Cooler 40L','summer','Water leaks from the tank',70],
     ['R1038','Waterproof Dry Bag 20 L','monsoon','Wrong size',55],
     ['R1039','Room Heater 2000 W','winter','Stopped working after a week',40],
     ['R1040','Rain Jacket and Pants Set','monsoon','Changed my mind',25],
     ['R1041','Wool Blend Sweater','winter','Does not suit Chennai weather',15],
     ['R1042','Auto-open Umbrella','monsoon','Handle snapped on day two',5]]
     .forEach(a=>{if(!R.find(r=>r.returnId===a[0]))R.push({returnId:a[0],product:a[1],season:a[2],category:'',reasonText:a[3],pincode:'600001',at:new Date(now-a[4]*60000).toISOString()})});
    R.sort((a,b)=>new Date(a.at)-new Date(b.at));
    save('seasonmart_returns',R);toast('Demo returns added.');render();
  }
  else if(d.act==='clear'){if(confirm('Delete all returns and decisions?')){localStorage.removeItem('seasonmart_returns');localStorage.removeItem('warehub_admin');sel=null;render()}}
});
document.addEventListener('input',e=>{if(e.target.id==='invQ'){invQ=e.target.value;invUpdate()}});
document.addEventListener('change',e=>{
  if(e.target.id==='invS'){invS=e.target.value;invUpdate()}
  if(e.target.id==='invLow'){invLow=e.target.checked;invUpdate()}
});
$('#ovForm').onsubmit=e=>{e.preventDefault();apply(ovId,new FormData(e.target).get('d'),'Overridden');$('#ovDlg').close()};
$('#ovCancel').onclick=()=>$('#ovDlg').close();
window.addEventListener('storage',render);

// ---- Dark mode ----
function setTheme(m){document.documentElement.dataset.theme=m;localStorage.setItem('warehub_theme',m);$('#themeBtn').textContent=m==='dark'?'Light mode':'Dark mode'}
$('#themeBtn').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
setTheme(localStorage.getItem('warehub_theme')||'light');

// ---- Admin profile ----
const prof=()=>Object.assign({name:'Karthik',role:'Warehouse manager',wh:'Chennai Local Warehouse',shift:'Morning (6 am to 2 pm)'},load('warehub_profile',{}));
function showProfile(){
  const p=prof();
  $('#admName').textContent=p.name;$('#whName').textContent=p.wh+' Administration';
  $('#admAv').textContent=p.name.trim()[0].toUpperCase();
  $('#admTitle').textContent=p.name;$('#admSub').textContent=p.role+', '+p.shift;
}
function openAdmin(){
  const p=prof();
  $('#aName').value=p.name;$('#aRole').value=p.role;$('#aWh').value=p.wh;$('#aShift').value=p.shift;
  showProfile();
  const L=load('warehub_log',[]),td=new Date().toDateString(),today=L.filter(x=>new Date(x.t).toDateString()===td);
  const n=k=>today.filter(x=>x.type===k).length;
  $('#aStats').innerHTML=[['Approved',n('approve')],['Overridden',n('override')],['Repaired',n('repair')],['Stock changes',n('stock')]].map(a=>`<div><b>${a[1]}</b><small>${a[0]}</small></div>`).join('');
  $('#aLog').innerHTML=L.length?L.slice(0,8).map(x=>`<li><span>${esc(x.text)}</span><small>${new Date(x.t).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</small></li>`).join(''):'<li class="empty">No activity yet. Approve a return to see it here.</li>';
  $('#admDlg').showModal();
}
$('#admBtn').onclick=openAdmin;
$('#admForm').onsubmit=e=>{e.preventDefault();save('warehub_profile',{name:$('#aName').value.trim()||'Admin',role:$('#aRole').value,wh:$('#aWh').value.trim()||'Local Warehouse',shift:$('#aShift').value});showProfile();toast('Profile saved.')};
$('#aClr').onclick=()=>{localStorage.removeItem('warehub_log');$('#admDlg').close();toast('Activity log cleared.')};
$('#aCsv').onclick=()=>{
  const s=st(),rows=[['Return ID','Product','Season','Customer reason','Class','Destination','Decided at']];
  load('seasonmart_returns',[]).forEach(r=>{const x=s[r.returnId];rows.push([r.returnId,r.product,r.season,r.reasonText,classify(r).cls,x?LABEL[x.dest]:'Pending',x?x.at:''])});
  const csv=rows.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='warehub-returns-report.csv';a.click();URL.revokeObjectURL(a.href);
};
showProfile();
render();
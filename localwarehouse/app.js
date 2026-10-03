/*
 * WareHub — per-warehouse view onto LocalMesh's real returns data.
 *
 * This is a thin client: it has no classification or routing logic of its
 * own. Every number and decision shown here was already computed by the
 * LocalMesh backend (backend/decision.py) when the return was submitted —
 * this page just fetches /api/meta and /api/returns and filters/renders
 * that real data for whichever warehouse is selected. Local-shop sourcing
 * requests ("Search local shops" on the storefront) are a separate concept
 * fulfilled by outside partner shops, not LocalMesh's own warehouses, so
 * they're out of scope here (they live in the main LocalMesh admin panel).
 */
const $=s=>document.querySelector(s);
const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))||d}catch(e){return d}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=t=>{const e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2500)};
const when=iso=>new Date(iso).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});

let warehouses=[],returns=[],tab='queue',sel=null;
let selectedCode=load('warehub_selected_warehouse',null);

/* ---------------------------------------------------------------------- */
/* Data: fetched from the real LocalMesh API, not a local preset list     */
/* ---------------------------------------------------------------------- */

async function fetchMeta(){
  const res=await fetch('/api/meta');
  const data=await res.json();
  warehouses=data.warehouses;
  if(!selectedCode||!warehouses.find(w=>w.code===selectedCode))selectedCode=warehouses[0]?.code||null;
  renderWarehouseSelect();
}
async function fetchReturns(){
  const res=await fetch('/api/returns');
  returns=await res.json();
}
function renderWarehouseSelect(){
  const el=$('#whSelect');
  el.innerHTML=warehouses.map(w=>`<option value="${esc(w.code)}" ${w.code===selectedCode?'selected':''}>${esc(w.name)} — ${esc(w.area_name)}</option>`).join('');
}
const currentWarehouse=()=>warehouses.find(w=>w.code===selectedCode);
// Returns actually routed/repaired to the selected warehouse — the only
// returns that carry a warehouse_code at all are routed_local and
// defect_repaired (central-hub routes never reach a specific warehouse).
const atThisWarehouse=()=>returns.filter(r=>r.warehouse_code===selectedCode);
function sameCityReturns(statuses){
  const wh=currentWarehouse();
  if(!wh)return [];
  return returns.filter(r=>r.area_code===wh.area_code&&statuses.includes(r.status));
}

/* ---------------------------------------------------------------------- */
/* KPI strip                                                              */
/* ---------------------------------------------------------------------- */

function renderKpi(){
  const wh=currentWarehouse();
  if(!wh){$('#kp').innerHTML='';return}
  const atWh=atThisWarehouse();
  const today=atWh.filter(r=>new Date(r.submitted_at).toDateString()===new Date().toDateString()).length;
  const local=atWh.filter(r=>r.status==='routed_local').length;
  const repaired=atWh.filter(r=>r.status==='defect_repaired').length;
  const hub=sameCityReturns(['routed_hub']).length;
  $('#kp').innerHTML=`<div class="k"><small>Items at this warehouse</small><b>${atWh.length}</b></div>
  <div class="k"><small>Arrived today</small><b>${today}</b></div>
  <div class="k"><small>Routed returns</small><b>${local}</b></div>
  <div class="k"><small>Repaired defects</small><b>${repaired}</b></div>
  <div class="k"><small>Sent to central hub (this city)</small><b>${hub}</b></div>`;
}

/* ---------------------------------------------------------------------- */
/* Returns queue — real decisions, with the full "why" fetched per item    */
/* ---------------------------------------------------------------------- */

function viewQueue(){
  const L=atThisWarehouse();
  if(!L.length)return '<div class="p"><p class="empty">No returns routed to this warehouse yet. Submit a return for a matching city on the storefront, or pick a different warehouse above.</p></div>';
  if(!sel||!L.find(r=>r.id===sel))sel=L[0].id;
  const rows=L.map(r=>`<tr data-sel="${esc(r.id)}" class="${r.id===sel?'sel':''}">
   <td>${esc(r.id)}</td><td>${esc(r.product)}</td><td>${esc(r.area_name)}</td>
   <td><span class="t ${r.status==='defect_repaired'?'d':'s'}">${esc(r.status_label)}</span></td>
   <td>${when(r.submitted_at)}</td></tr>`).join('');
  return `<div class="g"><div class="p"><h4>Returns at this warehouse</h4><div class="sc"><table>
   <tr><th>Return</th><th>Product</th><th>From</th><th>Status</th><th>Received</th></tr>${rows}</table></div></div>
   <div class="p" id="qDetailPanel"><p class="empty">Loading…</p></div></div>`;
}

async function loadQueueDetail(id){
  const panel=$('#qDetailPanel');
  if(!panel||!id)return;
  try{
    const res=await fetch(`/api/returns/${id}`);
    if(!res.ok)throw new Error('not found');
    const r=await res.json();
    panel.innerHTML=renderDetailPanel(r);
  }catch(e){
    panel.innerHTML='<p class="empty">Could not load this return.</p>';
  }
}

function renderDetailPanel(r){
  const isDefect=r.classification.label==='hardware_defect';
  const badge=`<span class="t ${isDefect?'d':'s'}">${isDefect?'Hardware Defect':'Personal Dissatisfaction'}</span> <small>${Math.round(r.classification.confidence*100)}% confidence</small>`;
  let steps='';
  if(r.defect_branch){
    const d=r.defect_branch;
    steps=`<div class="step"><i>1</i><span>${esc(d.resolution_reason)}</span></div>
     <div class="step"><i>2</i><span>${esc(d.repair_reason)}</span></div>`;
  }else if(r.dissatisfaction_branch){
    const b=r.dissatisfaction_branch;
    steps=`<div class="step"><i>1</i><span>${esc(b.demand.reason)}</span></div>
     <div class="step"><i>2</i><span>${esc(b.climate.reason)}</span></div>
     <div class="step"><i>3</i><span>${esc(b.decision.reason)}</span></div>`;
  }
  return `<h4>Why this decision? (${esc(r.id)})</h4>
   <p>${badge}</p>
   <p style="font-style:italic;color:var(--mute);margin:.5rem 0">&ldquo;${esc(r.review_text)}&rdquo;</p>
   ${steps}
   <div class="rec">${esc(r.status_label)}</div>`;
}

/* ---------------------------------------------------------------------- */
/* Local stock — real units physically at this warehouse                  */
/* ---------------------------------------------------------------------- */

function viewInv(){
  const L=atThisWarehouse();
  if(!L.length)return `<div class="p"><h4>Local stock at this warehouse <span>(0)</span></h4><p class="empty">Nothing in local stock yet for this warehouse.</p></div>`;
  const rows=L.map(r=>{
    const how=r.status==='defect_repaired'?'Repaired defect':'Returned (open-box)';
    return `<tr><td>${esc(r.id)}</td><td>${esc(r.product)}</td><td>${esc(r.area_name)}</td><td>${esc(r.area_climate_zone)}</td><td>${esc(how)}</td><td>${when(r.submitted_at)}</td></tr>`;
  }).join('');
  return `<div class="p"><h4>Local stock at this warehouse <span>(${L.length})</span></h4>
   <div class="sc tall"><table><thead><tr><th>Return</th><th>Product</th><th>From</th><th>Climate</th><th>How it arrived</th><th>Received</th></tr></thead>
   <tbody>${rows}</tbody></table></div></div>`;
}

/* ---------------------------------------------------------------------- */
/* Repairs — defect returns handled by this city's local repair shop      */
/* ---------------------------------------------------------------------- */

function viewRep(){
  const L=sameCityReturns(['defect_repaired','defect_hub']);
  if(!L.length)return '<div class="p"><h4>Repairs handled by this city\'s repair shop <span>(0)</span></h4><p class="empty">No defect repairs for this city yet.</p></div>';
  const rows=L.map(r=>`<tr><td>${esc(r.id)}</td><td>${esc(r.product)}</td>
   <td><span class="t ${r.status==='defect_repaired'?'ok':'bad'}">${r.status==='defect_repaired'?'Repaired — restocked here':'Repair failed — sent to central'}</span></td>
   <td>${when(r.submitted_at)}</td></tr>`).join('');
  return `<div class="p"><h4>Repairs handled by this city's repair shop <span>(${L.length})</span></h4>
   <div class="sc"><table><tr><th>Return</th><th>Product</th><th>Outcome</th><th>Date</th></tr>${rows}</table></div></div>`;
}

/* ---------------------------------------------------------------------- */
/* Sent to central hub — same-city returns that didn't stay local         */
/* ---------------------------------------------------------------------- */

function viewTr(){
  const L=sameCityReturns(['routed_hub']);
  if(!L.length)return '<div class="p"><h4>Sent to central hub from this city <span>(0)</span></h4><p class="empty">Nothing sent to the central hub from this city yet.</p></div>';
  const rows=L.map(r=>`<tr><td>${esc(r.id)}</td><td>${esc(r.product)}</td><td>${when(r.submitted_at)}</td></tr>`).join('');
  return `<div class="p"><h4>Sent to central hub from this city <span>(${L.length})</span></h4>
   <div class="sc"><table><tr><th>Return</th><th>Product</th><th>Date</th></tr>${rows}</table></div></div>`;
}

/* ---------------------------------------------------------------------- */
/* Settings — warehouse details + operator profile entry point            */
/* ---------------------------------------------------------------------- */

function viewSet(){
  const wh=currentWarehouse();
  if(!wh)return '<div class="p"><p class="empty">Select a warehouse above to see its details.</p></div>';
  return `<div class="p set"><h4>Warehouse details</h4>
   <div class="pi-row"><span>Name</span><b>${esc(wh.name)}</b></div>
   <div class="pi-row"><span>Code</span><b>${esc(wh.code)}</b></div>
   <div class="pi-row"><span>City</span><b>${esc(wh.area_name)}</b></div>
   <div class="acts"><button class="btn p1" id="setAdmBtn">Edit operator profile</button></div></div>`;
}

/* ---------------------------------------------------------------------- */
/* Render + events                                                        */
/* ---------------------------------------------------------------------- */

function render(){
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===tab));
  renderKpi();
  $('#view').innerHTML=tab==='queue'?viewQueue():tab==='inv'?viewInv():tab==='rep'?viewRep():tab==='tr'?viewTr():viewSet();
  if(tab==='queue')loadQueueDetail(sel);
}

document.addEventListener('click',e=>{
  const t=e.target.closest('button,tr')||e.target,d=t.dataset||{};
  if(d.close!==undefined){t.closest('dialog').close()}
  else if(d.t){tab=d.t;render()}
  else if(d.sel){sel=d.sel;render()}
  else if(t.id==='setAdmBtn'){openAdmin()}
});
$('#whSelect').addEventListener('change',e=>{
  selectedCode=e.target.value;
  save('warehub_selected_warehouse',selectedCode);
  sel=null;
  showProfile();
  render();
});

/* ---------------------------------------------------------------------- */
/* Dark mode                                                              */
/* ---------------------------------------------------------------------- */

function setTheme(m){document.documentElement.dataset.theme=m;localStorage.setItem('warehub_theme',m);$('#themeBtn').textContent=m==='dark'?'Light mode':'Dark mode'}
$('#themeBtn').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
setTheme(localStorage.getItem('warehub_theme')||'light');

/* ---------------------------------------------------------------------- */
/* Admin profile — operator preferences + a real, this-warehouse CSV      */
/* ---------------------------------------------------------------------- */

const prof=()=>Object.assign({name:'Admin',role:'Warehouse manager',shift:'Morning (6 am to 2 pm)'},load('warehub_profile',{}));
function showProfile(){
  const p=prof();
  $('#admName').textContent=p.name;
  $('#admAv').textContent=p.name.trim()[0].toUpperCase();
  $('#admTitle').textContent=p.name;
  $('#admSub').textContent=p.role+', '+p.shift;
}
function openAdmin(){
  const p=prof(),wh=currentWarehouse();
  $('#aName').value=p.name;$('#aRole').value=p.role;$('#aShift').value=p.shift;
  $('#aWh').value=wh?wh.name+' — '+wh.area_name:'—';
  showProfile();
  const atWh=atThisWarehouse();
  const today=atWh.filter(r=>new Date(r.submitted_at).toDateString()===new Date().toDateString()).length;
  const repaired=atWh.filter(r=>r.status==='defect_repaired').length;
  const local=atWh.filter(r=>r.status==='routed_local').length;
  $('#aStats').innerHTML=[['Total here',atWh.length],['Today',today],['Repaired',repaired],['Routed returns',local]]
   .map(a=>`<div><b>${a[1]}</b><small>${a[0]}</small></div>`).join('');
  $('#admDlg').showModal();
}
$('#admBtn').onclick=openAdmin;
$('#admForm').onsubmit=e=>{
  e.preventDefault();
  save('warehub_profile',{name:$('#aName').value.trim()||'Admin',role:$('#aRole').value,shift:$('#aShift').value});
  showProfile();toast('Profile saved.');
};
$('#aCsv').onclick=()=>{
  const wh=currentWarehouse(),L=atThisWarehouse();
  const rows=[['Return ID','Product','From city','Climate zone','Status','Received at']];
  L.forEach(r=>rows.push([r.id,r.product,r.area_name,r.area_climate_zone,r.status_label,r.submitted_at]));
  const csv=rows.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download=(wh?wh.code:'warehouse')+'-report.csv';
  a.click();URL.revokeObjectURL(a.href);
};

/* ---------------------------------------------------------------------- */
/* Init + polling                                                         */
/* ---------------------------------------------------------------------- */

async function init(){
  await fetchMeta();
  await fetchReturns();
  showProfile();
  render();
  setInterval(async()=>{await fetchReturns();render()},4000);
}
init();

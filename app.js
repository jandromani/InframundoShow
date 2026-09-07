const RAW='https://raw.githubusercontent.com/jandromani/InframundoShow/master/data/live.json';
const $=s=>document.querySelector(s);
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,Number(v)||0));
const deep=x=>JSON.parse(JSON.stringify(x));

const NAMES={ESP:'Spain',MAR:'Morocco',DZA:'Algeria',USA:'United States',IRN:'Iran',CHN:'China',TWN:'Taiwan',RUS:'Russia',UKR:'Ukraine',PRK:'North Korea',KOR:'South Korea',PHL:'Philippines',IND:'India',PAK:'Pakistan',SRB:'Serbia',BIH:'Bosnia & Herzegovina',COD:'DR Congo',RWA:'Rwanda',ISR:'Israel',VEN:'Venezuela',GUY:'Guyana'};
const FLAGS={ESP:'🇪🇸',MAR:'🇲🇦',DZA:'🇩🇿',USA:'🇺🇸',IRN:'🇮🇷',CHN:'🇨🇳',TWN:'🇹🇼',RUS:'🇷🇺',UKR:'🇺🇦',PRK:'🇰🇵',KOR:'🇰🇷',PHL:'🇵🇭',IND:'🇮🇳',PAK:'🇵🇰',SRB:'🇷🇸',BIH:'🇧🇦',COD:'🇨🇩',RWA:'🇷🇼',ISR:'🇮🇱',VEN:'🇻🇪',GUY:'🇬🇾'};
const COORD={ESP:[-3.7,40.3],MAR:[-6.2,31.8],DZA:[2.6,28.0],USA:[-98,39],IRN:[53,32],CHN:[104,35],TWN:[121,23.7],RUS:[90,58],UKR:[31,49],PRK:[127,40],KOR:[128,36],PHL:[122,12.5],IND:[79,22],PAK:[69,30],SRB:[20.8,44],BIH:[17.8,44.2],COD:[23.6,-2.9],RWA:[29.9,-1.9],ISR:[35,31.5],VEN:[-66,7],GUY:[-59,5]};
const ALIASES={Spain:'ESP',Morocco:'MAR',Algeria:'DZA','United States of America':'USA','United States':'USA',Iran:'IRN',China:'CHN',Taiwan:'TWN',Russia:'RUS',Ukraine:'UKR','North Korea':'PRK','Dem. Rep. Korea':'PRK','South Korea':'KOR','Republic of Korea':'KOR',Philippines:'PHL',India:'IND',Pakistan:'PAK',Serbia:'SRB','Bosnia and Herz.':'BIH','Bosnia and Herzegovina':'BIH','Dem. Rep. Congo':'COD','Democratic Republic of the Congo':'COD',Rwanda:'RWA',Israel:'ISR',Venezuela:'VEN',Guyana:'GUY'};
const CHOKES=[
  ['Hormuz',[56.25,26.55],97],['Suez',[32.35,30.5],72],['Bab el-Mandeb',[43.35,12.6],84],['Malacca',[102.3,2.6],66],['Gibraltar',[-5.6,35.95],51],['Panama',[-79.7,9.1],49]
];

let live=null,world=null,selected=null,sim=null,mode='live',player='ESP';
let d3,topo,projection,path,svg,g,landG,edgeG,chokeG,labelG,countryPaths,zoom;
const layers={tensions:true,chokes:true,labels:true};

async function fetchState(){
  const urls=[RAW+'?t='+Date.now(),'./data/live.json?t='+Date.now()];
  for(const url of urls){
    try{const r=await fetch(url,{cache:'no-store'});if(r.ok)return await r.json()}catch{}
  }
  throw new Error('Unable to load world state');
}

function scoreColor(v){if(v>=90)return '#ff6f7d';if(v>=78)return '#ffad5a';if(v>=65)return '#ffd166';if(v>=50)return '#b79cff';return '#365361'}
function pairById(id){return (world?.pairs||[]).find(p=>p.id===id)}
function frontsFor(code){return (world?.pairs||[]).filter(p=>p.a===code||p.b===code).sort((a,b)=>b.score-a.score)}
function maxForCountry(code){return Math.max(0,...frontsFor(code).map(p=>p.score))}
function fmtTime(x){try{return new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeStyle:'short'}).format(new Date(x))}catch{return x||'—'}}

function setMode(next){
  mode=next;
  document.body.classList.toggle('sim',mode==='sim');
  $('#liveBtn').classList.toggle('active',mode==='live');
  $('#simBtn').classList.toggle('active',mode==='sim');
  if(mode==='sim'){
    sim=deep(live); world=sim; player='ESP';
    sim.sim_date=(live.updated_at||new Date().toISOString()).slice(0,10);
    sim.sim_log=[`Fork created from LIVE snapshot. You control ${NAMES[player]}.`];
  } else {world=live;sim=null}
  if(!selected||!pairById(selected.id))selected=(world.pairs||[]).slice().sort((a,b)=>b.score-a.score)[0]||null;
  render();
}

function renderKpis(){
  const x=world?.global||{};
  $('#riskKpi').textContent=Math.round(x.risk||0)+'/100';
  $('#shipKpi').textContent=Math.round(x.shipping_stress||0)+'/100';
  $('#energyKpi').textContent=Math.round(x.energy_stress||0)+'/100';
  $('#tradeKpi').textContent=Math.round(x.trade_stress||0)+'/100';
  $('#memoryKpi').textContent=(world?.history||[]).length+' snapshots';
  $('#updatedChip').textContent=(mode==='live'?'LIVE ':'FORK ')+fmtTime(world?.updated_at||world?.sim_date);
  $('#modeText').textContent=mode==='live'?'LIVE WORLD':`SIM · ${FLAGS[player]} ${NAMES[player]}`;
}

function renderFront(){
  if(!selected){$('#frontTitle').textContent='No front selected';return}
  const p=pairById(selected.id)||selected; selected=p;
  $('#frontTitle').textContent=`${FLAGS[p.a]||''} ${NAMES[p.a]||p.a} ↔ ${FLAGS[p.b]||''} ${NAMES[p.b]||p.b}`;
  $('#frontScore').textContent=Math.round(p.score);
  const tr=Number(p.trend||0);const te=$('#frontTrend');te.className='small trend '+(tr>0?'up':tr<0?'down':'');te.textContent=`${tr>0?'▲ +':tr<0?'▼ ': '→ '}${tr} · ${p.scan_articles??'—'} scanned signals`;
  $('#frontSummary').textContent=p.summary||'No summary available.';
  $('#frontDomains').innerHTML=(p.domain||[]).map(x=>`<span>${escapeHtml(x)}</span>`).join('');
  $('#botMoves').innerHTML=(p.bot_moves||[]).map(x=>`<div>⚙ ${escapeHtml(x)}</div>`).join('')||'<div>No bot move recorded yet.</div>';
  $('#news').innerHTML=(p.news||[]).slice(0,6).map(n=>`<a href="${safeUrl(n.url)}" target="_blank" rel="noopener"><b>${escapeHtml(n.title||'Source')}</b><br><span>${escapeHtml(n.source||'')} · ${escapeHtml(String(n.seen||'').slice(0,10))}</span></a>`).join('')||'<div>No new article attached in this scan.</div>';
  renderActions(p);
}

function renderRanking(){
  const rows=(world?.pairs||[]).slice().sort((a,b)=>b.score-a.score);
  $('#ranking').innerHTML=rows.map((p,i)=>`<div class="rankrow" data-id="${p.id}"><b>#${i+1}</b><div><div>${FLAGS[p.a]||''} ${NAMES[p.a]||p.a} ↔ ${FLAGS[p.b]||''} ${NAMES[p.b]||p.b}</div><div class="rankbar"><i style="width:${clamp(p.score)}%"></i></div></div><b style="color:${scoreColor(p.score)}">${Math.round(p.score)}</b></div>`).join('');
  document.querySelectorAll('.rankrow').forEach(el=>el.addEventListener('click',()=>{selected=pairById(el.dataset.id);renderFront();renderMap()}));
}

function renderGear(){
  const gw=world?.gearwatch||{};$('#gearHeadline').textContent=gw.headline||'GearWatch connected';
  $('#gear').innerHTML=(gw.mechanisms||[]).slice(0,6).map(m=>`<div class="gearitem"><b>${escapeHtml(m.label||m.id)}</b><div>${escapeHtml(m.state||'')} · causal ${Math.round(m.score||0)}/100 ${Number(m.delta)>0?'· ▲ '+m.delta:''}</div></div>`).join('')||'<div>Waiting for GearWatch bridge scan.</div>';
}

function renderActions(p){
  if(mode!=='sim')return;
  const other=p.a===player?p.b:p.a;
  const involved=p.a===player||p.b===player;
  const holder=involved?`as ${NAMES[player]}`:`${NAMES[player]} is not party to this front`;
  const acts=involved?[
    {id:'talks',name:'Open de-escalation channel',desc:`Reduce ${NAMES[other]} tension; spend influence.`},
    {id:'pressure',name:'Economic / diplomatic pressure',desc:'Raise bilateral pressure, lower trade resilience.'},
    {id:'readiness',name:'Military readiness',desc:'Increase deterrence but risk escalation.'}
  ]:[{id:'mediate',name:'Offer mediation',desc:'Attempt to lower this third-party tension using influence.'}];
  $('#actions').innerHTML=`<div class="small muted">Acting ${escapeHtml(holder)}. Click a country on the map to change player.</div>`+acts.map(a=>`<button class="action" data-act="${a.id}"><b>${a.name}</b><div class="small muted">${a.desc}</div></button>`).join('');
  document.querySelectorAll('.action[data-act]').forEach(b=>b.addEventListener('click',()=>applyAction(p.id,b.dataset.act)));
}

function applyAction(id,act){
  if(mode!=='sim')return;const p=pairById(id);if(!p)return;
  let delta=0,txt='';
  if(act==='talks'){delta=-9;txt=`${NAMES[player]} opens a de-escalation channel on ${id}.`}
  if(act==='pressure'){delta=6;world.global.trade_stress=clamp(world.global.trade_stress+2);txt=`${NAMES[player]} applies economic and diplomatic pressure on ${id}.`}
  if(act==='readiness'){delta=10;world.global.risk=clamp(world.global.risk+3);txt=`${NAMES[player]} raises military readiness on ${id}.`}
  if(act==='mediate'){delta=-4;txt=`${NAMES[player]} offers mediation on ${id}.`}
  p.score=clamp(p.score+delta);p.trend=delta;world.sim_log.unshift(txt);render();
}

function seededRandom(seed){let x=seed>>>0;return()=>{x=(x*1664525+1013904223)>>>0;return x/4294967296}}
function resolveWeek(){
  if(mode!=='sim')return;
  const d=new Date(sim.sim_date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+7);sim.sim_date=d.toISOString().slice(0,10);
  const rnd=seededRandom(Number(sim.sim_date.replaceAll('-','')));
  for(const p of sim.pairs){
    const base=(rnd()-.46)*7;
    const hot=p.score>90?-1.5:0;
    const inertia=Number(p.trend||0)*.12;
    const delta=Math.round(base+hot+inertia);
    p.score=clamp(p.score+delta);p.trend=delta;
  }
  const hot=sim.pairs.slice().sort((a,b)=>b.score-a.score)[0];
  sim.global.risk=Math.round(clamp(sim.pairs.reduce((s,p)=>s+p.score,0)/sim.pairs.length*.55+hot.score*.45));
  sim.global.shipping_stress=Math.round(clamp((pairById('USA-IRN')?.score||50)*.7+(pairById('CHN-PHL')?.score||50)*.3));
  sim.global.energy_stress=Math.round(clamp((pairById('USA-IRN')?.score||50)*.7+(pairById('RUS-UKR')?.score||50)*.3));
  sim.global.trade_stress=Math.round(clamp((pairById('CHN-TWN')?.score||50)*.45+(pairById('USA-IRN')?.score||50)*.35+15));
  sim.sim_log.unshift(`Bots resolve week ending ${sim.sim_date}. Highest risk: ${hot.id} ${Math.round(hot.score)}/100.`);
  selected=pairById(selected?.id)||hot;render();
}

function renderSim(){if(mode!=='sim')return;$('#simDate').textContent=sim.sim_date;$('#simLog').innerHTML=(sim.sim_log||[]).slice(0,12).map(x=>`<div>${escapeHtml(x)}</div>`).join('')}
function render(){renderKpis();renderFront();renderRanking();renderGear();renderSim();renderMap()}

function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function safeUrl(u){try{const x=new URL(u);return /^https?:$/.test(x.protocol)?x.href:'#'}catch{return '#'}}

async function initMap(){
  try{
    [d3,topo,{default:worldAtlas}]=await Promise.all([
      import('https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm'),
      import('https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/+esm'),
      import('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json/+esm')
    ]);
    const features=topo.feature(worldAtlas,worldAtlas.objects.countries).features;
    projection=d3.geoNaturalEarth1().fitExtent([[12,12],[1188,668]],{type:'Sphere'});path=d3.geoPath(projection);
    svg=d3.select('#worldMap');svg.selectAll('*').remove();svg.append('path').datum({type:'Sphere'}).attr('d',path).attr('fill','#061018').attr('stroke','#20313c');
    g=svg.append('g');landG=g.append('g');edgeG=g.append('g');chokeG=g.append('g');labelG=g.append('g');
    countryPaths=landG.selectAll('path').data(features).join('path').attr('d',path).attr('class','country').on('click',(ev,d)=>{
      const code=ALIASES[d.properties?.name];if(!code)return;
      const fronts=frontsFor(code);if(fronts[0]){selected=fronts[0];if(mode==='sim'){player=code;sim.sim_log.unshift(`You take control of ${NAMES[code]}.`)}render()}
    });
    zoom=d3.zoom().scaleExtent([1,9]).on('zoom',ev=>g.attr('transform',ev.transform));svg.call(zoom);
    $('#zoomIn').onclick=()=>svg.transition().duration(180).call(zoom.scaleBy,1.45);
    $('#zoomOut').onclick=()=>svg.transition().duration(180).call(zoom.scaleBy,.69);
    $('#zoomReset').onclick=()=>svg.transition().duration(180).call(zoom.transform,d3.zoomIdentity);
    renderMap();
  }catch(err){console.error(err);$('#worldMap').replaceWith(Object.assign(document.createElement('div'),{className:'muted',textContent:'Map engine failed to load; rankings and simulation remain available.'}))}
}

function renderMap(){
  if(!countryPaths||!world)return;
  countryPaths.attr('fill',d=>{const c=ALIASES[d.properties?.name];if(!c)return'#0d1a22';const v=maxForCountry(c);return v?scoreColor(v):'#172731'}).attr('opacity',d=>ALIASES[d.properties?.name]?1:.72).attr('stroke-width',d=>ALIASES[d.properties?.name]===player&&mode==='sim'?2.2:.55).attr('stroke',d=>ALIASES[d.properties?.name]===player&&mode==='sim'?'#65dcff':'#243945');
  const pairs=layers.tensions?(world.pairs||[]):[];
  edgeG.selectAll('path').data(pairs,d=>d.id).join('path').attr('class','edge').attr('d',d=>path({type:'LineString',coordinates:[COORD[d.a],COORD[d.b]]})).attr('stroke',d=>scoreColor(d.score)).attr('stroke-width',d=>1.2+d.score/28).attr('stroke-dasharray',d=>d.score<65?'5 5':null).on('click',(ev,d)=>{ev.stopPropagation();selected=d;renderFront();renderRanking();renderMap()});
  const ch=layers.chokes?CHOKES:[];
  const cg=chokeG.selectAll('g').data(ch,d=>d[0]).join(enter=>{const q=enter.append('g');q.append('rect').attr('x',-4).attr('y',-4).attr('width',8).attr('height',8).attr('transform','rotate(45)').attr('class','choke');q.append('text').attr('x',8).attr('y',3).attr('class','label');return q},update=>update,exit=>exit.remove()).attr('transform',d=>{const p=projection(d[1]);return`translate(${p[0]},${p[1]})`});cg.select('text').text(d=>`${d[0]} ${d[2]}`);
  const hot=layers.labels?(world.pairs||[]).filter(p=>p.score>=78):[];
  labelG.selectAll('text').data(hot,d=>d.id).join('text').attr('class','label').attr('text-anchor','middle').attr('x',d=>{const a=projection(COORD[d.a]),b=projection(COORD[d.b]);return(a[0]+b[0])/2}).attr('y',d=>{const a=projection(COORD[d.a]),b=projection(COORD[d.b]);return(a[1]+b[1])/2-6}).text(d=>`${d.id} ${Math.round(d.score)}`);
}

$('#liveBtn').addEventListener('click',()=>setMode('live'));
$('#simBtn').addEventListener('click',()=>setMode('sim'));
$('#nextTurn').addEventListener('click',resolveWeek);
$('#refreshBtn').addEventListener('click',async()=>{try{live=await fetchState();if(mode==='live')world=live;render()}catch(e){console.error(e)}});
document.querySelectorAll('.layer').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.layer;layers[k]=!layers[k];b.classList.toggle('active',layers[k]);renderMap()}));

async function main(){
  live=await fetchState();world=live;selected=(world.pairs||[]).slice().sort((a,b)=>b.score-a.score)[0]||null;render();await initMap();
  setInterval(async()=>{if(mode!=='live')return;try{const next=await fetchState();if(next.updated_at!==live.updated_at){live=next;world=live;selected=pairById(selected?.id)||selected;render()}}catch{}},300000);
}
main().catch(err=>{console.error(err);document.body.insertAdjacentHTML('beforeend','<div style="padding:20px;color:#ff9ca5">WORLD//STATE could not load its state.</div>')});

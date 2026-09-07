const RAW='https://raw.githubusercontent.com/jandromani/InframundoShow/master/data/live.json';
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,Number(v)||0));const deep=x=>JSON.parse(JSON.stringify(x));
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const ALIASES={Spain:'ESP',Morocco:'MAR',Algeria:'DZA','United States of America':'USA','United States':'USA',Iran:'IRN',Israel:'ISR',China:'CHN',Taiwan:'TWN',Russia:'RUS',Ukraine:'UKR','North Korea':'PRK','Dem. Rep. Korea':'PRK','South Korea':'KOR','Republic of Korea':'KOR',Philippines:'PHL',India:'IND',Pakistan:'PAK',Serbia:'SRB','Bosnia and Herz.':'BIH','Bosnia and Herzegovina':'BIH','Dem. Rep. Congo':'COD','Democratic Republic of the Congo':'COD',Rwanda:'RWA',Venezuela:'VEN',Guyana:'GUY',Greece:'GRC',Turkey:'TUR','Türkiye':'TUR',Armenia:'ARM',Azerbaijan:'AZE',Ethiopia:'ETH',Eritrea:'ERI',Japan:'JPN','Saudi Arabia':'SAU',Egypt:'EGY',Germany:'DEU',France:'FRA',Italy:'ITA',Portugal:'PRT',Brazil:'BRA'};
const DIM_LABELS={score:'overall',diplomatic:'diplomatic',military:'military',territorial:'territorial',trade:'trade',energy:'energy',domestic:'domestic',information:'information'};
const DIM_LABELS_VECTOR={diplomatic:'diplomatic',military:'military',territorial:'territorial',trade:'trade',energy:'energy',domestic:'domestic',information:'information'};
const REST_LABELS={economic_interdependence:'economic dependence',alliance_mediation:'alliance / mediation',security_cooperation:'security cooperation',deterrence:'deterrence'};
const COLORS={score:'#ff5265',diplomatic:'#be7cff',military:'#ff5265',territorial:'#ff9c43',trade:'#2fe6a3',energy:'#ffd35d',domestic:'#3e9cff',information:'#39d7ff'};
const ROUTES=[
 {id:'atlantic-lng',name:'Atlantic LNG → Iberia',kind:'energy',subtype:'LNG shipping',points:[[-76,36],[-55,38],[-35,40],[-12,43],[-3.8,43.4]],countries:['USA','ESP'],gates:[],base:'open'},
 {id:'gulf-europe',name:'Gulf → Europe energy corridor',kind:'energy',subtype:'Oil / LNG shipping',points:[[52,26],[56.3,26.6],[61,20],[52,13],[43.4,12.6],[37,18],[33,29],[32.3,30.4],[23,34],[8,37],[-5.6,35.9],[-3.5,40]],countries:['IRN','ESP'],gates:['HORMUZ','BAB','SUEZ','GIBRALTAR'],base:'contested'},
 {id:'east-asia-europe',name:'East Asia → Europe maritime corridor',kind:'maritime',subtype:'Container / manufactured goods',points:[[121,31],[112,20],[104,3],[99,4],[83,8],[65,12],[43.4,12.6],[32.3,30.4],[12,37],[-5.6,35.9],[-8,43]],countries:['CHN','ESP','TUR'],gates:['MALACCA','BAB','SUEZ','GIBRALTAR'],base:'open'},
 {id:'west-africa-eu',name:'West Africa → Iberia LNG',kind:'energy',subtype:'LNG shipping',points:[[3,6],[-5,12],[-14,20],[-12,30],[-9,36],[-5.6,35.9],[-3.6,40]],countries:['ESP','MAR'],gates:['GIBRALTAR'],base:'open'},
 {id:'medgaz',name:'Medgaz',kind:'pipeline',subtype:'Gas pipeline',points:[[3.1,36.7],[1,36.2],[-2.5,36.8]],countries:['DZA','ESP'],gates:[],base:'open'},
 {id:'maghreb-europe',name:'Maghreb–Europe Gas Pipeline',kind:'pipeline',subtype:'Gas pipeline',points:[[2.5,33],[-1,34],[-5,34.5],[-5.6,35.9],[-4.5,37.3]],countries:['DZA','MAR','ESP'],gates:['GIBRALTAR'],base:'contested'},
 {id:'turkstream',name:'TurkStream',kind:'pipeline',subtype:'Gas pipeline',points:[[37,44],[31,42],[29,41],[26,42]],countries:['RUS','TUR'],gates:[],base:'open'},
 {id:'btc',name:'Baku–Tbilisi–Ceyhan',kind:'pipeline',subtype:'Oil pipeline',points:[[50,40.4],[45,41.7],[40,40],[35.9,36.8]],countries:['AZE','TUR'],gates:[],base:'open'},
 {id:'marea',name:'MAREA cable',kind:'cable',subtype:'Submarine data cable',points:[[-75.9,36.9],[-50,38],[-30,40],[-12,43],[-3.0,43.35]],countries:['USA','ESP'],gates:[],base:'open'},
 {id:'ellalink',name:'EllaLink',kind:'cable',subtype:'Submarine data cable',points:[[-9.1,38.7],[-18,28],[-25,12],[-31,-2],[-38.5,-3.7]],countries:['PRT','BRA','ESP'],gates:[],base:'open'},
 {id:'europe-asia-cable',name:'Europe–Asia data corridor',kind:'cable',subtype:'Submarine data cable',points:[[-3,43],[10,38],[25,34],[32.3,30.4],[43.4,12.6],[75,8],[101,3],[121,22]],countries:['ESP','CHN'],gates:['SUEZ','BAB','MALACCA'],base:'contested'},
 {id:'cape-reroute',name:'Cape of Good Hope reroute',kind:'maritime',subtype:'Strategic bypass',points:[[55,24],[65,10],[55,-10],[35,-35],[15,-35],[-5,-20],[-15,5],[-12,25],[-5.6,35.9]],countries:['ESP','USA','CHN'],gates:['GIBRALTAR'],base:'open'}
];
const NODES=[
 {id:'algeciras',name:'Port of Algeciras',type:'port',coord:[-5.44,36.13],country:'ESP'},
 {id:'tangermed',name:'Tanger Med',type:'port',coord:[-5.5,35.89],country:'MAR'},
 {id:'bilbao',name:'Bilbao / cable landing',type:'cable',coord:[-3.0,43.35],country:'ESP'},
 {id:'cartagena',name:'Cartagena LNG',type:'energy',coord:[-0.98,37.6],country:'ESP'},
 {id:'hassi',name:"Hassi R'Mel gas hub",type:'energy',coord:[3.27,32.94],country:'DZA'},
 {id:'fujairah',name:'Fujairah energy hub',type:'energy',coord:[56.33,25.13],country:'ARE'},
 {id:'suez-port',name:'Suez',type:'port',coord:[32.55,29.97],country:'EGY'},
 {id:'singapore',name:'Singapore',type:'port',coord:[103.8,1.25],country:'SGP'},
 {id:'shanghai',name:'Shanghai',type:'port',coord:[121.5,31.2],country:'CHN'},
 {id:'rotterdam',name:'Rotterdam',type:'port',coord:[4.48,51.92],country:'NLD'},
 {id:'virginia',name:'Virginia Beach cable landing',type:'cable',coord:[-75.98,36.85],country:'USA'}
];
const GATE_LABELS={HORMUZ:'Strait of Hormuz',SUEZ:'Suez Canal',BAB:'Bab el-Mandeb',MALACCA:'Strait of Malacca',GIBRALTAR:'Strait of Gibraltar'};
let live=null,world=null,mode='live',selectedId=null,player='ESP',focusCountry='ESP',layer='score',sim=null,highlightPairs=[],selectedRoute=null;
let mapLayers={tensions:true,tradeRoutes:true,energyRoutes:true,maritime:true,pipelines:true,cables:true,elections:true,dependencies:true};
let d3,topo,projection,path,svg,g,landG,depG,routeG,edgeG,chokeG,infraG,electionG,shipG,labelG,countryPaths,zoom;

async function fetchState(){for(const url of [RAW+'?t='+Date.now(),'./data/live.json?t='+Date.now()]){try{const r=await fetch(url,{cache:'no-store'});if(r.ok)return await r.json()}catch{}}throw new Error('Unable to load world state')}
const C=code=>world?.countries?.[code]||live?.countries?.[code]||{name:code,flag:'',coord:[0,0],economy_live:50,stability_live:50};
const pair=id=>(world?.pairs||[]).find(p=>p.id===id);
const fronts=code=>(world?.pairs||[]).filter(p=>p.a===code||p.b===code).sort((a,b)=>b.score-a.score);
const pairBetween=(a,b)=>(world?.pairs||[]).find(p=>(p.a===a&&p.b===b)||(p.a===b&&p.b===a));
const val=p=>layer==='score'?p.score:(p.vector?.[layer]??p.score);
const scoreColor=v=>v>=90?'#ff5265':v>=78?'#ff9c43':v>=65?'#ffd35d':v>=50?'#be7cff':'#173a48';
const fmt=x=>{try{return new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeStyle:'short'}).format(new Date(x))}catch{return x||'—'}};
const safeUrl=u=>{try{const x=new URL(u);return /^https?:$/.test(x.protocol)?x.href:'#'}catch{return '#'}};

function relationOverall(p){const w={diplomatic:.17,military:.23,territorial:.18,trade:.10,energy:.09,domestic:.11,information:.07};let raw=Object.entries(w).reduce((s,[k,x])=>s+clamp(p.vector?.[k])*x,0)+(Number(p.gearwatch_pressure)||0)*.16;const r=Object.values(p.restraints||{}).map(Number).filter(Number.isFinite);if(r.length)raw-=r.reduce((a,b)=>a+b,0)/r.length*.055;return Math.round(clamp(raw))}
function ensureSelected(){if(!selectedId||!pair(selectedId))selectedId=(world?.pairs||[]).slice().sort((a,b)=>b.score-a.score)[0]?.id||null}
function dominantDimension(p){return Object.entries(p?.vector||{}).sort((a,b)=>b[1]-a[1])[0]?.[0]||'diplomatic'}
function statusClass(x){return x==='open'?'open':x==='blocked'?'blocked':'contested'}
function findChoke(gate){return (world?.chokepoints||[]).find(c=>String(c.id||c.name).toUpperCase().includes(gate)||String(c.name).toUpperCase().includes(GATE_LABELS[gate]?.toUpperCase().replace('STRAIT OF ','')||gate))}
function routeGlobalStatus(route){
  let status=route.base||'open';
  const scores=(route.gates||[]).map(findChoke).filter(Boolean).map(x=>Number(x.score)||0);
  const max=scores.length?Math.max(...scores):0;
  if(max>=94)status='blocked';else if(max>=70&&status!=='blocked')status='contested';
  if(route.id==='maghreb-europe'&&(pairBetween('MAR','DZA')?.score||0)>=65)status='contested';
  return status;
}
function routeAccess(route,code=focusCountry){
  let status=routeGlobalStatus(route),reason=status==='open'?'Strategic corridor operating normally in the model.':status==='contested'?'Route faces elevated geopolitical or chokepoint pressure.':'Route is severely constrained by current modeled pressure.';
  if((route.gates||[]).includes('HORMUZ')){
    const usIran=pairBetween('USA','IRN')?.score||0;
    if(code==='USA'&&usIran>=75){status='blocked';reason='Country-specific access model: U.S.–Iran confrontation makes Hormuz unavailable for U.S.-linked traffic.'}
    else if(code==='ESP'&&status==='blocked'){status='contested';reason='Spain has no direct modeled belligerent restriction, but global Hormuz stress still constrains access.'}
    else if(code==='ESP'){status='open';reason='Country-specific access model: Spain retains passage while U.S.-linked traffic faces higher restriction.'}
  }
  if((route.gates||[]).includes('GIBRALTAR')&&(code==='ESP'||code==='MAR')){
    const em=pairBetween('ESP','MAR')?.score||0;
    if(em>=85){status=status==='blocked'?'blocked':'contested';reason='Spain–Morocco pressure raises local routing and insurance friction around Gibraltar.'}
  }
  if(route.id==='maghreb-europe'&&(code==='MAR'||code==='DZA'||code==='ESP')){
    const md=pairBetween('MAR','DZA')?.score||0;if(md>=65){status='contested';reason='Maghreb rivalry materially constrains this modeled pipeline corridor.'}
  }
  return {status,reason};
}
function routeVisible(r){if(r.kind==='cable')return mapLayers.cables;if(r.kind==='pipeline')return mapLayers.pipelines;if(r.kind==='energy')return mapLayers.energyRoutes;if(r.kind==='maritime')return mapLayers.maritime||mapLayers.tradeRoutes;return true}

function renderKpis(){
 const x=world?.global||{};
 const vals={riskKpi:x.risk,shipKpi:x.shipping_stress,energyKpi:x.energy_stress,tradeKpi:x.trade_stress,politicalKpi:x.political_stress};
 Object.entries(vals).forEach(([id,v])=>{const e=$('#'+id);if(e)e.textContent=Math.round(v||0)+'%';const bar=e?.parentElement?.querySelector('i');if(bar)bar.style.setProperty('--value',clamp(v||0)+'%')});
 $('#memoryKpi').textContent=(world?.history||[]).length;
 $('#updatedChip').textContent=(mode==='live'?'LIVE ':'FORK ')+fmt(world?.updated_at||sim?.sim_date);
 $('#modeText').textContent=mode==='live'?'LIVE WORLD':`FORK · ${C(player).flag} ${C(player).name}`;
 const brains=Object.keys(world?.country_brains||{}).length;$('#aiActing').textContent=`AI NATIONS ACTING ${brains||Object.keys(world?.countries||{}).length}`;
 $('#simClock').textContent=mode==='live'?'autonomous live loop':'weekly branch simulation';
}
function bars(obj,labels){return Object.entries(labels).map(([k,label])=>{const v=Math.round(obj?.[k]||0);return`<div class="vector"><div class="vectorhead"><span>${esc(label)}</span><b>${v}</b></div><div class="track"><div class="fill" style="width:${clamp(v)}%"></div></div></div>`}).join('')}
function renderFront(){
 ensureSelected();const p=pair(selectedId);if(!p)return;const a=C(p.a),b=C(p.b);
 $('#frontTitle').textContent=`${a.flag} ${a.name} ↔ ${b.flag} ${b.name}`;$('#frontScore').textContent=Math.round(p.score);$('#frontScore').style.color=scoreColor(p.score);
 const tr=Number(p.trend||0);$('#frontTrend').className='small trend '+(tr>0?'up':tr<0?'down':'');$('#frontTrend').textContent=`${tr>0?'▲ +':tr<0?'▼ ':'→ '}${tr} · ${p.scan_articles||0} fresh signals · GW ${Math.round(p.gearwatch_pressure||0)}`;
 $('#frontSummary').textContent=p.summary||'No summary.';$('#frontDomains').innerHTML=(p.domains||p.domain||[]).map(x=>`<span>${esc(x)}</span>`).join('');
 $('#vectors').innerHTML=bars(p.vector,DIM_LABELS_VECTOR);$('#restraints').innerHTML=bars(p.restraints,REST_LABELS);
 $('#drivers').innerHTML=(p.drivers||[]).map(x=>`<div class="driver">${esc(x)}</div>`).join('');
 $('#botMoves').innerHTML=(p.bot_moves||[]).map(x=>`<div>⚙ ${esc(x)}</div>`).join('')||'<div>No strategic move stored.</div>';
 $('#news').innerHTML=(p.news||[]).slice(0,7).map(n=>`<a href="${safeUrl(n.url)}" target="_blank" rel="noopener"><b>${esc(n.title)}</b><br><span>${esc(n.source||'')} · ${esc(String(n.seen||'').slice(0,10))}</span></a>`).join('')||'<div>No fresh article attached.</div>';
 $('#pairGear').innerHTML=(p.gearwatch_impacts||[]).map(x=>`<span class="pill">⚙ ${esc(x.label)} ${Math.round(x.score)}</span>`).join('')||'<span class="small muted">No direct GearWatch mechanism mapped.</span>';
 renderActions(p);
}
function renderRanking(){const rows=(world?.pairs||[]).slice().sort((a,b)=>val(b)-val(a)).slice(0,18);$('#ranking').innerHTML=rows.map((p,i)=>`<div class="rankrow" data-id="${p.id}"><b>#${i+1}</b><div><div>${C(p.a).flag} ${esc(C(p.a).name)} ↔ ${C(p.b).flag} ${esc(C(p.b).name)}</div><div class="rankbar"><i style="width:${clamp(val(p))}%"></i></div></div><b style="color:${scoreColor(val(p))}">${Math.round(val(p))}</b></div>`).join('');$$('.rankrow').forEach(el=>el.onclick=()=>{selectedId=el.dataset.id;const p=pair(selectedId);if(p)focusCountry=p.a;highlightPairs=[];render()})}
function postureClass(p=''){p=String(p).toLowerCase();if(/crisis|assert|deter|escal/.test(p))return'escalate';if(/hedge|opportun|rerout/.test(p))return'hedge';return'cooperate'}
function renderAgentRoster(){
 const brains=world?.country_brains||{};let rows=Object.entries(world?.countries||{}).filter(([code,c])=>brains[code]||c.fronts).sort((a,b)=>(b[1].max_front||0)-(a[1].max_front||0));
 const q=($('#agentSearch')?.value||'').toLowerCase().trim();if(q)rows=rows.filter(([code,c])=>(c.name+' '+code).toLowerCase().includes(q));
 rows=rows.slice(0,36);
 $('#agentRoster').innerHTML=rows.map(([code,c])=>{const brain=brains[code]||{};const posture=brain.posture||((c.max_front||0)>80?'DETER':(c.energy_dependency_risk||0)>25?'HEDGE':'BALANCED');const pc=postureClass(posture);return`<div class="agent-row ${code===focusCountry?'active':''}" data-code="${code}"><div class="agent-flag">${c.flag||'◌'}</div><div><div class="agent-name">${esc(c.name||code)}</div><div class="agent-meta">AI controlled · fronts ${c.fronts||0}</div><div class="microbars"><span class="microbar"><i style="width:${clamp(c.economy_live||c.economy||50)}%"></i></span><span class="microbar"><i style="width:${clamp(c.military||50)}%"></i></span><span class="microbar"><i style="width:${clamp(c.stability_live||c.stability||50)}%"></i></span></div></div><div class="agent-action ${pc}">${esc(posture.replaceAll('_',' '))}</div></div>`}).join('');
 $$('.agent-row').forEach(el=>el.onclick=()=>selectCountry(el.dataset.code));
}
function selectedBrain(){return world?.country_brains?.[focusCountry]||{}}
function renderCountryCommand(){
 const c=C(focusCountry),b=selectedBrain();$('#selectedCountryFlag').textContent=c.flag||'◌';$('#selectedCountryName').textContent=c.name||focusCountry;$('#selectedCountryPosture').textContent=(b.posture||'BALANCED').replaceAll('_',' ');
 $('#selectedCountryStats').innerHTML=[['STABILITY',c.stability_live??c.stability],['ECONOMY',c.economy_live??c.economy],['MAX FRONT',c.max_front],['PRESSURE',c.pressure],['ENERGY SEC.',c.energy_security],['INFLUENCE',c.influence]].map(([k,v])=>`<span>${k}<b>${Math.round(Number(v)||0)}</b></span>`).join('');
 const goals=(b.goals||[]).slice(0,5);$('#selectedObjectives').innerHTML=goals.length?goals.map(g=>`<div class="objective">${esc((g.id||g.label||String(g)).replaceAll('_',' '))}</div>`).join(''):`<div class="objective">Preserve national stability</div><div class="objective">Protect critical dependencies</div><div class="objective">Manage hottest bilateral front</div>`;
 const deps=[];const fs=fronts(focusCountry).filter(p=>p.dependencies);for(const p of fs){const side=p.a===focusCountry?'a_on_b':'b_on_a',other=p.a===focusCountry?p.b:p.a;const trade=Number(p.dependencies?.trade?.[side]||0),energy=Number(p.dependencies?.energy?.[side]||0);if(trade>0)deps.push({label:`Trade · ${C(other).name}`,v:trade});if(energy>0)deps.push({label:`Energy · ${C(other).name}`,v:energy})}
 deps.sort((a,b)=>b.v-a.v);$('#selectedDependenciesMini').innerHTML=(deps.slice(0,5).map(d=>`<div class="dep-mini"><span>${esc(d.label)}</span><b>${d.v.toFixed(1)}%</b><i style="--pct:${clamp(d.v)}%"></i></div>`).join('')||'<div class="muted small">Dependency cache is still expanding.</div>');
 const rts=ROUTES.filter(r=>r.countries.includes(focusCountry)||['ESP','USA','CHN','MAR','DZA','TUR','IRN'].includes(focusCountry)).map(r=>({r,...routeAccess(r,focusCountry)})).sort((a,b)=>({blocked:2,contested:1,open:0}[b.status]-({blocked:2,contested:1,open:0}[a.status]))).slice(0,6);
 $('#selectedRoutes').innerHTML=rts.map(x=>`<div class="route-mini" data-route="${x.r.id}"><span>${esc(x.r.name)}</span><b class="${x.status}">${x.status.toUpperCase()}</b></div>`).join('');$$('.route-mini').forEach(e=>e.onclick=()=>inspectRoute(ROUTES.find(r=>r.id===e.dataset.route)));
 const riskRows=[['Trade exposure',c.trade_dependency_risk||Math.min(100,(c.pressure||0)*.8)],['Energy exposure',c.energy_dependency_risk||Math.min(100,(c.pressure||0)*.9)],['Conflict risk',c.max_front||0],['Political risk',c.political_event_pressure||0]];
 $('#countryRiskBars').innerHTML=riskRows.map(([k,v])=>`<div class="risk-row"><div><span>${k}</span><b>${Math.round(v)}</b></div><div class="risk-track"><i style="width:${clamp(v)}%"></i></div></div>`).join('');
 const moves=(b.next_moves||[]).slice(0,5);$('#selectedQueue').innerHTML=moves.length?moves.map((m,i)=>`<div class="move-item"><span class="move-num">${i+1}</span><span>${esc((m.type||'strategic move').replaceAll('_',' '))}${m.target?' → '+esc(C(m.target).name):''}<small class="muted">${m.reason?'<br>'+esc(m.reason):''}</small></span><span class="move-eta">+${2+i*2}d</span></div>`).join(''):'<div class="muted small">AI queue will populate on the next autonomous scan.</div>';
}
function forecastTemplate(p){
 const A=C(p.a),B=C(p.b),dom=dominantDimension(p),rising=Number(p.trend||0)>0,score=Math.round(p.score||0);
 const map={
  military:rising?`${A.name} and ${B.name} may raise military readiness`:`${A.name} and ${B.name} could test a military confidence-building channel`,
  territorial:`Territorial pressure may reshape ${A.name}–${B.name} diplomacy`,
  energy:`Energy exposure may force a new ${A.name}–${B.name} bargaining round`,
  trade:`Trade dependence may trigger rerouting between ${A.name} and ${B.name}`,
  diplomatic:rising?`${A.name}–${B.name} diplomatic friction could intensify`:`${A.name} and ${B.name} may open a de-escalation channel`,
  domestic:`Domestic political pressure may harden ${A.name} policy toward ${B.name}`,
  information:`Information pressure may drive a new narrative contest between ${A.name} and ${B.name}`
 };
 return {title:map[dom]||`${A.name}–${B.name} relationship may shift`,dom,score};
}
function renderForecastNews(){
 const base=new Date(world?.updated_at||Date.now());const pairs=(world?.pairs||[]).slice().sort((a,b)=>(b.score+(b.trend||0)*2)-(a.score+(a.trend||0)*2)).slice(0,8);
 const cards=pairs.map((p,i)=>{const t=forecastTemplate(p),lead=Math.max(2,Math.round(25-(p.score||0)/4)+i),span=Math.max(3,Math.round(12-(p.score||0)/15));const d1=new Date(base);d1.setUTCDate(d1.getUTCDate()+lead);const d2=new Date(d1);d2.setUTCDate(d2.getUTCDate()+span);const sev=p.score>=82?'high':p.score>=65?'med':'low';return{p,t,sev,window:`${d1.toISOString().slice(0,10)} → ${d2.toISOString().slice(0,10)}`,body:`AI scenario from ${dominantDimension(p)} pressure ${Math.round(p.vector?.[dominantDimension(p)]||p.score)} / 100, trend ${Number(p.trend||0)>=0?'+':''}${Number(p.trend||0)} and ${Math.round(p.gearwatch_pressure||0)} GearWatch pressure.`}});
 const political=(world?.political_calendar?.events||world?.political_events||[]).filter(e=>e.date).slice(0,3).map(e=>({sev:'low',window:String(e.date).slice(0,10),t:{title:`Political event may change ${C(e.country||e.country_code).name} strategic utility`},body:esc(e.name||e.label||'Scheduled political event'),p:null}));
 const all=[...cards,...political].slice(0,10);
 $('#aiNewsFeed').innerHTML=all.map(x=>`<div class="ai-news-card ${x.sev}" ${x.p?`data-id="${x.p.id}"`:''}><div class="news-time"><span>${esc(x.window)}</span><b class="news-severity ${x.sev}">${x.sev.toUpperCase()}</b></div><h4>${esc(x.t.title)}</h4><p>${x.body}</p></div>`).join('');
 $$('.ai-news-card[data-id]').forEach(e=>e.onclick=()=>{selectedId=e.dataset.id;const p=pair(selectedId);if(p)focusCountry=p.a;render()});
 $('#forecastMeta').textContent=`${cards.length} AI scenarios · dated windows generated from current world state · not factual forecasts`;
}
function renderGear(){const gw=world?.gearwatch||{};$('#gearHeadline').textContent=gw.headline||'GearWatch causal radar';$('#gearBrief').textContent=gw.briefing||'';const arr=(gw.mechanisms||[]).filter(m=>m.impact_map).slice(0,12);$('#gearBoard').innerHTML=arr.map(m=>{const ids=m.impact_map?.pairs||[];const dims=Object.keys(m.impact_map?.domains||{}).join(' · ');return`<div class="gearitem" data-gw="${m.id}"><div class="row between"><b>${esc(m.label||m.id)}</b><span class="gscore">${Math.round(m.score||0)}</span></div><div class="small muted">${esc(m.state||'')} ${Number(m.delta)>0?'· ▲ '+m.delta:''}</div><div class="small">${esc(dims)}</div><div class="impactlist">${ids.slice(0,5).map(id=>`<span>${esc(id)}</span>`).join('')}</div></div>`}).join('')||'<div class="muted">No mapped causal mechanisms.</div>';$$('.gearitem').forEach(el=>el.onclick=()=>{const m=(gw.mechanisms||[]).find(x=>x.id===el.dataset.gw);if(!m)return;highlightPairs=m.impact_map?.pairs||[];const dims=Object.entries(m.impact_map?.domains||{}).sort((a,b)=>b[1]-a[1]);if(dims[0])setLayer(dims[0][0]);const hot=highlightPairs.map(id=>pair(id)).filter(Boolean).sort((a,b)=>b.score-a.score)[0];if(hot){selectedId=hot.id;focusCountry=hot.a}$('#causalPulse').innerHTML=`<b>${esc(m.label)}</b> · causal ${Math.round(m.score||0)}/100 · ${esc(m.state||'')}<br><span class="muted">Pressure mapped to ${(m.impact_map?.pairs||[]).join(', ')||'no bilateral fronts'}${(m.impact_map?.chokes||[]).length?' · chokepoints '+m.impact_map.chokes.join(', '):''}</span>`;render()})}
function renderChokes(){const arr=(world?.chokepoints||[]).slice().sort((a,b)=>b.score-a.score);$('#chokes').innerHTML=arr.map(c=>`<div class="choke" data-choke="${esc(c.id||c.name)}"><div class="row between"><b>${esc(c.name)}</b><strong style="color:${scoreColor(c.score)}">${Math.round(c.score)}</strong></div><div class="small muted">GW pressure ${Math.round((c.gearwatch_pressure||0)*10)/10}</div></div>`).join('')}
function renderCountries(){const arr=Object.entries(world?.countries||{}).sort((a,b)=>(b[1].max_front||0)-(a[1].max_front||0)).slice(0,18);$('#countries').innerHTML=arr.map(([code,c])=>`<div class="countrycard" data-code="${code}"><b>${c.flag} ${esc(c.name)}</b><div class="small muted">max front ${c.max_front||0} · avg ${c.pressure||0}</div><div class="small">stability ${c.stability_live||0} · economy ${c.economy_live||0}</div></div>`).join('');$$('.countrycard').forEach(el=>el.onclick=()=>selectCountry(el.dataset.code))}
function selectCountry(code){focusCountry=code;const fs=fronts(code);if(fs[0])selectedId=fs[0].id;if(mode==='sim'){player=code;sim.sim_log.unshift(`You take control of ${C(code).name}.`)}render()}
function renderSpark(){const h=(world?.history||[]).slice(-72);const s=$('#spark');if(!h.length){s.innerHTML='';return}const w=600,hh=110;const vals=h.map(x=>Number(x.global_risk??0));const min=Math.min(...vals,0),max=Math.max(...vals,100);const pts=vals.map((v,i)=>[i/(Math.max(1,vals.length-1))*w,hh-((v-min)/(Math.max(1,max-min)))*(hh-12)-6]);const d=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');s.innerHTML=`<line x1="0" y1="55" x2="600" y2="55"></line><path d="${d}"></path>`;$('#historyLabel').textContent=`${h.length} snapshots · risk ${vals[0]||'—'} → ${vals.at(-1)||'—'}`}
function renderSim(){if(mode!=='sim')return;$('#simDate').textContent=sim.sim_date;$('#simLog').innerHTML=(sim.sim_log||[]).slice(0,14).map(x=>`<div>${esc(x)}</div>`).join('')}
function renderActions(p){if(mode!=='sim')return;const involved=p.a===player||p.b===player;const other=p.a===player?p.b:p.a;const acts=involved?[['talks','Open de-escalation channel','↓ diplomatic, ↑ mediation'],['pressure','Economic pressure','↑ trade + diplomatic pressure'],['readiness','Military readiness','↑ military + deterrence'],['energy','Energy shield','↓ energy vulnerability']]:[['mediate','Offer mediation','↓ diplomatic; ↑ mediation restraint']];$('#actions').innerHTML=`<div class="small muted">Acting as ${C(player).flag} ${C(player).name}${involved?' vs '+C(other).name:' on a third-party front'}.</div>`+acts.map(a=>`<button class="action" data-act="${a[0]}"><b>${a[1]}</b><div class="small muted">${a[2]}</div></button>`).join('');$$('.action[data-act]').forEach(b=>b.onclick=()=>applyAction(p.id,b.dataset.act))}
function applyAction(id,act){const p=pair(id);if(!p||mode!=='sim')return;let txt='';if(act==='talks'){p.vector.diplomatic=clamp(p.vector.diplomatic-12);p.vector.domestic=clamp(p.vector.domestic-2);p.restraints.alliance_mediation=clamp(p.restraints.alliance_mediation+6);txt=`${C(player).name} opens a de-escalation channel on ${id}.`}if(act==='pressure'){p.vector.trade=clamp(p.vector.trade+11);p.vector.diplomatic=clamp(p.vector.diplomatic+5);p.restraints.economic_interdependence=clamp(p.restraints.economic_interdependence-4);txt=`${C(player).name} applies economic pressure on ${id}.`}if(act==='readiness'){p.vector.military=clamp(p.vector.military+12);p.restraints.deterrence=clamp(p.restraints.deterrence+7);txt=`${C(player).name} raises military readiness on ${id}.`}if(act==='energy'){p.vector.energy=clamp(p.vector.energy-9);const c=world.countries[player];if(c)c.energy_security=clamp(c.energy_security+4);txt=`${C(player).name} launches an energy resilience package.`}if(act==='mediate'){p.vector.diplomatic=clamp(p.vector.diplomatic-6);p.restraints.alliance_mediation=clamp(p.restraints.alliance_mediation+8);txt=`${C(player).name} offers mediation on ${id}.`}const old=p.score;p.score=relationOverall(p);p.trend=p.score-old;sim.sim_log.unshift(txt);recalcSimulation();render()}
function rnd(seed){let x=seed>>>0;return()=>{x=(x*1664525+1013904223)>>>0;return x/4294967296}}
function resolveWeek(){if(mode!=='sim')return;const d=new Date(sim.sim_date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+7);sim.sim_date=d.toISOString().slice(0,10);const r=rnd(Number(sim.sim_date.replaceAll('-','')));for(const p of sim.pairs){const old=p.score;const top=Object.entries(p.vector||{}).sort((a,b)=>b[1]-a[1])[0]?.[0]||'diplomatic';const restraint=Object.values(p.restraints||{}).reduce((a,b)=>a+Number(b||0),0)/Math.max(1,Object.keys(p.restraints||{}).length);const drift=(r()-.48)*7-(restraint-55)*.018;const gear=(p.gearwatch_impacts||[]).reduce((s,x)=>s+(x.state==='ACTIVE'||x.state==='ARMING'?Number(x.pressure||0):0),0)*.035;p.vector[top]=clamp(p.vector[top]+drift+gear);p.score=relationOverall(p);p.trend=p.score-old}recalcSimulation();const hot=sim.pairs.slice().sort((a,b)=>b.score-a.score)[0];sim.sim_log.unshift(`AI countries resolve week ending ${sim.sim_date}. Highest front: ${hot.id} ${hot.score}/100.`);render()}
function recalcSimulation(){const ps=world.pairs||[],scores=ps.map(p=>p.score);if(!scores.length)return;const avg=scores.reduce((a,b)=>a+b,0)/scores.length,hot=Math.max(...scores);world.global.risk=Math.round(clamp(avg*.58+hot*.42));const ch=world.chokepoints||[];world.global.shipping_stress=Math.round(ch.reduce((s,c)=>s+c.score,0)/Math.max(1,ch.length));const e=ch.filter(c=>c.domains?.includes('energy'));world.global.energy_stress=Math.round(e.reduce((s,c)=>s+c.score,0)/Math.max(1,e.length));const t=ch.filter(c=>c.domains?.includes('trade'));world.global.trade_stress=Math.round(t.reduce((s,c)=>s+c.score,0)/Math.max(1,t.length))}
function setMode(next){mode=next;document.body.classList.toggle('sim',next==='sim');$('#liveBtn').classList.toggle('active',next==='live');$('#simBtn').classList.toggle('active',next==='sim');if(next==='sim'){sim=deep(live);world=sim;player=focusCountry||'ESP';sim.sim_date=(live.updated_at||new Date().toISOString()).slice(0,10);sim.sim_log=[`Fork created from LIVE snapshot. AI countries continue autonomously; you control ${C(player).name}.`]}else{world=live;sim=null}ensureSelected();render()}
function setLayer(next){layer=next;$$('.layer').forEach(b=>b.classList.toggle('active',b.dataset.layer===layer));$('#layerName').textContent=DIM_LABELS[layer]||layer;renderRanking();renderMap()}
function render(){renderKpis();renderFront();renderRanking();renderGear();renderChokes();renderCountries();renderAgentRoster();renderCountryCommand();renderForecastNews();renderSpark();renderSim();renderMap()}
function mapCountryValue(code){const fs=fronts(code);return fs.length?Math.max(...fs.map(p=>val(p))):0}

function inspectRoute(route){
 if(!route)return;selectedRoute=route.id;const access=routeAccess(route,focusCountry),global=routeGlobalStatus(route);const c=C(focusCountry);
 const gates=(route.gates||[]).map(x=>GATE_LABELS[x]||x).join(' · ')||'No critical chokepoint';
 $('#routeInspector').innerHTML=`<div class="route-inspector-head"><div><span class="mini-label">${esc(route.subtype)}</span><b>${esc(route.name)}</b></div><span class="status-badge ${statusClass(access.status)}">${access.status.toUpperCase()}</span></div><div class="route-inspector-body"><div><b>${c.flag} ${esc(c.name)} ACCESS</b> · ${access.status.toUpperCase()}</div><p>${esc(access.reason)}</p><div class="muted">Global route state: ${global.toUpperCase()}<br>Chokepoints: ${esc(gates)}<br><small>Modeled access, not a factual navigation instruction.</small></div></div>`;
 renderMap();
}
function inspectChoke(c){
 if(!c)return;const routes=ROUTES.filter(r=>(r.gates||[]).some(g=>String(c.id||c.name).toUpperCase().includes(g)||String(c.name).toUpperCase().includes((GATE_LABELS[g]||g).replace('Strait of ','').toUpperCase())));const access=routes.map(r=>({r,...routeAccess(r,focusCountry)}));const worst=(access.sort((a,b)=>({blocked:2,contested:1,open:0}[b.status]-{blocked:2,contested:1,open:0}[a.status]))[0]?.status)||'contested';
 $('#routeInspector').innerHTML=`<div class="route-inspector-head"><div><span class="mini-label">STRATEGIC CHOKEPOINT</span><b>${esc(c.name)}</b></div><span class="status-badge ${statusClass(worst)}">${worst.toUpperCase()}</span></div><div class="route-inspector-body"><div><b>${C(focusCountry).flag} ${esc(C(focusCountry).name)} ACCESS</b></div><p>Global pressure ${Math.round(c.score||0)}/100 · GearWatch ${Math.round((c.gearwatch_pressure||0)*10)/10}.</p>${access.slice(0,4).map(x=>`<div class="route-mini"><span>${esc(x.r.name)}</span><b class="${x.status}">${x.status.toUpperCase()}</b></div>`).join('')}<small class="muted">Access is a game-model output and may differ by country.</small></div>`;
}

async function initMap(){
 try{
  [d3,topo,{default:atlas}]=await Promise.all([import('https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm'),import('https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/+esm'),import('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json/+esm')]);
  const features=topo.feature(atlas,atlas.objects.countries).features;projection=d3.geoNaturalEarth1().fitExtent([[12,12],[1188,668]],{type:'Sphere'});path=d3.geoPath(projection);
  svg=d3.select('#worldMap');svg.selectAll('*').remove();svg.append('defs').html(`<filter id="softGlow"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`);
  svg.append('path').datum({type:'Sphere'}).attr('d',path).attr('fill','#06131a').attr('stroke','#174051');
  g=svg.append('g');landG=g.append('g');depG=g.append('g');routeG=g.append('g');edgeG=g.append('g');chokeG=g.append('g');infraG=g.append('g');electionG=g.append('g');shipG=g.append('g');labelG=g.append('g');
  countryPaths=landG.selectAll('path').data(features).join('path').attr('d',path).attr('class','country').on('click',(ev,d)=>{const code=ALIASES[d.properties?.name];if(code&&world?.countries?.[code])selectCountry(code)});
  zoom=d3.zoom().scaleExtent([1,9]).on('zoom',ev=>g.attr('transform',ev.transform));svg.call(zoom);
  $('#zoomIn').onclick=()=>svg.transition().duration(150).call(zoom.scaleBy,1.45);$('#zoomOut').onclick=()=>svg.transition().duration(150).call(zoom.scaleBy,.69);$('#zoomReset').onclick=()=>svg.transition().duration(150).call(zoom.transform,d3.zoomIdentity);
  renderMap();
 }catch(err){console.error(err);$('#worldMap').replaceWith(Object.assign(document.createElement('div'),{className:'muted',textContent:'Map engine failed; ranking and simulation still work.'}))}
}
function renderMap(){
 if(!countryPaths||!world)return;
 countryPaths.attr('fill',d=>{const code=ALIASES[d.properties?.name];if(!code||!world.countries?.[code])return '#07151c';const hot=mapCountryValue(code),focused=code===focusCountry;return focused?'#0c5968':scoreColor(hot)}).attr('opacity',d=>ALIASES[d.properties?.name]&&world.countries?.[ALIASES[d.properties.name]]?.pressure?1:.64).attr('class',d=>{const code=ALIASES[d.properties?.name];return'country'+(mode==='sim'&&code===player?' player':'')+(code===focusCountry?' focused':'')});
 const deps=mapLayers.dependencies?(world.pairs||[]).filter(p=>p.origin==='dependency-exposure').slice(0,80):[];
 depG.style('display',mapLayers.dependencies?null:'none').selectAll('path').data(deps,d=>d.id).join('path').attr('class','dependency-edge').attr('d',d=>path({type:'LineString',coordinates:[C(d.a).coord,C(d.b).coord]}));
 const rdata=ROUTES.filter(routeVisible);
 routeG.selectAll('path.route-path').data(rdata,d=>d.id).join(enter=>enter.append('path').attr('class','route-path').on('click',(ev,d)=>{ev.stopPropagation();inspectRoute(d)}),update=>update,exit=>exit.remove()).attr('id',d=>'route-'+d.id).attr('d',d=>path({type:'LineString',coordinates:d.points})).attr('class',d=>{const s=routeAccess(d,focusCountry).status;return`route-path route-${s} route-${d.kind}`}).attr('stroke-width',d=>d.id===selectedRoute?3.6:1.8).attr('opacity',d=>d.id===selectedRoute?1:.72);
 const data=mapLayers.tensions?(world.pairs||[]).filter(p=>p.origin!=='dependency-exposure'||layer==='trade'||layer==='energy'): [];
 edgeG.selectAll('path.edge').data(data,d=>d.id).join(enter=>enter.append('path').attr('class','edge').on('click',(ev,d)=>{ev.stopPropagation();selectedId=d.id;focusCountry=d.a;highlightPairs=[];render()}),update=>update,exit=>exit.remove()).attr('class',d=>'edge'+(d.id===selectedId?' selected':'')).attr('d',d=>path({type:'LineString',coordinates:[C(d.a).coord,C(d.b).coord]})).attr('stroke',d=>highlightPairs.includes(d.id)?'#ffffff':COLORS[layer]||scoreColor(val(d))).attr('stroke-width',d=>.8+val(d)/38+(highlightPairs.includes(d.id)?2:0)).attr('stroke-dasharray',d=>val(d)<55?'5 4':null);
 const cg=chokeG.selectAll('g.chokepoint').data(world.chokepoints||[],d=>d.id).join(enter=>{const q=enter.append('g').attr('class','chokepoint').on('click',(ev,d)=>{ev.stopPropagation();inspectChoke(d)});q.append('circle').attr('r',6).attr('fill','#07151c').attr('stroke-width',2).attr('filter','url(#softGlow)');q.append('text').attr('class','chokelabel').attr('x',9).attr('y',3);return q},update=>update,exit=>exit.remove()).attr('transform',d=>{const p=projection(d.coord);return`translate(${p[0]},${p[1]})`});cg.select('circle').attr('stroke',d=>scoreColor(d.score));cg.select('text').text(d=>`${d.name} ${Math.round(d.score)}`);
 const ndata=NODES.filter(n=>world.countries?.[n.country]||['port','energy','cable'].includes(n.type));const ng=infraG.selectAll('g.infrastructure-node').data(ndata,d=>d.id).join(enter=>{const q=enter.append('g').attr('class','infrastructure-node');q.append('circle').attr('r',4).attr('stroke','#081016').attr('stroke-width',1.2);q.append('text').attr('class','node-label').attr('x',6).attr('y',3);return q},update=>update,exit=>exit.remove()).attr('transform',d=>{const p=projection(d.coord);return`translate(${p[0]},${p[1]})`});ng.select('circle').attr('fill',d=>d.type==='port'?'#39d7ff':d.type==='energy'?'#ffd35d':'#be7cff');ng.select('text').text(d=>d.type==='port'?'⚓':d.type==='energy'?'◉':'⌁');
 const events=mapLayers.elections?(world?.political_calendar?.events||world?.political_events||[]):[];const eg=electionG.selectAll('g.election').data(events.filter(e=>world.countries?.[e.country||e.country_code]?.coord),d=>d.id||d.name).join(enter=>{const q=enter.append('g').attr('class','election');q.append('circle').attr('class','election-marker').attr('r',4);q.append('text').attr('class','node-label').attr('x',6).attr('y',3).text('▣');return q},update=>update,exit=>exit.remove()).attr('transform',d=>{const p=projection(C(d.country||d.country_code).coord);return`translate(${p[0]},${p[1]})`});
 const shipRoutes=rdata.filter(r=>r.kind==='maritime'||r.kind==='energy').slice(0,7);const ships=shipG.selectAll('circle.ship').data(shipRoutes,d=>d.id).join(enter=>enter.append('circle').attr('class','ship').attr('r',3).attr('fill','#dff9ff').attr('filter','url(#softGlow)'),update=>update,exit=>exit.remove());
 ships.each(function(r,i){const pts=r.points.map(projection);const t=(Date.now()/12000+i/7)%1;const seg=Math.min(pts.length-2,Math.floor(t*(pts.length-1))),local=t*(pts.length-1)-seg;const x=pts[seg][0]+(pts[seg+1][0]-pts[seg][0])*local,y=pts[seg][1]+(pts[seg+1][1]-pts[seg][1])*local;d3.select(this).attr('cx',x).attr('cy',y)});
 const labs=Object.entries(world.countries||{}).filter(([code,c])=>mapCountryValue(code)>=65||code===focusCountry);labelG.selectAll('text.maplabel').data(labs,d=>d[0]).join('text').attr('class','maplabel').attr('text-anchor','middle').attr('x',d=>projection(d[1].coord)[0]).attr('y',d=>projection(d[1].coord)[1]-8).text(d=>`${d[1].flag} ${d[1].name}`);
}
function bindUi(){
 $('#liveBtn').onclick=()=>setMode('live');$('#simBtn').onclick=()=>setMode('sim');$('#refreshBtn').onclick=async()=>{live=await fetchState();if(mode==='live')world=live;render()};$('#nextTurn').onclick=resolveWeek;
 $$('.layer').forEach(b=>b.onclick=()=>setLayer(b.dataset.layer));
 $$('[data-map-layer]').forEach(i=>i.onchange=()=>{mapLayers[i.dataset.mapLayer]=i.checked;renderMap()});
 $('#agentSearch').oninput=renderAgentRoster;
 setInterval(()=>{if(world&&countryPaths)renderMap()},1200);
}
async function init(){live=await fetchState();world=live;ensureSelected();bindUi();render();await initMap();render()}
init().catch(err=>{console.error(err);document.body.innerHTML=`<div style="padding:30px;color:white;background:#04080c;font-family:system-ui"><h1>WORLD//STATE failed to initialise</h1><pre>${esc(err.message)}</pre></div>`});
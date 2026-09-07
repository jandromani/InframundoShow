const RAW='https://raw.githubusercontent.com/jandromani/InframundoShow/master/data/live.json';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,Number(v)||0));
let state=null;

async function load(){
  try{const r=await fetch(RAW+'?autonomy='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error(String(r.status));state=await r.json();renderAll()}catch(e){console.warn('autonomy widget',e)}
}
function fmtPct(v){return Number.isFinite(Number(v))?Number(v).toFixed(1)+'%':'—'}
function bar(label,value){const v=clamp(value);return `<div class="vector"><div class="vectorhead"><span>${esc(label)}</span><b>${Math.round(v)}</b></div><div class="track"><div class="fill" style="width:${v}%"></div></div></div>`}
function selectedPair(){
  if(!state)return null;const title=$('#frontTitle')?.textContent||'';
  return (state.pairs||[]).find(p=>{const a=state.countries?.[p.a]?.name||p.a,b=state.countries?.[p.b]?.name||p.b;return title.includes(a)&&title.includes(b)})||null;
}
function renderAuto(){
  const h=$('#autoGraph');if(!h||!state)return;const a=state.auto_discovery||{};
  const auto=(state.pairs||[]).filter(p=>p.origin==='auto-discovery').sort((x,y)=>(y.evidence_score||0)-(x.evidence_score||0));
  h.innerHTML=`<div class="autostats"><div><b>${a.catalog_countries??'—'}</b><span>country catalog</span></div><div><b>${a.articles_scanned??'—'}</b><span>discovery articles</span></div><div><b>${a.candidate_edges??'—'}</b><span>candidate edges</span></div><div><b>${a.active_auto_edges??auto.length}</b><span>live auto edges</span></div><div><b>${a.total_edges??state.pairs?.length??'—'}</b><span>total world edges</span></div></div><div class="small muted" style="margin-top:8px">Edges require repeated evidence and decay when signals disappear. Auto-discovery threshold: ${a.threshold??'—'}.</div><div class="autolist">${auto.slice(0,12).map(p=>{const A=state.countries?.[p.a],B=state.countries?.[p.b];return `<div class="autoedge"><b>${A?.flag||''} ${esc(A?.name||p.a)} ↔ ${B?.flag||''} ${esc(B?.name||p.b)}</b><span>evidence ${Math.round(p.evidence_score||0)} · ${p.source_diversity||0} sources · ${p.fresh_hits||0} fresh</span></div>`}).join('')||'<div class="muted">No auto edge has crossed the activation threshold yet.</div>'}</div>`;
}
function renderDependency(){
  const h=$('#dependencies');if(!h||!state)return;const p=selectedPair();if(!p){h.innerHTML='<span class="muted small">Select a bilateral relationship.</span>';return}
  const d=p.dependencies;if(!d){h.innerHTML='<span class="muted small">No Comtrade coverage cached for this relationship yet.</span>';return}
  const A=state.countries?.[p.a]?.name||p.a,B=state.countries?.[p.b]?.name||p.b;
  h.innerHTML=`<div class="depgrid"><div><span>${esc(A)} imports from ${esc(B)}</span><b>${fmtPct(d.trade?.a_on_b)}</b><small>all goods</small></div><div><span>${esc(B)} imports from ${esc(A)}</span><b>${fmtPct(d.trade?.b_on_a)}</b><small>all goods</small></div><div><span>${esc(A)} energy from ${esc(B)}</span><b>${fmtPct(d.energy?.a_on_b)}</b><small>HS27</small></div><div><span>${esc(B)} energy from ${esc(A)}</span><b>${fmtPct(d.energy?.b_on_a)}</b><small>HS27</small></div></div><div class="small muted" style="margin-top:7px">${esc(d.source||'UN Comtrade')} · period ${esc(d.period||'latest cached')} · coverage ${Math.round((d.coverage||0)*100)}%</div>`;
}
function brainCard(code){const b=state?.country_brains?.[code],c=state?.countries?.[code];if(!b||!c)return '';const weights=b.utility_weights||{};return `<div class="braincard"><div class="row" style="justify-content:space-between"><b>${c.flag||''} ${esc(c.name||code)}</b><span class="pill">${esc(b.posture||'BALANCED')}</span></div><div class="small muted">hot front ${esc(b.constraints?.hottest_front||'—')} · ${Math.round(b.constraints?.hottest_score||0)}/100 · election pressure ${Math.round(b.constraints?.election_pressure||0)}</div><div class="brainweights">${Object.entries(weights).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,v])=>`<span>${esc(k)} <b>${Math.round(v)}</b></span>`).join('')}</div><div class="small" style="margin-top:6px"><b>Goals</b> ${(b.goals||[]).slice(0,3).map(g=>esc(g.id.replaceAll('_',' '))).join(' · ')||'—'}</div><div class="brainmoves">${(b.next_moves||[]).slice(0,3).map(m=>`<div><b>${esc(m.type)}</b>${m.target?' → '+esc(state.countries?.[m.target]?.name||m.target):''}<br><span>${esc(m.reason||'')}</span></div>`).join('')}</div>${b.rationale?`<div class="small muted">AI rationale: ${esc(b.rationale)}</div>`:''}</div>`}
function renderBrains(){
  const h=$('#countryBrain');if(!h||!state)return;const p=selectedPair();let codes=p?[p.a,p.b]:Object.values(state.country_brains||{}).sort((a,b)=>(b.constraints?.hottest_score||0)-(a.constraints?.hottest_score||0)).slice(0,2).map(b=>b.country);h.innerHTML=codes.map(brainCard).join('')||'<div class="muted">Country brains will appear after the autonomous scan.</div>';
  const m=state.country_brain||{};const meta=$('#brainMeta');if(meta)meta.textContent=`${m.countries??0} brains · ${m.llm_enabled?'utility + LLM':'deterministic utility'} · updated ${m.updated_at?new Date(m.updated_at).toLocaleTimeString('es-ES'): '—'}`;
}
function renderPipeline(){const h=$('#autonomyStatus');if(!h||!state)return;const a=state.auto_discovery||{},d=state.dependency_graph||{},b=state.country_brain||{};h.innerHTML=`<span>EDGE DISCOVERY <b>${a.active_auto_edges??0}</b></span><span>COMTRADE <b>${d.relationships_enriched??0}</b></span><span>COUNTRY BRAINS <b>${b.countries??0}</b></span>`}
function renderAll(){renderAuto();renderDependency();renderBrains();renderPipeline()}
const title=$('#frontTitle');if(title)new MutationObserver(()=>{renderDependency();renderBrains()}).observe(title,{subtree:true,childList:true,characterData:true});
document.addEventListener('click',e=>{if(e.target.closest('.rankrow,.countrycard,.tension-edge'))setTimeout(()=>{renderDependency();renderBrains()},20)});
load();setInterval(load,5*60*1000);

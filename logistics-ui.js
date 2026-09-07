// WORLD//STATE Logistics UI + autonomous flow resolver
(function(){
  function ensureHud(){
    const wrap=document.querySelector('.mapwrap');if(!wrap||document.getElementById('logisticsHud'))return;
    const h=document.createElement('div');h.id='logisticsHud';h.className='logistics-hud';wrap.appendChild(h)
  }
  function relevantRoutes(){
    return buildLogisticsSnapshot(focusCountry).filter(x=>{const r=ROUTES.find(y=>y.id===x.id);return r?.countries?.includes(focusCountry)||x.status!=='open'}).slice(0,5)
  }
  function renderLogisticsHud(){
    ensureHud();const h=document.getElementById('logisticsHud');if(!h||!world)return;const rows=relevantRoutes(),state=recomputeLogisticsState(),cs=state?.countries?.[focusCountry]||{open:0,contested:0,blocked:0,avgCapacity:0};
    h.innerHTML=`<div class="lh-head"><b>⇄ LOGISTICS GRAPH · ${esc(C(focusCountry).flag||'')} ${esc(C(focusCountry).name||focusCountry)}</b><span class="${window.WORLDSTATE_DOM_AUDIT?.ok?'runtime-ok':'runtime-warn'}">${window.WORLDSTATE_DOM_AUDIT?.ok?'RUNTIME OK':'DOM REPAIRED'}</span></div><div class="lh-grid"><div class="lh-stat"><span>Open</span><b>${cs.open}</b></div><div class="lh-stat"><span>Contested</span><b>${cs.contested}</b></div><div class="lh-stat"><span>Blocked</span><b>${cs.blocked}</b></div><div class="lh-stat"><span>Avg capacity</span><b>${cs.avgCapacity||0}%</b></div></div>${rows.map(x=>`<div class="lh-route" data-log-route="${x.id}"><div><b>${esc(x.name)}</b><div class="flow-meter"><i style="width:${x.capacityPct}%"></i></div><small>${esc((x.commodities||[]).join(' · '))}</small></div><div><b class="lh-status ${x.status}">${x.status.toUpperCase()}</b><small>${x.transitDays}d · INS ${x.insuranceIndex}</small></div></div>`).join('')}`;
    h.querySelectorAll('[data-log-route]').forEach(e=>e.onclick=()=>inspectRoute(ROUTES.find(r=>r.id===e.dataset.logRoute)))
  }
  inspectRoute=function(route){
    if(!route)return;selectedRoute=route.id;const m=routeMetrics(route,focusCountry),el=document.getElementById('routeInspector');if(!el)return;
    const rr=m.activeReroute?`<div class="reroute-box"><b>AUTO REROUTE → ${esc(m.activeReroute.name)}</b><br><small>${m.activeReroute.days} days · ${m.activeReroute.capacity}% model capacity · ${m.activeReroute.status}</small></div>`:(m.alternatives?.length?`<div class="reroute-box"><b>Alternatives</b><br><small>${m.alternatives.map(a=>`${esc(a.name)} (${a.status}, ${a.days}d)`).join(' · ')}</small></div>`:'');
    el.innerHTML=`<div class="route-inspector-head"><div><span class="mini-label">${esc(route.kind.toUpperCase())} · COUNTRY ACCESS</span><b>${esc(route.name)}</b></div><span class="status-badge ${m.status}">${m.status.toUpperCase()}</span></div><div class="route-inspector-body"><b>${esc(C(focusCountry).flag||'')} ${esc(C(focusCountry).name||focusCountry)}</b><p>${esc(m.reason)}</p><div class="metric-grid"><div><small>Capacity</small><b>${m.capacityPct}%</b></div><div><small>Transit</small><b>${m.transitDays}d</b></div><div><small>Insurance</small><b>${m.insuranceIndex}</b></div><div><small>Choke risk</small><b>${m.chokeRisk}</b></div></div><div class="commodity-row">${(m.commodities||[]).map(c=>`<span>${esc(c)}</span>`).join('')}</div>${rr}<small class="muted">Capacity and insurance are simulation indices. Route geometry is strategic/approximate.</small></div>`;
    renderMap()
  };
  function decorateMapFlows(){
    for(const r of ROUTES){const p=document.getElementById('route-'+r.id);if(!p)continue;const m=routeMetrics(r,focusCountry);p.classList.remove('flow-open','flow-contested','flow-blocked');p.classList.add('flow-'+m.status);const base=selectedRoute===r.id?5:Math.max(1.1,1.2+m.capacityPct/38);p.style.strokeWidth=String(base);p.style.opacity=m.status==='blocked'?'.78':r.countries.includes(focusCountry)?'.96':'.34';const title=p.querySelector('title');if(title)title.textContent=`${r.name} · ${C(focusCountry).name}: ${m.status} · capacity ${m.capacityPct}% · ${m.transitDays}d · insurance ${m.insuranceIndex}`}
  }
  function captureAccess(){const out={};for(const r of ROUTES){for(const code of r.countries||[]){out[r.id+'|'+code]=routeMetrics(r,code).status}}return out}
  function logisticsEvents(before){
    if(mode!=='sim'||!sim)return[];const ev=[];for(const r of ROUTES){for(const code of r.countries||[]){const key=r.id+'|'+code,old=before[key],m=routeMetrics(r,code);if(!old||old===m.status)continue;const sev=m.status==='blocked'?'high':m.status==='contested'?'med':'low';ev.push({actor:code,target:r.id,type:'LOGISTICS_STATUS',domain:'trade',impact:m.status==='blocked'?8:4,severity:sev,date:sim.sim_date,headline:`${C(code).name}: ${r.name} becomes ${m.status}`,body:m.activeReroute?`Flows reroute via ${m.activeReroute.name}; transit ${m.transitDays} days, capacity ${m.capacityPct}%.`:`Modeled access changes from ${old} to ${m.status}; capacity ${m.capacityPct}%, insurance index ${m.insuranceIndex}.`})}}
    return ev
  }
  function applyGlobalFlowStress(){if(!world?.global)return;const rows=ROUTES.filter(r=>['trade','maritime','energy'].includes(r.kind)).map(r=>{const a=_routeAccessV1(r,'GLOBAL');const risk=a.status==='blocked'?100:a.status==='contested'?62:18;return{r,risk}});if(!rows.length)return;const avg=rows.reduce((s,x)=>s+x.risk*(Number(x.r.capacity)||60),0)/rows.reduce((s,x)=>s+(Number(x.r.capacity)||60),0);world.global.shipping_stress=Math.round(clamp((Number(world.global.shipping_stress)||0)*.55+avg*.45));world.global.trade_stress=Math.round(clamp((Number(world.global.trade_stress)||0)*.7+avg*.3));const energy=rows.filter(x=>x.r.kind==='energy');if(energy.length){const e=energy.reduce((s,x)=>s+x.risk,0)/energy.length;world.global.energy_stress=Math.round(clamp((Number(world.global.energy_stress)||0)*.72+e*.28))}}
  const baseRender=render;render=function(){baseRender();renderLogisticsHud();setTimeout(decorateMapFlows,0)};
  const baseMap=renderMap;renderMap=function(){baseMap();decorateMapFlows()};
  const baseWeek=resolveWeek;resolveWeek=function(){if(mode!=='sim')return baseWeek();const before=captureAccess();baseWeek();const ev=logisticsEvents(before);if(ev.length){sim.generated_news=[...ev,...(sim.generated_news||[])].slice(0,28);sim.sim_log=[...ev.slice(0,4).map(x=>`LOGISTICS · ${x.headline}`),...(sim.sim_log||[])].slice(0,30)}recomputeLogisticsState();applyGlobalFlowStress();baseRender();renderLogisticsHud();renderMap()};
  window.addEventListener('load',()=>{ensureHud();setTimeout(()=>{renderLogisticsHud();decorateMapFlows()},200)});
})();

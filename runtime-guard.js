(()=>{
  const specs={
    worldMap:'svg',riskKpi:'b',energyKpi:'b',shipKpi:'b',tradeKpi:'b',politicalKpi:'b',memoryKpi:'b',updatedChip:'span',modeText:'div',aiActing:'b',simClock:'small',turnCounter:'b',turnDate:'small',
    frontTitle:'h2',frontScore:'div',frontTrend:'div',frontSummary:'p',frontDomains:'div',vectors:'div',restraints:'div',drivers:'div',botMoves:'div',news:'div',pairGear:'div',ranking:'div',agentRoster:'div',agentSearch:'input',
    selectedCountryFlag:'div',selectedCountryName:'h2',selectedCountryPosture:'div',selectedCountryStats:'div',selectedObjectives:'div',selectedDependenciesMini:'div',selectedRoutes:'div',countryRiskBars:'div',selectedQueue:'div',
    aiNewsFeed:'div',forecastMeta:'div',gearHeadline:'h2',gearBrief:'p',gearBoard:'div',causalPulse:'div',chokes:'div',countries:'div',spark:'svg',historyLabel:'div',simDate:'h3',simLog:'div',actions:'div',layerName:'b',routeInspector:'div',
    politicalCalendar:'div',autonomyStatus:'div',autoGraph:'div',countryBrain:'div',dependencies:'div',brainMeta:'div',nextTurn:'button',zoomIn:'button',zoomOut:'button',zoomReset:'button',liveBtn:'button',simBtn:'button',autoPlayBtn:'button',speedSelect:'select',refreshBtn:'button'
  };
  const missing=[];
  const host=document.body||document.documentElement;
  for(const [id,tag] of Object.entries(specs)){
    if(document.getElementById(id)) continue;
    missing.push(id);
    const el=document.createElementNS(tag==='svg'?'http://www.w3.org/2000/svg':'http://www.w3.org/1999/xhtml',tag);
    el.id=id;
    if(tag!=='svg') el.setAttribute('hidden','');
    else {el.setAttribute('width','1');el.setAttribute('height','1');el.style.display='none'}
    host.appendChild(el);
  }
  window.WORLDSTATE_DOM_AUDIT={ok:missing.length===0,missing,checked:Object.keys(specs).length,at:new Date().toISOString()};
  if(missing.length) console.warn('[WORLD//STATE] DOM contract repaired:',missing);
  window.addEventListener('error',e=>{
    if(!document.getElementById('runtimeErrorBadge')){
      const b=document.createElement('div');b.id='runtimeErrorBadge';b.style.cssText='position:fixed;left:12px;bottom:12px;z-index:99999;background:#350b12dd;border:1px solid #ff5265;color:#ffdce2;padding:8px 10px;border-radius:8px;font:11px/1.35 ui-monospace,monospace;max-width:420px';document.body.appendChild(b)
    }
    document.getElementById('runtimeErrorBadge').textContent='Runtime warning: '+String(e.message||'unknown error');
  });
})();

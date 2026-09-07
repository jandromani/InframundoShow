import fs from 'node:fs/promises';

const STATE_PATH=new URL('../data/live.json',import.meta.url);
const CACHE_PATH=new URL('../data/dependencies.json',import.meta.url);
const COUNTRY_URL='https://raw.githubusercontent.com/mledoze/countries/master/countries.json';
const TIMEOUT=7000;
const TTL=7*86400000;
const FAILURE_COOLDOWN=12*3600000;
const MAX_REPORTERS_PER_RUN=4;
const REQUEST_GAP_MS=2200;
const TRADE_EDGE_THRESHOLD=5;
const ENERGY_EDGE_THRESHOLD=8;
const MAX_EXPOSURE_PARTNERS_PER_REPORTER=5;
const clamp=(x,a=0,b=100)=>Math.max(a,Math.min(b,Number(x)||0));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function readCache(){try{return JSON.parse(await fs.readFile(CACHE_PATH,'utf8'))}catch{return {version:2,reporters:{},failures:{}}}}
async function staticJson(url,fallback=[]){try{const r=await fetch(url,{headers:{'user-agent':'worldstate-dependency/0.4'},signal:AbortSignal.timeout(TIMEOUT)});if(!r.ok)return fallback;return await r.json()}catch{return fallback}}
async function getJson(url){
  for(let attempt=1;attempt<=3;attempt++){
    try{
      const r=await fetch(url,{headers:{'user-agent':'worldstate-dependency/0.4'},signal:AbortSignal.timeout(TIMEOUT)});
      if(r.status===429||r.status===503){console.warn(`Comtrade ${r.status}, retry ${attempt}`);await sleep(1800*attempt);continue}
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      const j=await r.json();if(j?.error)console.warn('Comtrade response warning:',j.error);return j;
    }catch(e){console.warn('Comtrade fetch failed:',e.message||e.name);if(attempt<3)await sleep(1000*attempt)}
  }
  return null;
}
function value(r){for(const k of ['primaryValue','cifvalue','CIFValue','fobvalue','FOBValue','TradeValue','tradeValue']){const n=Number(r?.[k]);if(Number.isFinite(n))return n}return 0}
function partnerCode(r){return String(r?.partnerCode??r?.PartnerCode??r?.partnerISO??'')}
function rows(j){return Array.isArray(j?.data)?j.data:Array.isArray(j?.dataset)?j.dataset:[]}
async function matrix(reporter,cmd,period){
  const u=new URL('https://comtradeapi.un.org/public/v1/preview/C/A/HS');
  u.searchParams.set('reportercode',String(Number(reporter)));
  u.searchParams.set('period',period);u.searchParams.set('flowCode','M');u.searchParams.set('cmdCode',cmd);u.searchParams.set('maxRecords','500');u.searchParams.set('includeDesc','true');
  const j=await getJson(u);await sleep(REQUEST_GAP_MS);if(!j)return null;const rr=rows(j);if(!rr.length)return null;
  let world=0;const partners={};
  for(const r of rr){const p=String(Number(partnerCode(r))),v=value(r);if(!v||p==='NaN')continue;if(p==='0'||String(r?.partnerDesc||'').toLowerCase()==='world')world=Math.max(world,v);else partners[p]=(partners[p]||0)+v;}
  if(!world)world=Object.values(partners).reduce((a,b)=>a+b,0);
  return {world,partners,rows:rr.length};
}
async function loadReporter(m49){
  for(const period of ['2025','2024']){
    const all=await matrix(m49,'TOTAL',period);if(!all?.world)continue;
    const energy=await matrix(m49,'27',period);
    return {period,all,energy:energy||{world:0,partners:{},rows:0},source:'UN Comtrade preview'};
  }
  return null;
}
function pct(n,d){return d>0?clamp(n/d*100,0,100):0}
function pairId(a,b){return [a,b].sort().join('-')}
function sameEndpoints(p,a,b){return (p.a===a&&p.b===b)||(p.a===b&&p.b===a)}
function pairDependency(a,b,cache){
  const aa=cache.reporters?.[String(Number(a.m49))],bb=cache.reporters?.[String(Number(b.m49))];
  const am=String(Number(b.m49)),bm=String(Number(a.m49));
  const aTrade=aa?pct(aa.all?.partners?.[am]||0,aa.all?.world||0):0;
  const bTrade=bb?pct(bb.all?.partners?.[bm]||0,bb.all?.world||0):0;
  const aEnergy=aa?pct(aa.energy?.partners?.[am]||0,aa.energy?.world||0):0;
  const bEnergy=bb?pct(bb.energy?.partners?.[bm]||0,bb.energy?.world||0):0;
  const coverage=[aa,bb].filter(Boolean).length/2;
  return {trade:{a_on_b:Number(aTrade.toFixed(2)),b_on_a:Number(bTrade.toFixed(2))},energy:{a_on_b:Number(aEnergy.toFixed(2)),b_on_a:Number(bEnergy.toFixed(2))},period:aa?.period||bb?.period||null,coverage,source:'UN Comtrade preview',updated_at:new Date().toISOString()};
}
function countryCatalog(raw){const byM49={};for(const c of raw||[]){if(!c.cca3||!c.ccn3||!Array.isArray(c.latlng))continue;const m49=String(Number(c.ccn3));byM49[m49]={code:c.cca3,name:c.name?.common||c.cca3,flag:c.flag||'',coord:[Number(c.latlng[1])||0,Number(c.latlng[0])||0],m49,region:c.region||''};}return byM49}
function addCountry(state,c){if(!c||state.countries[c.code])return;state.countries[c.code]={name:c.name,flag:c.flag,coord:c.coord,m49:c.m49,region:c.region,power:45,economy:50,energy_security:50,military:42,stability:55,influence:43,fronts:0,pressure:0,max_front:0,stability_live:55,economy_live:50,trade_dependency_risk:0,energy_dependency_risk:0,dependency_coverage:0};}
function exposureCandidates(cache,byM49){
  const out=[];
  for(const [reporterM49,r] of Object.entries(cache.reporters||{})){
    const reporter=byM49[reporterM49];if(!reporter||!r.all?.world)continue;
    const keys=new Set([...Object.keys(r.all?.partners||{}),...Object.keys(r.energy?.partners||{})]);
    const list=[];
    for(const partnerM49 of keys){const partner=byM49[String(Number(partnerM49))];if(!partner||partner.code===reporter.code)continue;
      const trade=pct(r.all?.partners?.[String(Number(partnerM49))]||0,r.all?.world||0),energy=pct(r.energy?.partners?.[String(Number(partnerM49))]||0,r.energy?.world||0);
      if(trade<TRADE_EDGE_THRESHOLD&&energy<ENERGY_EDGE_THRESHOLD)continue;
      const relevance=clamp(25+trade*2.2+energy*2.7,0,100);list.push({reporter,partner,trade:Number(trade.toFixed(2)),energy:Number(energy.toFixed(2)),relevance:Number(relevance.toFixed(1)),period:r.period});
    }
    list.sort((a,b)=>b.relevance-a.relevance);out.push(...list.slice(0,MAX_EXPOSURE_PARTNERS_PER_REPORTER));
  }
  return out;
}
function createExposureEdges(state,cache,byM49){
  const current=state.pairs||[],created=[];
  const seen=new Set(current.map(p=>pairId(p.a,p.b)));
  for(const x of exposureCandidates(cache,byM49).sort((a,b)=>b.relevance-a.relevance)){
    const id=pairId(x.reporter.code,x.partner.code);if(seen.has(id))continue;seen.add(id);addCountry(state,x.reporter);addCountry(state,x.partner);
    const trade=Math.round(clamp(16+x.trade*1.7)),energy=Math.round(clamp(14+x.energy*1.9));
    const tension=Math.round(clamp(10+Math.max(x.trade,x.energy)*.38,8,34));
    const dep={trade:{a_on_b:0,b_on_a:0},energy:{a_on_b:0,b_on_a:0},period:x.period,coverage:.5,source:'UN Comtrade preview',updated_at:new Date().toISOString()};
    const aIsReporter=x.reporter.code===id.split('-')[0];if(aIsReporter){dep.trade.a_on_b=x.trade;dep.energy.a_on_b=x.energy}else{dep.trade.b_on_a=x.trade;dep.energy.b_on_a=x.energy}
    created.push({id,a:id.split('-')[0],b:id.split('-')[1],origin:'dependency-discovery',relation_type:'exposure',strategic_relevance:Math.round(x.relevance),domains:[...(x.energy>=ENERGY_EDGE_THRESHOLD?['energy']:[]),...(x.trade>=TRADE_EDGE_THRESHOLD?['trade']:[])],vector:{diplomatic:12,military:8,territorial:6,trade,energy,domestic:10,information:8},restraints:{economic_interdependence:Math.round(clamp(48+x.trade*2.2+x.energy*1.2,48,95)),alliance_mediation:35,security_cooperation:22,deterrence:30},score:tension,trend:0,dependencies:dep,summary:`Silent dependency edge: ${x.reporter.name} sources ${x.trade.toFixed(1)}% of observed imports and ${x.energy.toFixed(1)}% of HS27 energy imports from ${x.partner.name} in the cached Comtrade period.`,news:[],scan_articles:0,sensor_status:'dependency-cache',drivers:[`Comtrade exposure relevance ${Math.round(x.relevance)}`,`trade dependence ${x.trade.toFixed(1)}%`,`energy dependence ${x.energy.toFixed(1)}%`],bot_moves:[]});
  }
  state.pairs=[...current,...created];return created;
}

async function main(){
  const state=JSON.parse(await fs.readFile(STATE_PATH,'utf8'));const cache=await readCache();cache.version=2;cache.reporters??={};cache.failures??={};
  // Dependency-only edges are rebuilt from cache every cycle so stale exposure does not become permanent.
  state.pairs=(state.pairs||[]).filter(p=>p.origin!=='dependency-discovery');
  const top=(state.pairs||[]).slice().sort((a,b)=>b.score-a.score).slice(0,80);
  const candidates=[...new Set(top.flatMap(p=>[p.a,p.b]))].filter(code=>state.countries?.[code]?.m49);
  const now=Date.now();
  const wanted=candidates.filter(code=>{
    const key=String(Number(state.countries[code].m49)),old=cache.reporters[key],fail=cache.failures[key];
    if(old&&now-new Date(old.updated_at||0).getTime()<TTL)return false;
    if(fail&&now<Number(fail.retry_after||0))return false;
    return true;
  }).slice(0,MAX_REPORTERS_PER_RUN);
  let refreshed=0,failed=0;
  for(const code of wanted){
    const c=state.countries[code],key=String(Number(c.m49));const fresh=await loadReporter(key);
    if(fresh){cache.reporters[key]={...fresh,code,updated_at:new Date().toISOString()};delete cache.failures[key];refreshed++;}
    else{const prev=cache.failures[key]||{};cache.failures[key]={code,attempts:Number(prev.attempts||0)+1,last_failed_at:new Date().toISOString(),retry_after:Date.now()+FAILURE_COOLDOWN};failed++;}
  }
  const rawCountries=await staticJson(COUNTRY_URL,[]),byM49=countryCatalog(rawCountries);
  let enriched=0;
  for(const p of state.pairs||[]){const a=state.countries?.[p.a],b=state.countries?.[p.b];if(!a?.m49||!b?.m49)continue;const dep=pairDependency(a,b,cache);if(!dep.coverage)continue;p.dependencies=dep;enriched++;
    const maxTrade=Math.max(dep.trade.a_on_b,dep.trade.b_on_a),maxEnergy=Math.max(dep.energy.a_on_b,dep.energy.b_on_a),mutual=Math.min(dep.trade.a_on_b,dep.trade.b_on_a);
    p.restraints??={};p.vector??={};p.restraints.economic_interdependence=Math.round(clamp((p.restraints.economic_interdependence||25)*.62+Math.min(95,22+mutual*5+maxTrade*1.7)*.38));p.vector.trade=Math.round(clamp((p.vector.trade||25)+Math.min(15,maxTrade*.65)));p.vector.energy=Math.round(clamp((p.vector.energy||20)+Math.min(22,maxEnergy*.85)));
    p.drivers=[...(p.drivers||[]).filter(x=>!String(x).startsWith('Comtrade:'))];if(maxTrade>=3)p.drivers.push(`Comtrade: bilateral import dependence up to ${maxTrade.toFixed(1)}%`);if(maxEnergy>=3)p.drivers.push(`Comtrade: HS27 energy-import dependence up to ${maxEnergy.toFixed(1)}%`);
  }
  const exposureEdges=createExposureEdges(state,cache,byM49);
  // Recompute country edge pressure after adding silent dependency edges.
  for(const c of Object.values(state.countries||{})){c.fronts=0;c.pressure=0;c.max_front=0;}
  for(const p of state.pairs||[])for(const code of [p.a,p.b]){const c=state.countries?.[code];if(!c)continue;c.fronts++;c.pressure+=Number(p.score||0);c.max_front=Math.max(c.max_front,Number(p.score||0));}
  for(const c of Object.values(state.countries||{}))if(c.fronts)c.pressure=Math.round(c.pressure/c.fronts);
  for(const [code,c] of Object.entries(state.countries||{})){
    const fs=(state.pairs||[]).filter(p=>p.a===code||p.b===code);let trade=0,energy=0,n=0;
    for(const p of fs){if(!p.dependencies)continue;const side=p.a===code?'a_on_b':'b_on_a';trade=Math.max(trade,p.dependencies.trade?.[side]||0);energy=Math.max(energy,p.dependencies.energy?.[side]||0);n++;}
    c.trade_dependency_risk=Number(trade.toFixed(1));c.energy_dependency_risk=Number(energy.toFixed(1));c.dependency_coverage=n;
  }
  cache.updated_at=new Date().toISOString();cache.ttl_days=7;cache.failure_cooldown_hours=12;cache.source='UN Comtrade preview API';
  state.dependency_graph={updated_at:new Date().toISOString(),source:'UN Comtrade preview API',cache_ttl_days:7,failure_cooldown_hours:12,trade_edge_threshold_pct:TRADE_EDGE_THRESHOLD,energy_edge_threshold_pct:ENERGY_EDGE_THRESHOLD,reporters_cached:Object.keys(cache.reporters).length,reporters_refreshed:refreshed,reporters_failed:failed,reporters_in_cooldown:Object.values(cache.failures).filter(f=>Date.now()<Number(f.retry_after||0)).length,relationships_enriched:enriched,exposure_edges_created:exposureEdges.length,remaining_candidate_reporters:candidates.filter(code=>!cache.reporters[String(Number(state.countries[code].m49))]).length,note:'Dependency edges are typed EXPOSURE, not tensions. They appear when bilateral import share >=5% or HS27 energy share >=8%. Fetch rotation skips rate-limited reporters temporarily.'};
  await fs.writeFile(CACHE_PATH,JSON.stringify(cache,null,2)+'\n');await fs.writeFile(STATE_PATH,JSON.stringify(state,null,2)+'\n');
  console.log(`Dependency graph: reporters=${Object.keys(cache.reporters).length}, refreshed=${refreshed}, failed=${failed}, cooldown=${state.dependency_graph.reporters_in_cooldown}, enriched=${enriched}, exposureEdges=${exposureEdges.length}, world=${state.pairs.length}`);
}
main().catch(e=>{console.error(e);process.exitCode=1});

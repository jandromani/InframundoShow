import fs from 'node:fs/promises';

const STATE_PATH=new URL('../data/live.json',import.meta.url);
const CACHE_PATH=new URL('../data/dependencies.json',import.meta.url);
const TIMEOUT=5500;
const TTL=7*86400000;
const MAX_REPORTERS_PER_RUN=18;
const clamp=(x,a=0,b=100)=>Math.max(a,Math.min(b,Number(x)||0));

async function readCache(){try{return JSON.parse(await fs.readFile(CACHE_PATH,'utf8'))}catch{return {version:1,reporters:{}}}}
async function getJson(url){try{const r=await fetch(url,{headers:{'user-agent':'worldstate-dependency/0.1'},signal:AbortSignal.timeout(TIMEOUT)});if(!r.ok)throw new Error(`${r.status}`);return await r.json()}catch(e){console.warn('Comtrade fetch failed',e.name||e.message);return null}}
function value(r){for(const k of ['primaryValue','cifvalue','CIFValue','fobvalue','FOBValue','TradeValue','tradeValue']){const n=Number(r?.[k]);if(Number.isFinite(n))return n}return 0}
function partnerCode(r){return String(r?.partnerCode??r?.PartnerCode??r?.partnerISO??'')}
function rows(j){return Array.isArray(j?.data)?j.data:Array.isArray(j?.dataset)?j.dataset:[]}
async function matrix(reporter,cmd,period){
  const u=new URL('https://comtradeapi.un.org/public/v1/preview/C/A/HS');
  u.searchParams.set('flowCode','M');u.searchParams.set('reporterCode',reporter);u.searchParams.set('period',period);u.searchParams.set('cmdCode',cmd);u.searchParams.set('maxRecords','500');
  const j=await getJson(u);if(!j)return null;const rr=rows(j);if(!rr.length)return null;
  let world=0;const partners={};
  for(const r of rr){const p=partnerCode(r),v=value(r);if(!v)continue;if(p==='0'||p==='W00'||String(r?.partnerDesc||'').toLowerCase()==='world')world=Math.max(world,v);else partners[p]=(partners[p]||0)+v;}
  if(!world)world=Object.values(partners).reduce((a,b)=>a+b,0);
  return {world,partners,rows:rr.length};
}
async function loadReporter(m49){
  const periods=['2025','2024'];
  for(const period of periods){
    const [all,energy]=await Promise.all([matrix(m49,'TOTAL',period),matrix(m49,'27',period)]);
    if(all?.world)return {period,all,energy:energy||{world:0,partners:{},rows:0},source:'UN Comtrade preview'};
  }
  return null;
}
function pct(n,d){return d>0?clamp(n/d*100,0,100):0}
function pairDependency(a,b,cache){
  const aa=cache.reporters?.[a.m49],bb=cache.reporters?.[b.m49];
  const aTrade=aa?pct(aa.all?.partners?.[b.m49]||0,aa.all?.world||0):0;
  const bTrade=bb?pct(bb.all?.partners?.[a.m49]||0,bb.all?.world||0):0;
  const aEnergy=aa?pct(aa.energy?.partners?.[b.m49]||0,aa.energy?.world||0):0;
  const bEnergy=bb?pct(bb.energy?.partners?.[a.m49]||0,bb.energy?.world||0):0;
  const coverage=[aa,bb].filter(Boolean).length/2;
  return {trade:{a_on_b:Number(aTrade.toFixed(2)),b_on_a:Number(bTrade.toFixed(2))},energy:{a_on_b:Number(aEnergy.toFixed(2)),b_on_a:Number(bEnergy.toFixed(2))},period:aa?.period||bb?.period||null,coverage,source:'UN Comtrade preview',updated_at:new Date().toISOString()};
}

async function main(){
  const state=JSON.parse(await fs.readFile(STATE_PATH,'utf8'));const cache=await readCache();cache.reporters??={};
  const top=(state.pairs||[]).slice().sort((a,b)=>b.score-a.score).slice(0,50);
  const wanted=[...new Set(top.flatMap(p=>[p.a,p.b]))].filter(code=>state.countries?.[code]?.m49).slice(0,MAX_REPORTERS_PER_RUN);
  let refreshed=0;
  for(const code of wanted){const c=state.countries[code],old=cache.reporters[c.m49];if(old&&Date.now()-new Date(old.updated_at||0).getTime()<TTL)continue;const fresh=await loadReporter(c.m49);if(fresh){cache.reporters[c.m49]={...fresh,code,updated_at:new Date().toISOString()};refreshed++;}}
  let enriched=0;
  for(const p of state.pairs||[]){const a=state.countries?.[p.a],b=state.countries?.[p.b];if(!a?.m49||!b?.m49)continue;const dep=pairDependency(a,b,cache);if(!dep.coverage)continue;p.dependencies=dep;enriched++;
    const maxTrade=Math.max(dep.trade.a_on_b,dep.trade.b_on_a),maxEnergy=Math.max(dep.energy.a_on_b,dep.energy.b_on_a),mutual=Math.min(dep.trade.a_on_b,dep.trade.b_on_a);
    p.restraints??={};p.vector??={};
    p.restraints.economic_interdependence=Math.round(clamp((p.restraints.economic_interdependence||25)*.62+Math.min(95,22+mutual*5+maxTrade*1.7)*.38));
    p.vector.trade=Math.round(clamp((p.vector.trade||25)+Math.min(15,maxTrade*.65)));
    p.vector.energy=Math.round(clamp((p.vector.energy||20)+Math.min(22,maxEnergy*.85)));
    p.drivers=[...(p.drivers||[]).filter(x=>!String(x).startsWith('Comtrade:'))];
    if(maxTrade>=3)p.drivers.push(`Comtrade: bilateral import dependence up to ${maxTrade.toFixed(1)}%`);
    if(maxEnergy>=3)p.drivers.push(`Comtrade: HS27 energy-import dependence up to ${maxEnergy.toFixed(1)}%`);
  }
  for(const [code,c] of Object.entries(state.countries||{})){
    const fs=(state.pairs||[]).filter(p=>p.a===code||p.b===code);let trade=0,energy=0,n=0;
    for(const p of fs){if(!p.dependencies)continue;const side=p.a===code?'a_on_b':'b_on_a';trade=Math.max(trade,p.dependencies.trade?.[side]||0);energy=Math.max(energy,p.dependencies.energy?.[side]||0);n++;}
    c.trade_dependency_risk=Number(trade.toFixed(1));c.energy_dependency_risk=Number(energy.toFixed(1));c.dependency_coverage=n;
  }
  cache.updated_at=new Date().toISOString();cache.ttl_days=7;cache.source='UN Comtrade preview API';
  state.dependency_graph={updated_at:new Date().toISOString(),source:'UN Comtrade preview API',cache_ttl_days:7,reporters_cached:Object.keys(cache.reporters).length,reporters_refreshed:refreshed,relationships_enriched:enriched,note:'Bilateral import shares are derived from latest available annual preview data; energy uses HS chapter 27.'};
  await fs.writeFile(CACHE_PATH,JSON.stringify(cache,null,2)+'\n');await fs.writeFile(STATE_PATH,JSON.stringify(state,null,2)+'\n');
  console.log(`Dependency graph: reporters=${Object.keys(cache.reporters).length}, refreshed=${refreshed}, edges=${enriched}`);
}
main().catch(e=>{console.error(e);process.exitCode=1});

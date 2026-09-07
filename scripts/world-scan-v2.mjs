import fs from 'node:fs/promises';

const MODEL_PATH = new URL('../config/world-model.json', import.meta.url);
const STATE_PATH = new URL('../data/live.json', import.meta.url);
const GEARWATCH_RAW = 'https://raw.githubusercontent.com/jandromani/HolaInframundo/master/';
const FETCH_TIMEOUT_MS = 7000;
const GDELT_TIMEOUT_MS = 2500;
const LLM_TIMEOUT_MS = 30000;
const clamp=(x,a=0,b=100)=>Math.max(a,Math.min(b,Number(x)||0));

const DIM_KEYWORDS={
  diplomatic:['diplomat','talks','negotiat','sanction','ambassador','summit','agreement','ceasefire','mediat','relations','treaty','ultimatum'],
  military:['attack','strike','missile','military','troops','drone','war','navy','air force','army','weapon','intercept','mobiliz','exercise','defen','nuclear'],
  territorial:['border','territor','sovereignty','island','maritime','waters','kashmir','sahara','essequibo','ceuta','melilla','taiwan','cyprus','ladakh'],
  trade:['trade','tariff','export','import','shipping','supply chain','port','cargo','freight','commerce','semiconductor','chip','market'],
  energy:['oil','gas','lng','energy','pipeline','refin','diesel','power','electric','hormuz','tanker'],
  domestic:['election','protest','parliament','government','president','prime minister','poll','opposition','public','migrant','migration','unrest'],
  information:['cyber','disinformation','propaganda','media','influence','intelligence','hack','information','leak','narrative']
};
const ESCALATE=['attack','strike','war','missile','blockade','threat','clash','military','sanction','mobiliz','incursion','killed','deadly','crisis','warning','ultimatum','protest','nuclear','intercept','sovereignty'];
const DEESCALATE=['ceasefire','talks','negotiat','agreement','deal','reopen','dialogue','de-escal','withdraw','truce','mediat','cooperation','corridor','peace'];

async function fetchText(url,timeoutMs=FETCH_TIMEOUT_MS){
  try{
    const r=await fetch(url,{headers:{'user-agent':'worldstate-live/0.2'},signal:AbortSignal.timeout(timeoutMs)});
    if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);
    return await r.text();
  }catch(err){console.warn('text fetch failed',url,err.name||err.message);return ''}
}
async function fetchJson(url,fallback={},timeoutMs=FETCH_TIMEOUT_MS){
  const t=await fetchText(url,timeoutMs);if(!t)return fallback;try{return JSON.parse(t)}catch{return fallback}
}
function decodeXml(s=''){return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>')}
function tag(block,name){const m=block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`,'i'));return decodeXml(m?.[1]?.trim()||'')}
function parseRss(xml){
  const items=xml.match(/<item>[\s\S]*?<\/item>/gi)||[];
  return items.map(x=>{const title=tag(x,'title'),url=tag(x,'link'),seen=tag(x,'pubDate');const sm=title.match(/ - ([^-]+)$/);return{title,source:sm?.[1]||'Google News',url,seen:seen?new Date(seen).toISOString():''}}).filter(x=>x.title&&x.url);
}
function uniq(items){const seen=new Set();return items.filter(x=>{const k=(x.url||x.title||'').trim();if(!k||seen.has(k))return false;seen.add(k);return true})}
async function googleNews(pair){
  const q=encodeURIComponent(pair.query+' when:7d');
  const xml=await fetchText(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`);
  return uniq(parseRss(xml)).slice(0,50);
}
async function gdelt(pair){
  const params=new URLSearchParams({query:pair.query,mode:'ArtList',maxrecords:'30',format:'json',timespan:'7d',sort:'HybridRel'});
  const j=await fetchJson(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`,{articles:[]},GDELT_TIMEOUT_MS);
  return uniq((j.articles||[]).map(a=>({title:a.title||'',source:a.domain||'GDELT',url:a.url||'',seen:a.seendate||''}))).slice(0,30);
}
function textDirection(title=''){
  const t=title.toLowerCase();let v=0;for(const w of ESCALATE)if(t.includes(w))v+=1;for(const w of DEESCALATE)if(t.includes(w))v-=1.25;return v;
}
function dimensionSignals(articles){
  const out=Object.fromEntries(Object.keys(DIM_KEYWORDS).map(k=>[k,0]));
  for(const a of articles){const t=(a.title||'').toLowerCase(),dir=textDirection(t);for(const [dim,words] of Object.entries(DIM_KEYWORDS)){const hits=words.reduce((n,w)=>n+(t.includes(w)?1:0),0);if(hits)out[dim]+=hits*(1+Math.max(-.7,Math.min(1.6,dir*.18)))}}
  return out;
}
function normalizeDimension(base,signal,volume){
  if(!volume)return base;
  const observed=clamp(base+(Math.log2(volume+1)*2.3)+(Math.min(18,signal*1.1)));
  return observed;
}
function avgRestraint(r={}){const a=Object.values(r).map(Number).filter(Number.isFinite);return a.length?a.reduce((x,y)=>x+y,0)/a.length:0}
function relationOverall(vector,restraints,gearPressure=0){
  const w={diplomatic:.17,military:.23,territorial:.18,trade:.10,energy:.09,domestic:.11,information:.07};
  let raw=Object.entries(w).reduce((s,[k,x])=>s+clamp(vector[k])*x,0)+clamp(gearPressure,0,30)*.16;
  raw-=avgRestraint(restraints)*.055;
  return clamp(raw);
}
function gearImpactForPair(pairId,mechanisms,map){
  const impacts=[];const domainPressure={};let pressure=0;
  for(const m of mechanisms){const cfg=map[m.id];if(!cfg?.pairs?.includes(pairId))continue;const strength=clamp(m.score)/100;let local=0;for(const [dim,coef] of Object.entries(cfg.domains||{})){const v=strength*Number(coef)*30;domainPressure[dim]=(domainPressure[dim]||0)+v;local+=v}pressure+=local;impacts.push({id:m.id,label:m.label,score:m.score,state:m.state,delta:m.delta,pressure:Math.round(local*10)/10})}
  return{pressure:Math.min(30,pressure),domainPressure,impacts:impacts.sort((a,b)=>b.pressure-a.pressure).slice(0,5)};
}
function driverList(vector,gearImpacts){
  const dims=Object.entries(vector).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>`${k} ${Math.round(v)}`);
  return [...dims,...gearImpacts.slice(0,2).map(x=>`GearWatch: ${x.label} ${Math.round(x.score)}`)];
}
async function readGearWatch(model){
  const [cfg,current,brief]=await Promise.all([
    fetchJson(GEARWATCH_RAW+'config/mechanisms.json',{mechanisms:[]}),
    fetchJson(GEARWATCH_RAW+'data/current.json',{mechanisms:{}}),
    fetchJson(GEARWATCH_RAW+'data/daily-briefing.json',{})
  ]);
  const labels=Object.fromEntries((cfg.mechanisms||[]).map(m=>[m.id,m.label||m.id]));
  const mechanisms=Object.entries(current.mechanisms||{}).map(([id,m])=>({id,label:labels[id]||id,score:Number(m.score||0),state:m.state||'UNKNOWN',delta:Number(m.score_delta||0),map:model.gearwatch_map?.[id]||null})).sort((a,b)=>b.score-a.score);
  return{source:'jandromani/HolaInframundo',updated_at:current.updated_at||current.generated_at||null,headline:brief.headline||'GearWatch causal radar connected',briefing:brief.briefing||brief.executive||'',mechanisms:mechanisms.slice(0,26)};
}
function fallbackBotMoves(pair,countries,vector){
  const a=countries[pair.a],b=countries[pair.b];const top=Object.entries(vector).sort((x,y)=>y[1]-x[1])[0]?.[0]||'diplomatic';
  if(top==='military')return[`${a.name}: preserve deterrence while controlling escalation`,`${b.name}: reinforce readiness and seek external support`];
  if(top==='territorial')return[`${a.name}: harden sovereignty position while testing negotiation space`,`${b.name}: internationalise the dispute and reinforce claims`];
  if(top==='trade'||top==='energy')return[`${a.name}: diversify exposure and use economic leverage`,`${b.name}: protect supply chains and seek substitute partners`];
  return[`${a.name}: combine diplomatic signalling with domestic positioning`,`${b.name}: preserve bargaining leverage without forcing rupture`];
}
async function synthesize(pairs,countries){
  const key=process.env.OPENROUTER_API_KEY;if(!key)return null;const model=process.env.OPENROUTER_MODEL||'openai/gpt-oss-20b';
  const compact=pairs.map(p=>({id:p.id,a:countries[p.a].name,b:countries[p.b].name,score:p.score,vector:p.vector,restraints:p.restraints,drivers:p.drivers,headlines:p.news.slice(0,4).map(n=>n.title)}));
  const prompt=`You are the editorial layer of a geopolitical simulation. Return STRICT JSON {"pairs":[{"id":"...","summary":"two factual sentences; mark inference as inference","bot_moves":["...","..."]}]}. Do not invent events. Bot moves are simulated likely strategic options, not factual predictions. Input=${JSON.stringify(compact)}`;
  try{const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json','x-title':'WORLDSTATE Live'},body:JSON.stringify({model,messages:[{role:'user',content:prompt}],temperature:.12,response_format:{type:'json_object'}}),signal:AbortSignal.timeout(LLM_TIMEOUT_MS)});if(!r.ok)throw new Error(`${r.status} ${await r.text()}`);const j=await r.json();return JSON.parse(j.choices?.[0]?.message?.content||'{}')}catch(err){console.warn('LLM failed',err.name||err.message);return null}
}
function chokepointState(model,pairs,gear){
  const by=Object.fromEntries(pairs.map(p=>[p.id,p]));const linked={HORMUZ:['USA-IRN','ISR-IRN'],SUEZ:['USA-IRN','ISR-IRN','RUS-UKR'],BAB:['USA-IRN','ISR-IRN','ETH-ERI'],MALACCA:['CHN-TWN','USA-CHN','CHN-PHL'],GIBRALTAR:['ESP-MAR','MAR-DZA'],PANAMA:['USA-CHN','VEN-GUY']};
  return(model.chokepoints||[]).map(c=>{const rel=(linked[c.id]||[]).map(id=>by[id]?.score).filter(Number.isFinite);const tension=rel.length?rel.reduce((a,b)=>a+b,0)/rel.length:40;let gw=0;for(const m of gear.mechanisms){if(model.gearwatch_map?.[m.id]?.chokes?.includes(c.id))gw+=clamp(m.score)/100*8}return{...c,score:Math.round(clamp(c.base*.45+tension*.45+Math.min(18,gw))),gearwatch_pressure:Math.round(gw*10)/10}})
}
function countriesState(model,pairs){
  const out={};for(const [code,c] of Object.entries(model.countries)){const fronts=pairs.filter(p=>p.a===code||p.b===code);const pressure=fronts.length?fronts.reduce((s,p)=>s+p.score,0)/fronts.length:20;const max=fronts.length?Math.max(...fronts.map(p=>p.score)):20;out[code]={...c,fronts:fronts.length,pressure:Math.round(pressure),max_front:Math.round(max),stability_live:Math.round(clamp(c.stability-(pressure-50)*.11)),economy_live:Math.round(clamp(c.economy-(pressure-50)*.045))}}return out
}
function globalState(pairs,chokes,countries){
  const scores=pairs.map(p=>p.score),avg=scores.reduce((a,b)=>a+b,0)/Math.max(1,scores.length),hot=Math.max(...scores);const cs=Object.values(chokes),ship=cs.reduce((s,c)=>s+c.score,0)/Math.max(1,cs.length);const energy=cs.filter(c=>c.domains.includes('energy')).reduce((s,c,_,a)=>s+c.score/a.length,0)||50;const trade=cs.filter(c=>c.domains.includes('trade')).reduce((s,c,_,a)=>s+c.score/a.length,0)||50;const stability=Object.values(countries).reduce((s,c)=>s+c.stability_live,0)/Math.max(1,Object.keys(countries).length);return{risk:Math.round(clamp(avg*.58+hot*.42)),shipping_stress:Math.round(ship),energy_stress:Math.round(energy),trade_stress:Math.round(trade),political_stress:Math.round(clamp(100-stability))}}
async function mapLimit(items,limit,fn){const out=new Array(items.length);let next=0;async function worker(){while(true){const i=next++;if(i>=items.length)return;out[i]=await fn(items[i],i)}}await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));return out}

async function main(){
  const model=JSON.parse(await fs.readFile(MODEL_PATH,'utf8'));let old={};try{old=JSON.parse(await fs.readFile(STATE_PATH,'utf8'))}catch{};const oldBy=Object.fromEntries((old.pairs||[]).map(p=>[p.id,p]));
  const gearwatch=await readGearWatch(model);
  const pairs=await mapLimit(model.pairs,5,async pair=>{
    const prior=oldBy[pair.id]||{};const [rss,gd]=await Promise.all([googleNews(pair),gdelt(pair)]);const news=uniq([...rss,...gd]).sort((a,b)=>String(b.seen).localeCompare(String(a.seen))).slice(0,10);const sig=dimensionSignals(news);const volume=news.length;const gear=gearImpactForPair(pair.id,gearwatch.mechanisms,model.gearwatch_map||{});const vector={};
    for(const dim of model.dimensions){const base=Number(prior.vector?.[dim]??pair.vector?.[dim]??50);const observed=normalizeDimension(Number(pair.vector?.[dim]??base),sig[dim]||0,volume);const withGear=clamp(observed+(gear.domainPressure[dim]||0));vector[dim]=Math.round(clamp(base*.68+withGear*.32))}
    const observedOverall=relationOverall(vector,pair.restraints,gear.pressure);const priorScore=Number(prior.score??pair.floor);const score=Math.round(clamp(priorScore*.66+Math.max(pair.floor,observedOverall)*.34));
    return{...pair,score,trend:score-priorScore,vector,restraints:pair.restraints,gearwatch_pressure:Math.round(gear.pressure*10)/10,gearwatch_impacts:gear.impacts,drivers:driverList(vector,gear.impacts),summary:news[0]?.title?`Latest signal: ${news[0].title}`:(prior.summary||'No fresh material signal; relation memory retained.'),news:news.length?news:(prior.news||[]).slice(0,10),scan_articles:news.length,sensor_status:news.length?'fresh':'fallback-memory',sensors:{google_news:rss.length,gdelt:gd.length},bot_moves:fallbackBotMoves(pair,model.countries,vector)};
  });
  const ai=await synthesize(pairs,model.countries);if(ai?.pairs){const by=Object.fromEntries(ai.pairs.map(x=>[x.id,x]));for(const p of pairs){if(by[p.id]?.summary)p.summary=by[p.id].summary;if(Array.isArray(by[p.id]?.bot_moves))p.bot_moves=by[p.id].bot_moves.slice(0,3)}}
  const chokes=chokepointState(model,pairs,gearwatch);const countries=countriesState(model,pairs);const now=new Date().toISOString();const history=[...(old.history||[]),{at:now,scores:Object.fromEntries(pairs.map(p=>[p.id,p.score])),global_risk:null}].slice(-168);const global=globalState(pairs,chokes,countries);history[history.length-1].global_risk=global.risk;
  const next={version:3,updated_at:now,mode:ai?'live-llm':'live-deterministic',disclaimer:'Research/simulation indices, not probabilities, forecasts or intelligence assessments.',dimensions:model.dimensions,restraint_dimensions:model.restraints,global,countries,pairs,chokepoints:chokes,gearwatch:{...gearwatch,mechanisms:gearwatch.mechanisms.map(m=>({...m,impact_map:model.gearwatch_map?.[m.id]||null}))},history};
  await fs.writeFile(STATE_PATH,JSON.stringify(next,null,2)+'\n');console.log(`WORLD//STATE V2: pairs=${pairs.length} fresh=${pairs.filter(p=>p.sensor_status==='fresh').length} rss=${pairs.reduce((s,p)=>s+(p.sensors.google_news||0),0)} gdelt=${pairs.reduce((s,p)=>s+(p.sensors.gdelt||0),0)} gear=${gearwatch.mechanisms.length} mode=${next.mode}`)
}
main().catch(err=>{console.error(err);process.exitCode=1});

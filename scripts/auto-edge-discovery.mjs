import fs from 'node:fs/promises';

const STATE_PATH=new URL('../data/live.json',import.meta.url);
const MEMORY_PATH=new URL('../data/auto-edges.json',import.meta.url);
const COUNTRY_URL='https://raw.githubusercontent.com/mledoze/countries/master/countries.json';
const TIMEOUT=6500;
const MAX_AUTO_EDGES=120;
const MIN_EDGE_SCORE=13;
const ACTIVE_EDGE_SCORE=20;
const HOUR=3600000;

const QUERIES=[
  'international tensions military border sanctions war when:2d',
  'countries diplomatic crisis ambassador sanctions talks when:2d',
  'trade tariffs export controls countries dispute when:2d',
  'oil gas LNG energy countries dispute shipping when:2d',
  'maritime dispute navy coast guard countries when:2d',
  'election protest government foreign policy countries when:2d',
  'cyber espionage disinformation countries government when:2d',
  'missile nuclear military exercise countries when:2d',
  'migration border crisis countries when:2d',
  'peace talks ceasefire mediation countries when:2d'
];

const THEME_WORDS={
  diplomatic:['diplomat','ambassador','sanction','talk','negotiat','summit','relations','agreement','ceasefire','mediat','ultimatum'],
  military:['war','military','attack','strike','missile','troop','navy','army','drone','weapon','exercise','intercept','nuclear'],
  territorial:['border','territor','sovereignty','island','maritime','waters','dispute','corridor'],
  trade:['trade','tariff','export','import','chip','semiconductor','supply chain','commerce','market'],
  energy:['oil','gas','lng','energy','pipeline','refin','diesel','tanker','electric'],
  domestic:['election','protest','government','parliament','president','opposition','migration','migrant','unrest'],
  information:['cyber','hack','espionage','disinformation','propaganda','intelligence','media','leak']
};
const ESCALATE=['war','attack','strike','missile','blockade','threat','clash','sanction','mobiliz','incursion','killed','deadly','crisis','ultimatum','nuclear','intercept','sovereignty'];
const DEESCALATE=['ceasefire','talk','negotiat','agreement','deal','dialogue','de-escal','withdraw','truce','mediat','cooperation','peace'];
const ALIAS_STOP=new Set(['united','republic','state','states','islands','island','georgia','jersey','china']);
const clamp=(x,a=0,b=100)=>Math.max(a,Math.min(b,Number(x)||0));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();

async function text(url,timeout=TIMEOUT){try{const r=await fetch(url,{headers:{'user-agent':'worldstate-edge-discovery/0.1'},signal:AbortSignal.timeout(timeout)});if(!r.ok)throw new Error(String(r.status));return await r.text()}catch(e){console.warn('fetch failed',e.name||e.message,url);return ''}}
async function json(url,fallback){const t=await text(url);if(!t)return fallback;try{return JSON.parse(t)}catch{return fallback}}
function decodeXml(s=''){return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>')}
function tag(block,name){const m=block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`,'i'));return decodeXml(m?.[1]?.trim()||'')}
function parseRss(xml){return (xml.match(/<item>[\s\S]*?<\/item>/gi)||[]).map(x=>({title:tag(x,'title'),url:tag(x,'link'),seen:tag(x,'pubDate')})).filter(x=>x.title)}
async function rss(q){const u='https://news.google.com/rss/search?q='+encodeURIComponent(q)+'&hl=en-US&gl=US&ceid=US:en';return parseRss(await text(u))}
async function readMemory(){try{return JSON.parse(await fs.readFile(MEMORY_PATH,'utf8'))}catch{return {version:1,edges:{}}}}

function countryCatalog(raw,state){
  const out={};
  for(const c of raw||[]){
    const code=c.cca3;if(!code||!c.name?.common||!Array.isArray(c.latlng))continue;
    const aliases=[c.name.common,c.name.official,...(c.altSpellings||[])].map(norm).filter(a=>a.length>=4&&!ALIAS_STOP.has(a));
    out[code]={code,name:c.name.common,official:c.name.official,flag:c.flag||'',coord:[Number(c.latlng[1])||0,Number(c.latlng[0])||0],m49:c.ccn3||null,region:c.region||'',subregion:c.subregion||'',aliases:[...new Set(aliases)]};
  }
  // Preserve canonical names/flags/coords already curated in WORLD//STATE.
  for(const [code,c] of Object.entries(state.countries||{})){
    out[code]??={code,name:c.name||code,flag:c.flag||'',coord:c.coord||[0,0],m49:c.m49||null,region:c.region||'',aliases:[norm(c.name||code)]};
    out[code].name=c.name||out[code].name;out[code].flag=c.flag||out[code].flag;out[code].coord=c.coord||out[code].coord;
  }
  // Common geopolitical aliases that are especially useful in headlines.
  const extra={USA:['us','u s','america','washington'],GBR:['uk','u k','britain','british'],RUS:['moscow'],CHN:['beijing','prc'],TWN:['taipei'],PRK:['north korea','pyongyang'],KOR:['south korea','seoul'],COD:['dr congo','drc','congo kinshasa'],COG:['republic of congo','congo brazzaville'],CIV:['ivory coast'],TUR:['turkey','turkiye'],CZE:['czech republic'],MMR:['burma','myanmar'],SWZ:['eswatini','swaziland'],MKD:['north macedonia'],PSE:['palestine','palestinian territories'],IRN:['tehran'],ISR:['tel aviv']};
  for(const [code,arr] of Object.entries(extra))if(out[code])out[code].aliases=[...new Set([...(out[code].aliases||[]),...arr.map(norm)])];
  return out;
}
function mentions(title,catalog){
  const t=' '+norm(title)+' ';const found=[];
  for(const c of Object.values(catalog)){
    const ok=(c.aliases||[]).some(a=>a.length>=4&&t.includes(' '+a+' '));
    if(ok)found.push(c.code);
  }
  return [...new Set(found)];
}
function themes(title){const t=norm(title),out={};for(const [k,words] of Object.entries(THEME_WORDS)){const n=words.filter(w=>t.includes(w)).length;if(n)out[k]=n}return out}
function directional(title){const t=norm(title);let s=0;for(const w of ESCALATE)if(t.includes(w))s+=1;for(const w of DEESCALATE)if(t.includes(w))s-=1;return s}
function pairId(a,b){return [a,b].sort().join('-')}
function defaultVector(signal){const v={diplomatic:28,military:20,territorial:18,trade:20,energy:15,domestic:18,information:15};for(const [k,n] of Object.entries(signal.themes||{}))v[k]=clamp(v[k]+Math.min(48,n*9));if(signal.escalation>0){v.diplomatic=clamp(v.diplomatic+signal.escalation*3);v.military=clamp(v.military+signal.escalation*4)}return v}
function defaultRestraints(a,b){return {economic_interdependence:30,alliance_mediation:42,security_cooperation:18,deterrence:48}}

async function main(){
  const state=JSON.parse(await fs.readFile(STATE_PATH,'utf8'));
  const memory=await readMemory();
  const rawCountries=await json(COUNTRY_URL,[]);
  const catalog=countryCatalog(rawCountries,state);
  const batches=await Promise.all(QUERIES.map(rss));
  const articles=[];const seen=new Set();
  for(const batch of batches)for(const a of batch){const k=a.url||a.title;if(!k||seen.has(k))continue;seen.add(k);articles.push(a)}
  const observed={};
  for(const a of articles){
    const cs=mentions(a.title,catalog);if(cs.length<2||cs.length>5)continue;
    const th=themes(a.title),dir=directional(a.title);
    for(let i=0;i<cs.length;i++)for(let j=i+1;j<cs.length;j++){
      const id=pairId(cs[i],cs[j]);const x=observed[id]??={id,a:[cs[i],cs[j]].sort()[0],b:[cs[i],cs[j]].sort()[1],hits:0,sources:new Set(),themes:{},escalation:0,evidence:[]};
      x.hits++;const sm=a.title.match(/ - ([^-]+)$/);if(sm?.[1])x.sources.add(sm[1]);x.escalation+=dir;
      for(const [k,n] of Object.entries(th))x.themes[k]=(x.themes[k]||0)+n;
      if(x.evidence.length<6)x.evidence.push(a);
    }
  }
  const now=Date.now();const prev=memory.edges||{};const next={};
  for(const [id,p] of Object.entries(prev)){
    const age=Math.max(1,(now-new Date(p.updated_at||0).getTime())/HOUR);const decay=Math.pow(.985,Math.min(age,168));const score=(Number(p.score)||0)*decay;if(score>=5)next[id]={...p,score:Number(score.toFixed(1)),fresh_hits:0};
  }
  for(const x of Object.values(observed)){
    const sourceDiversity=x.sources.size;const themeBreadth=Object.keys(x.themes).length;
    const evidenceScore=Math.min(75,x.hits*6+sourceDiversity*3+themeBreadth*2+Math.max(0,x.escalation)*1.8);
    const old=next[x.id];const score=clamp((old?.score||0)*.68+evidenceScore*.55,0,100);
    next[x.id]={id:x.id,a:x.a,b:x.b,score:Number(score.toFixed(1)),fresh_hits:x.hits,source_diversity:sourceDiversity,themes:x.themes,escalation:x.escalation,evidence:x.evidence,first_seen:old?.first_seen||new Date().toISOString(),updated_at:new Date().toISOString()};
  }
  const ranked=Object.values(next).filter(x=>x.score>=MIN_EDGE_SCORE).sort((a,b)=>b.score-a.score).slice(0,MAX_AUTO_EDGES);
  const fixedIds=new Set((state.pairs||[]).filter(p=>p.origin!=='auto-discovery').map(p=>p.id));
  const keepFixed=(state.pairs||[]).filter(p=>p.origin!=='auto-discovery');
  const auto=[];
  for(const e of ranked){
    if(fixedIds.has(e.id)||e.score<ACTIVE_EDGE_SCORE)continue;
    const ca=catalog[e.a],cb=catalog[e.b];if(!ca||!cb)continue;
    const old=(state.pairs||[]).find(p=>p.id===e.id);
    const v=old?.vector||defaultVector(e);for(const [k,n] of Object.entries(e.themes||{}))v[k]=clamp((v[k]||20)*.78+Math.min(95,24+n*7)*.22);
    const score=Math.round(clamp((e.score*.58)+Object.values(v).reduce((s,n)=>s+n,0)/7*.42));
    auto.push({id:e.id,a:e.a,b:e.b,origin:'auto-discovery',discovered_at:e.first_seen,evidence_score:e.score,source_diversity:e.source_diversity,fresh_hits:e.fresh_hits,domains:Object.entries(e.themes||{}).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k])=>k),vector:v,restraints:old?.restraints||defaultRestraints(e.a,e.b),score,trend:old?score-old.score:0,summary:e.evidence?.[0]?.title?`Auto-discovered from repeated public-news co-occurrence. Latest: ${e.evidence[0].title}`:'Auto-discovered geopolitical relationship.',news:(e.evidence||[]).map(x=>({title:x.title,url:x.url,seen:x.seen,source:(x.title.match(/ - ([^-]+)$/)?.[1]||'Google News')})),scan_articles:e.fresh_hits||0,sensor_status:e.fresh_hits?'fresh':'memory',drivers:[`auto-edge evidence ${Math.round(e.score)}`,`source diversity ${e.source_diversity||0}`],bot_moves:old?.bot_moves||[]});
    for(const code of [e.a,e.b])if(!state.countries?.[code]){const c=catalog[code];state.countries[code]={name:c.name,flag:c.flag,coord:c.coord,m49:c.m49,region:c.region,power:45,economy:50,energy_security:50,military:45,stability:55,influence:45,fronts:0,pressure:0,max_front:0,stability_live:55,economy_live:50,aliases:c.aliases};}
  }
  // Enrich existing countries with stable numeric codes / aliases for dependency lookups and map resolution.
  for(const [code,c] of Object.entries(state.countries||{})){const cat=catalog[code];if(cat){c.m49??=cat.m49;c.region??=cat.region;c.aliases=[...new Set([...(c.aliases||[]),...(cat.aliases||[])])];}}
  state.pairs=[...keepFixed,...auto];
  for(const c of Object.values(state.countries||{})){c.fronts=0;c.pressure=0;c.max_front=0;}
  for(const p of state.pairs){for(const code of [p.a,p.b]){const c=state.countries?.[code];if(!c)continue;c.fronts++;c.pressure+=Number(p.score||0);c.max_front=Math.max(c.max_front,Number(p.score||0));}}
  for(const c of Object.values(state.countries||{}))if(c.fronts)c.pressure=Math.round(c.pressure/c.fronts);
  state.auto_discovery={updated_at:new Date().toISOString(),catalog_countries:Object.keys(catalog).length,articles_scanned:articles.length,candidate_edges:ranked.length,active_auto_edges:auto.length,total_edges:state.pairs.length,threshold:ACTIVE_EDGE_SCORE};
  await fs.writeFile(MEMORY_PATH,JSON.stringify({version:1,updated_at:new Date().toISOString(),edges:Object.fromEntries(ranked.map(x=>[x.id,x]))},null,2)+'\n');
  await fs.writeFile(STATE_PATH,JSON.stringify(state,null,2)+'\n');
  console.log(`Auto-edge discovery: ${articles.length} articles -> ${ranked.length} candidates -> ${auto.length} live auto edges; world=${state.pairs.length}`);
}
main().catch(e=>{console.error(e);process.exitCode=1});

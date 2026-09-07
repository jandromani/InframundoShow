import fs from 'node:fs/promises';

const STATE_PATH = new URL('../data/live.json', import.meta.url);
const GEARWATCH_RAW = 'https://raw.githubusercontent.com/jandromani/HolaInframundo/master/';
const FETCH_TIMEOUT_MS = 8_000;
const GDELT_TIMEOUT_MS = 2_500;
const LLM_TIMEOUT_MS = 30_000;

const PAIRS = [
  {id:'ESP-MAR',a:'ESP',b:'MAR',floor:61,query:'(Spain Morocco OR Ceuta Morocco OR Melilla Morocco)'},
  {id:'MAR-DZA',a:'MAR',b:'DZA',floor:62,query:'(Morocco Algeria OR Western Sahara Algeria Morocco)'},
  {id:'USA-IRN',a:'USA',b:'IRN',floor:72,query:'(United States Iran OR US Iran OR Hormuz Iran United States)'},
  {id:'CHN-TWN',a:'CHN',b:'TWN',floor:72,query:'(China Taiwan OR Taiwan Strait)'},
  {id:'RUS-UKR',a:'RUS',b:'UKR',floor:88,query:'(Russia Ukraine war)'},
  {id:'PRK-KOR',a:'PRK',b:'KOR',floor:67,query:'(North Korea South Korea OR Korean peninsula missile)'},
  {id:'CHN-PHL',a:'CHN',b:'PHL',floor:58,query:'(China Philippines South China Sea)'},
  {id:'IND-PAK',a:'IND',b:'PAK',floor:54,query:'(India Pakistan tensions OR Kashmir India Pakistan)'},
  {id:'SRB-BIH',a:'SRB',b:'BIH',floor:48,query:'(Serbia Bosnia tensions OR Republika Srpska Serbia Bosnia)'},
  {id:'COD-RWA',a:'COD',b:'RWA',floor:60,query:'(Congo Rwanda tensions OR DRC Rwanda M23)'},
  {id:'ISR-IRN',a:'ISR',b:'IRN',floor:78,query:'(Israel Iran conflict OR Israel Iran strikes)'},
  {id:'VEN-GUY',a:'VEN',b:'GUY',floor:43,query:'(Venezuela Guyana Essequibo)'}
];

const ESCALATE = [
  ['attack',5],['strike',5],['war',5],['missile',4],['blockade',5],['threat',3],['clash',4],['military',2],
  ['sanction',2],['mobiliz',3],['incursion',4],['killed',4],['deadly',4],['crisis',2],['warning',2],['ultimatum',4],
  ['border',1],['protest',1],['nuclear',3],['restricted zone',4],['intercept',2],['deterr',1],['sovereignty',2]
];
const DEESCALATE = [
  ['ceasefire',-6],['talks',-3],['negotiat',-3],['agreement',-4],['deal',-3],['reopen',-2],['dialogue',-3],
  ['de-escal',-5],['withdraw',-3],['truce',-5],['mediat',-3],['cooperation',-2],['corridor',-2]
];
const clamp=(x,a=0,b=100)=>Math.max(a,Math.min(b,x));

async function request(url, timeoutMs=FETCH_TIMEOUT_MS) {
  return fetch(url,{
    headers:{
      'user-agent':'worldstate-live/0.2 (+https://github.com/jandromani/InframundoShow)',
      'accept':'application/json, application/rss+xml, application/xml, text/xml, text/plain;q=0.8, */*;q=0.5'
    },
    signal:AbortSignal.timeout(timeoutMs)
  });
}

async function getJson(url, fallback={}, timeoutMs=FETCH_TIMEOUT_MS) {
  try {
    const r=await request(url,timeoutMs);
    if(!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return await r.json();
  } catch(err) {
    console.warn('json fetch failed', url, err.name || err.message);
    return fallback;
  }
}

async function getText(url, fallback='', timeoutMs=FETCH_TIMEOUT_MS) {
  try {
    const r=await request(url,timeoutMs);
    if(!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return await r.text();
  } catch(err) {
    console.warn('text fetch failed', url, err.name || err.message);
    return fallback;
  }
}

function textSignal(title='') {
  const t=title.toLowerCase();
  let s=0;
  for(const [word,w] of ESCALATE) if(t.includes(word)) s+=w;
  for(const [word,w] of DEESCALATE) if(t.includes(word)) s+=w;
  return s;
}

function uniqueArticles(articles=[]) {
  const seen=new Set();
  return articles.filter(a=>{
    const key=(a.url||a.title||'').trim();
    if(!key||seen.has(key)) return false;
    seen.add(key); return true;
  });
}

function decodeXml(s='') {
  return String(s)
    .replace(/<!\[CDATA\[|\]\]>/g,'')
    .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)))
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'")
    .replace(/<[^>]+>/g,'').trim();
}

function xmlTag(block,name) {
  const m=block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,'i'));
  return m?decodeXml(m[1]):'';
}

function parseRss(xml='') {
  const items=[...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map(m=>m[1]);
  return items.map(item=>{
    const title=xmlTag(item,'title');
    const url=xmlTag(item,'link');
    const source=xmlTag(item,'source')||'Google News';
    const rawDate=xmlTag(item,'pubDate');
    const parsed=Date.parse(rawDate);
    return {title,source,url,seen:Number.isFinite(parsed)?new Date(parsed).toISOString():rawDate};
  }).filter(a=>a.title&&a.url);
}

async function googleNews(pair) {
  const params=new URLSearchParams({
    q:`${pair.query} when:7d`,
    hl:'en-US',gl:'US',ceid:'US:en'
  });
  const xml=await getText(`https://news.google.com/rss/search?${params}`,'',FETCH_TIMEOUT_MS);
  return uniqueArticles(parseRss(xml)).slice(0,50);
}

async function gdelt(pair) {
  const params=new URLSearchParams({query:pair.query,mode:'ArtList',maxrecords:'50',format:'json',timespan:'7d',sort:'HybridRel'});
  const url=`https://api.gdeltproject.org/api/v2/doc/doc?${params}`;
  const json=await getJson(url,{articles:[]},GDELT_TIMEOUT_MS);
  const articles=uniqueArticles(json.articles||[]).slice(0,50);
  return articles.map(a=>({
    title:a.title||'',
    source:a.domain||a.sourcecountry||'GDELT source',
    url:a.url||'',
    seen:a.seendate||''
  }));
}

function scorePair(pair, old, articles) {
  const oldScore=Number(old?.score ?? pair.floor);
  if(!articles.length){
    const fallbackScore=Math.round(clamp(oldScore*.985+pair.floor*.015));
    return {score:fallbackScore,trend:fallbackScore-oldScore,observed:null};
  }
  const titleScore=articles.reduce((s,a)=>s+textSignal(a.title),0);
  const volume=Math.min(14,Math.log2(articles.length+1)*3.2);
  const directional=clamp(titleScore,-22,28);
  const observed=clamp(pair.floor+volume+directional*0.72,0,100);
  const blended=clamp(oldScore*0.72+observed*0.28,0,100);
  const score=Math.round(blended);
  return {score,trend:score-oldScore,observed:Math.round(observed)};
}

function fallbackSummary(old, articles) {
  if(articles[0]?.title) return `Latest signal: ${articles[0].title}`;
  return old?.summary || 'No material new signal detected in the current scan window.';
}

async function llmSynthesis(pairs) {
  const key=process.env.OPENROUTER_API_KEY;
  if(!key) return null;
  const model=process.env.OPENROUTER_MODEL || 'openai/gpt-oss-20b';
  const compact=pairs.map(p=>({id:p.id,score:p.score,trend:p.trend,prior:p.summary,headlines:p.news.slice(0,5).map(n=>n.title)}));
  const prompt=`You maintain a geopolitical simulation memory. Given country-pair tension indices and recent headlines, return STRICT JSON only with shape {"pairs":[{"id":"...","summary":"1-2 factual sentences, distinguish evidence from inference","bot_moves":["Actor A likely next move","Actor B likely next move"]}]}. Do not invent events. A bot move is a strategic simulation move, not a factual claim. Keep summaries compact. Input: ${JSON.stringify(compact)}`;
  try {
    const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{
      method:'POST',
      headers:{'authorization':`Bearer ${key}`,'content-type':'application/json','x-title':'WORLDSTATE Live'},
      body:JSON.stringify({model,messages:[{role:'user',content:prompt}],temperature:0.15,response_format:{type:'json_object'}}),
      signal:AbortSignal.timeout(LLM_TIMEOUT_MS)
    });
    if(!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    const j=await r.json();
    const txt=j.choices?.[0]?.message?.content||'';
    return JSON.parse(txt);
  } catch(err) {
    console.warn('LLM synthesis failed:',err.name || err.message);
    return null;
  }
}

async function readGearWatch() {
  const [cfg,current,brief]=await Promise.all([
    getJson(GEARWATCH_RAW+'config/mechanisms.json',{mechanisms:[]}),
    getJson(GEARWATCH_RAW+'data/current.json',{mechanisms:{}}),
    getJson(GEARWATCH_RAW+'data/daily-briefing.json',{})
  ]);
  const labels=Object.fromEntries((cfg.mechanisms||[]).map(m=>[m.id,m.label||m.id]));
  const mechanisms=Object.entries(current.mechanisms||{}).map(([id,m])=>({id,label:labels[id]||id,score:Number(m.score||0),state:m.state||'UNKNOWN',delta:Number(m.score_delta||0)})).sort((a,b)=>b.score-a.score).slice(0,10);
  return {
    source:'jandromani/HolaInframundo',
    updated_at:current.updated_at||current.generated_at||null,
    headline:brief.headline||'GearWatch causal radar connected',
    briefing:brief.briefing||brief.executive||'',
    mechanisms
  };
}

function globalState(pairs) {
  const by=Object.fromEntries(pairs.map(p=>[p.id,p]));
  const avg=pairs.reduce((s,p)=>s+p.score,0)/Math.max(1,pairs.length);
  const hormuz=by['USA-IRN']?.score||50;
  const chinaSea=Math.max(by['CHN-TWN']?.score||0,by['CHN-PHL']?.score||0);
  const war=Math.max(by['RUS-UKR']?.score||0,by['ISR-IRN']?.score||0,hormuz);
  return {
    risk:Math.round(clamp(avg*.55+war*.45)),
    shipping_stress:Math.round(clamp(hormuz*.58+chinaSea*.27+15)),
    energy_stress:Math.round(clamp(hormuz*.65+(by['RUS-UKR']?.score||50)*.22+10)),
    trade_stress:Math.round(clamp(chinaSea*.43+hormuz*.37+12)),
    political_stress:Math.round(clamp((by['ESP-MAR']?.score||50)*.22+(by['SRB-BIH']?.score||50)*.23+avg*.55))
  };
}

async function scanOne(pair, prior){
  const [rssArticles,gdeltArticles]=await Promise.all([googleNews(pair),gdelt(pair)]);
  const articles=uniqueArticles([...rssArticles,...gdeltArticles]);
  const score=scorePair(pair,prior,articles);
  return {
    ...prior,
    id:pair.id,a:pair.a,b:pair.b,
    score:score.score,trend:score.trend,
    observed_signal:score.observed,
    summary:fallbackSummary(prior,articles),
    news:articles.length?articles.slice(0,8):(prior.news||[]).slice(0,8),
    scan_articles:articles.length,
    sensor_status:articles.length?'fresh':'fallback-memory',
    sensors:{google_news:rssArticles.length,gdelt:gdeltArticles.length}
  };
}

async function mapLimit(items, limit, fn){
  const out=new Array(items.length);
  let next=0;
  async function worker(){
    while(true){
      const i=next++;
      if(i>=items.length) return;
      out[i]=await fn(items[i],i);
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));
  return out;
}

async function main(){
  const old=JSON.parse(await fs.readFile(STATE_PATH,'utf8'));
  const oldBy=Object.fromEntries((old.pairs||[]).map(p=>[p.id,p]));
  const pairs=await mapLimit(PAIRS,4,(pair)=>scanOne(pair,oldBy[pair.id]||{}));

  const synthesis=await llmSynthesis(pairs);
  if(synthesis?.pairs){
    const ai=Object.fromEntries(synthesis.pairs.map(x=>[x.id,x]));
    for(const p of pairs){
      if(ai[p.id]?.summary) p.summary=ai[p.id].summary;
      if(Array.isArray(ai[p.id]?.bot_moves)) p.bot_moves=ai[p.id].bot_moves.slice(0,3);
    }
  }

  const now=new Date().toISOString();
  const gearwatch=await readGearWatch();
  const history=[...(old.history||[]),{at:now,scores:Object.fromEntries(pairs.map(p=>[p.id,p.score]))}].slice(-72);
  const next={
    version:2,
    updated_at:now,
    mode:synthesis?'live-llm':'live-deterministic',
    disclaimer:'Tension scores are model indices for exploration, not probabilities or forecasts.',
    global:globalState(pairs),
    pairs,
    gearwatch,
    history
  };
  await fs.writeFile(STATE_PATH,JSON.stringify(next,null,2)+'\n');
  console.log(`WORLD//STATE scan complete: ${pairs.length} pairs, mode=${next.mode}, fresh=${pairs.filter(p=>p.sensor_status==='fresh').length}, rss=${pairs.reduce((s,p)=>s+(p.sensors?.google_news||0),0)}, gdelt=${pairs.reduce((s,p)=>s+(p.sensors?.gdelt||0),0)}`);
}

main().catch(err=>{console.error(err);process.exitCode=1;});

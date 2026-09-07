import fs from 'node:fs/promises';
const STATE_PATH=new URL('../data/live.json',import.meta.url);
const clamp=(x,a=0,b=100)=>Math.max(a,Math.min(b,Number(x)||0));
const LLM_TIMEOUT=30000;

function electionPressure(state,code){return Math.max(0,...(state.political_calendar?.events||[]).filter(e=>e.country===code).map(e=>Number(e.pressure)||0))}
function fronts(state,code){return (state.pairs||[]).filter(p=>p.a===code||p.b===code).sort((a,b)=>b.score-a.score)}
function other(p,code){return p.a===code?p.b:p.a}
function avgRestraint(p){const v=Object.values(p.restraints||{}).map(Number).filter(Number.isFinite);return v.length?v.reduce((a,b)=>a+b,0)/v.length:40}
function brainFor(state,code,c){
  const fs=fronts(state,code),hot=fs[0]||null,max=hot?.score||0,ep=electionPressure(state,code),trade=Number(c.trade_dependency_risk||0),energy=Number(c.energy_dependency_risk||0);
  const weights={
    security:Math.round(clamp(28+max*.52+(100-(c.military||50))*.08)),
    economy:Math.round(clamp(35+(100-(c.economy_live??c.economy??50))*.2+trade*1.1)),
    energy:Math.round(clamp(24+(100-(c.energy_security||50))*.32+energy*1.25)),
    stability:Math.round(clamp(30+ep*.55+(100-(c.stability_live??c.stability??55))*.24)),
    influence:Math.round(clamp(22+(c.influence||45)*.42)),
    domestic:Math.round(clamp(24+ep*.85+max*.12))
  };
  let posture='BALANCED';if(max>=88)posture='CRISIS';else if(max>=72)posture='DETER_AND_CONTAIN';else if(trade>=12||energy>=15)posture='HEDGE_DEPENDENCIES';else if((c.influence||0)>=75&&(c.military||0)>=70)posture='ASSERTIVE';else if(max<45)posture='OPPORTUNISTIC';
  const goals=[];if(max>=60)goals.push({id:'contain_hot_front',priority:Math.round(max),target:hot?other(hot,code):null});if(trade>=4)goals.push({id:'diversify_trade',priority:Math.round(clamp(45+trade*2)),value:trade});if(energy>=4||weights.energy>=65)goals.push({id:'secure_energy',priority:Math.round(clamp(weights.energy)),value:energy});if(ep>=15)goals.push({id:'manage_domestic_cycle',priority:Math.round(clamp(45+ep*.6)),value:ep});if((c.influence||0)>=60)goals.push({id:'preserve_influence',priority:Math.round(c.influence)});goals.sort((a,b)=>b.priority-a.priority);
  const moves=[];
  if(hot){const target=other(hot,code),rest=avgRestraint(hot),mil=hot.vector?.military||0,dip=hot.vector?.diplomatic||0;
    if(max>=82&&rest<55)moves.push({type:'DETER',target,front:hot.id,utility:Math.round(clamp(weights.security*.78+max*.22)),effects:{military:+4,deterrence:+6},reason:'High pressure with weak restraint network.'});
    if(dip>=65||max>=70)moves.push({type:'DEESCALATE_CHANNEL',target,front:hot.id,utility:Math.round(clamp(weights.stability*.55+rest*.25+weights.economy*.2)),effects:{diplomatic:-5,mediation:+5},reason:'Reduce escalation cost without conceding core positions.'});
    if((trade>=5||hot.dependencies?.trade)&&max>=55)moves.push({type:'DIVERSIFY_TRADE',target,front:hot.id,utility:Math.round(clamp(weights.economy*.75+trade)),effects:{trade:-2,economic_interdependence:-1},reason:'Reduce bilateral exposure before coercion becomes costly.'});
    if((hot.vector?.information||0)>=65||ep>=25)moves.push({type:'NARRATIVE_CONTROL',target,front:hot.id,utility:Math.round(clamp(weights.domestic*.72+(hot.vector?.information||0)*.2)),effects:{domestic:-1,information:+1},reason:'Domestic and information pressure is strategically salient.'});
  }
  if(energy>=5||weights.energy>=70)moves.push({type:'ENERGY_DIVERSIFICATION',target:null,utility:Math.round(clamp(weights.energy)),effects:{energy_security:+3},reason:'Import concentration creates strategic vulnerability.'});
  if((c.influence||0)>=72&&max<78){const third=(state.pairs||[]).filter(p=>p.a!==code&&p.b!==code).sort((a,b)=>b.score-a.score)[0];if(third)moves.push({type:'MEDIATE',target:third.id,front:third.id,utility:Math.round(clamp((c.influence||0)*.7+weights.stability*.2)),effects:{diplomatic:-2,mediation:+3},reason:'Use spare influence on a high-value third-party crisis.'});}
  moves.sort((a,b)=>b.utility-a.utility);
  return {country:code,name:c.name,posture,utility_weights:weights,goals:goals.slice(0,5),next_moves:moves.slice(0,4),constraints:{election_pressure:Number(ep.toFixed(1)),trade_dependency:Number(trade.toFixed(1)),energy_dependency:Number(energy.toFixed(1)),hottest_front:hot?.id||null,hottest_score:Math.round(max)},generated_at:new Date().toISOString(),mode:'deterministic-utility'};
}
async function llmEnhance(state,brains){
  const key=process.env.OPENROUTER_API_KEY;if(!key)return null;const model=process.env.OPENROUTER_MODEL||'openai/gpt-oss-20b';
  const compact=Object.values(brains).filter(b=>b.constraints.hottest_score>=55).sort((a,b)=>b.constraints.hottest_score-a.constraints.hottest_score).slice(0,35).map(b=>({country:b.country,posture:b.posture,constraints:b.constraints,goals:b.goals,moves:b.next_moves.map(x=>({type:x.type,target:x.target,utility:x.utility}))}));
  const prompt=`You are the strategy narrator for a geopolitical simulation. Do not invent facts. Given deterministic country utility outputs, return STRICT JSON {"brains":[{"country":"ISO3","rationale":"max 2 sentences","watch":["short condition","short condition"]}]}. Explain only why the model selected its posture and what observable conditions would change it. Input: ${JSON.stringify(compact)}`;
  try{const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json','x-title':'WORLDSTATE Country Brain'},body:JSON.stringify({model,messages:[{role:'user',content:prompt}],temperature:.12,response_format:{type:'json_object'}}),signal:AbortSignal.timeout(LLM_TIMEOUT)});if(!r.ok)throw new Error(String(r.status));return JSON.parse((await r.json()).choices?.[0]?.message?.content||'{}')}catch(e){console.warn('brain LLM failed',e.name||e.message);return null}
}
async function main(){const state=JSON.parse(await fs.readFile(STATE_PATH,'utf8'));const brains={};for(const [code,c] of Object.entries(state.countries||{}))if((c.fronts||0)>0)brains[code]=brainFor(state,code,c);const ai=await llmEnhance(state,brains);if(ai?.brains)for(const x of ai.brains){if(brains[x.country]){brains[x.country].rationale=x.rationale||'';brains[x.country].watch=Array.isArray(x.watch)?x.watch.slice(0,3):[];brains[x.country].mode='utility+llm';}}
  state.country_brains=brains;state.country_brain={updated_at:new Date().toISOString(),countries:Object.keys(brains).length,llm_enabled:Boolean(ai),method:'utility-weighted deterministic strategy; optional LLM rationale'};
  for(const p of state.pairs||[]){const ba=brains[p.a],bb=brains[p.b];const ma=ba?.next_moves?.find(m=>m.target===p.b||m.front===p.id),mb=bb?.next_moves?.find(m=>m.target===p.a||m.front===p.id);p.bot_moves=[ma&&`${state.countries[p.a]?.name||p.a}: ${ma.type} — ${ma.reason}`,mb&&`${state.countries[p.b]?.name||p.b}: ${mb.type} — ${mb.reason}`].filter(Boolean);}
  await fs.writeFile(STATE_PATH,JSON.stringify(state,null,2)+'\n');console.log(`Country Brain: ${Object.keys(brains).length} actors, llm=${Boolean(ai)}`)}
main().catch(e=>{console.error(e);process.exitCode=1});

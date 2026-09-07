// WORLD//STATE Logistics & Infrastructure Graph V2
// Capacities are MODEL INDICES (0-100), not claimed real-world tonnage. Physical route geometry is approximate.
const LOGISTICS_META={
 'atlantic-lng':{capacity:78,commodities:['LNG'],transitDays:9,insurance:102,reroutes:[]},
 'gulf-europe':{capacity:92,commodities:['crude oil','LNG','refined products'],transitDays:18,insurance:118,reroutes:['cape-reroute']},
 'east-asia-europe':{capacity:96,commodities:['containers','electronics','machinery'],transitDays:28,insurance:108,reroutes:['cape-reroute']},
 'west-africa-eu':{capacity:62,commodities:['LNG','crude oil'],transitDays:8,insurance:104,reroutes:[]},
 'medgaz':{capacity:70,commodities:['natural gas'],transitDays:1,insurance:100,reroutes:['atlantic-lng']},
 'maghreb-europe':{capacity:58,commodities:['natural gas'],transitDays:2,insurance:112,reroutes:['medgaz','atlantic-lng']},
 'turkstream':{capacity:72,commodities:['natural gas'],transitDays:3,insurance:113,reroutes:[]},
 'btc':{capacity:64,commodities:['crude oil'],transitDays:4,insurance:105,reroutes:[]},
 'marea':{capacity:88,commodities:['data'],transitDays:0.06,insurance:100,reroutes:['ellalink']},
 'ellalink':{capacity:76,commodities:['data'],transitDays:0.07,insurance:101,reroutes:['marea']},
 'europe-asia-cable':{capacity:82,commodities:['data'],transitDays:0.12,insurance:108,reroutes:['africa-cable']},
 'cape-reroute':{capacity:68,commodities:['crude oil','LNG','containers'],transitDays:32,insurance:125,reroutes:[]},
 'transatlantic-container':{capacity:88,commodities:['containers','vehicles','machinery'],transitDays:10,insurance:101,reroutes:[]},
 'pacific-us-china':{capacity:94,commodities:['containers','electronics','machinery'],transitDays:16,insurance:111,reroutes:[]},
 'india-europe':{capacity:84,commodities:['containers','refined products','chemicals'],transitDays:20,insurance:108,reroutes:['cape-reroute']},
 'blacksea-med':{capacity:62,commodities:['grain','fertilizer','energy'],transitDays:7,insurance:126,reroutes:[]},
 'northsea-med':{capacity:74,commodities:['containers','industrial goods'],transitDays:9,insurance:101,reroutes:[]},
 'transmed':{capacity:71,commodities:['natural gas'],transitDays:3,insurance:102,reroutes:['medgaz','atlantic-lng']},
 'tap':{capacity:54,commodities:['natural gas'],transitDays:4,insurance:101,reroutes:[]},
 'power-siberia':{capacity:79,commodities:['natural gas'],transitDays:5,insurance:103,reroutes:[]},
 'nordstream':{capacity:0,commodities:['natural gas'],transitDays:3,insurance:180,reroutes:['turkstream','atlantic-lng']},
 'seamewe5':{capacity:86,commodities:['data'],transitDays:0.13,insurance:106,reroutes:['africa-cable']},
 'africa-cable':{capacity:77,commodities:['data'],transitDays:0.16,insurance:103,reroutes:[]}
};
for(const r of ROUTES){Object.assign(r,LOGISTICS_META[r.id]||{capacity:60,commodities:[r.subtype||r.kind],transitDays:r.kind==='cable'?.1:10,insurance:105,reroutes:[]})}
const _routeAccessV1=routeAccess;
function logisticsPairPressure(route,code){
  let max=0;
  for(const other of route.countries||[]){if(other===code)continue;const p=pairBetween(code,other);if(p)max=Math.max(max,Number(p.score)||0)}
  return max
}
function routeMetrics(route,code=focusCountry){
  const base=_routeAccessV1(route,code),chokes=(route.gates||[]).map(findChoke).filter(Boolean),chokeMax=Math.max(0,...chokes.map(c=>Number(c.score)||0));
  const bilateral=logisticsPairPressure(route,code);let capacity=Number(route.capacity)||60,insurance=Number(route.insurance)||100,days=Number(route.transitDays)||0;
  if(base.status==='contested'){capacity*=Math.max(.38,1-(Math.max(chokeMax,bilateral)-55)/100);insurance+=20+Math.max(chokeMax,bilateral)*.35;days+=route.kind==='cable'?.01:Math.max(1,Math.round((chokeMax-55)/10))}
  if(base.status==='blocked'){capacity=0;insurance+=85+Math.max(chokeMax,bilateral)*.45}
  if(mode==='sim'&&sim?.route_overrides?.[route.id]?.[code]?.capacityPct!=null)capacity=Number(sim.route_overrides[route.id][code].capacityPct);
  const weight={open:0,contested:1,blocked:2};
  const alternatives=(route.reroutes||[])
    .map(id=>ROUTES.find(x=>x.id===id))
    .filter(Boolean)
    .map(alt=>{const a=_routeAccessV1(alt,code);return{id:alt.id,name:alt.name,status:a.status,days:Number(alt.transitDays)||0,capacity:Number(alt.capacity)||60}})
    .sort((a,b)=>(weight[a.status]??3)-(weight[b.status]??3)||a.days-b.days);
  let activeReroute=base.via?alternatives.find(a=>a.id===base.via):null;
  if(!activeReroute&&base.status==='blocked')activeReroute=alternatives.find(a=>a.status!=='blocked')||null;
  if(activeReroute){days=activeReroute.days;capacity=Math.max(capacity,activeReroute.capacity*(activeReroute.status==='open'?.72:.42));insurance+=activeReroute.status==='open'?15:35}
  return{...base,capacityPct:Math.round(clamp(capacity)),insuranceIndex:Math.round(insurance),transitDays:Math.round(days*10)/10,commodities:route.commodities||[],chokeRisk:Math.round(chokeMax),bilateralRisk:Math.round(bilateral),alternatives,activeReroute}
}
routeAccess=function(route,code=focusCountry){return routeMetrics(route,code)};
function buildLogisticsSnapshot(code=focusCountry){
  return ROUTES.map(r=>({id:r.id,name:r.name,kind:r.kind,...routeMetrics(r,code)})).sort((a,b)=>({blocked:2,contested:1,open:0}[b.status]-({blocked:2,contested:1,open:0}[a.status])||b.insuranceIndex-a.insuranceIndex)
}
function recomputeLogisticsState(){
  if(!world)return null;
  const countries={};for(const code of Object.keys(world.countries||{})){const rows=buildLogisticsSnapshot(code).filter(r=>ROUTES.find(x=>x.id===r.id)?.countries.includes(code));if(!rows.length)continue;countries[code]={open:rows.filter(x=>x.status==='open').length,contested:rows.filter(x=>x.status==='contested').length,blocked:rows.filter(x=>x.status==='blocked').length,avgCapacity:Math.round(rows.reduce((s,x)=>s+x.capacityPct,0)/rows.length),avgInsurance:Math.round(rows.reduce((s,x)=>s+x.insuranceIndex,0)/rows.length)}}
  world.logistics_state={updated_at:mode==='sim'?(sim?.sim_date||new Date().toISOString()):new Date().toISOString(),countries,routes:buildLogisticsSnapshot(focusCountry)};return world.logistics_state
}
window.WORLDSTATE_LOGISTICS={meta:LOGISTICS_META,routeMetrics,buildLogisticsSnapshot,recomputeLogisticsState};

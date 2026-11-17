// Shared with the inline page and unit tests. No DOM access: state, display and export use one contract.
export const WORKSPACE_JS = String.raw`
/* Every navigation gets a ticket, even when it reuses cached data or opens Definitions. */
function workspaceRequestGate() { var latest=0;return { begin:function(){return ++latest;},current:function(ticket){return ticket===latest;} }; }
function workspaceDefault() { return { view:'overview', preset:'14', from:'', to:'', country:'', device:'', compare:true, trend:'active', measure:'active', dimension:'day', display:'auto', filters:{}, sort:'key', descending:false }; }
function workspaceState(hash, meta) {
  var s=workspaceDefault(), q=new URLSearchParams(String(hash||'').replace(/^#/,''));
  ['view','preset','from','to','country','device','trend','measure','dimension','display','sort'].forEach(function(k){ if(q.has(k))s[k]=q.get(k); });
  if(q.has('r'))s.preset=q.get('r')==='1'?'today':q.get('r');
  if(q.has('c'))s.country=q.get('c');
  if(q.has('m'))s.trend=q.get('m')==='people'?'active':q.get('m');
  s.compare=q.get('compare')!=='0'; s.descending=q.get('descending')==='1';
  if(['overview','explore','definitions'].indexOf(s.view)<0)s.view='overview';
  if(['today','7','14','30','all','custom'].indexOf(s.preset)<0)s.preset='14';
  var dateOK=function(d){return /^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;};
  if(s.preset==='custom'&&(!dateOK(s.from)||!dateOK(s.to)||s.from>s.to)){s.preset='14';s.from='';s.to='';}
  if(!/^[A-Za-z]{2}$/.test(s.country))s.country=''; s.country=s.country.toUpperCase();
  if(meta.devices.indexOf(s.device)<0)s.device='';
  if(['active','collages','downloads','shares','visits','posters'].indexOf(s.trend)<0)s.trend='active';
  if(!Object.prototype.hasOwnProperty.call(meta.measures,s.measure))s.measure='active';
  var dims=meta.measures[s.measure].dimensions;
  if(dims.indexOf(s.dimension)<0)s.dimension='day';
  if(['auto','line','bar','table'].indexOf(s.display)<0)s.display='auto';
  if(s.display==='line'&&s.dimension!=='day')s.display='bar';
  if(['key','value'].indexOf(s.sort)<0)s.sort='key';
  dims.forEach(function(d){if(q.has('f_'+d))s.filters[d]=q.get('f_'+d);});
  return s;
}
function workspaceHash(s) {
  var q=new URLSearchParams(), def=workspaceDefault();
  Object.keys(def).forEach(function(k){if(k!=='filters'&&s[k]!==def[k])q.set(k,String(typeof s[k]==='boolean'?(s[k]?1:0):s[k]));});
  Object.keys(s.filters).sort().forEach(function(k){q.set('f_'+k,s.filters[k]);});
  return q.toString()?'#'+q.toString():'';
}
function workspaceQuery(s, today) {
  var end=s.preset==='today'||s.preset==='all'?today:addDays(today,-1), start=end;
  if(['7','14','30'].indexOf(s.preset)>=0)start=addDays(end,1-Number(s.preset));
  if(s.preset==='custom'){start=s.from;end=s.to;}
  var q=new URLSearchParams({workspace:'1',from:start,to:end,measure:s.measure,dimension:s.dimension});
  if(s.preset==='all')q.set('all','1');
  if(s.country)q.set('country',s.country); if(s.device)q.set('device',s.device);
  Object.keys(s.filters).sort().forEach(function(k){q.set('f_'+k,s.filters[k]);});
  return q.toString();
}
function workspaceSort(rows, key, descending, dimension) {
  return rows.slice().sort(function(a,b){var c=key==='value'?a.value-b.value:dimension==='hour'?((a.key===''?24:Number(a.key))-(b.key===''?24:Number(b.key))):String(a.key).localeCompare(String(b.key));return (descending?-c:c)||String(a.key).localeCompare(String(b.key));});
}
function workspaceChartRows(result) {
  if(result.dimension==='day'||result.dimension==='hour')return result.rows.filter(function(r){return r.key!=='';});
  var rows=workspaceSort(result.rows,'value',true,result.dimension), top=rows.slice(0,10);
  if(rows.length>10)top.push({key:'__other',value:result.overlapping?result.other:rows.slice(10).reduce(function(a,r){return a+r.value;},0)});
  return top;
}
function exportCell(v) { var t=String(v==null?'':v);if(/^[\s]*[=+@-]/.test(t)||/^[\t\r\n]/.test(t))t="'"+t;return csvCell(t); }
function workspaceCsv(data, s) {
  var r=data.range,x=data.explore;
  var rows=[['from','to','country','device','measure','unit','dimension','filters','category','value','total','missing_category','overlapping','missing_identity','generated_at','notes']];
  var filters=Object.keys(x.filters).sort().map(function(k){return k+'='+x.filters[k];}).join('; ');
  var notes=data.warnings.slice();if(x.dimension==='hour')notes.push('Receipt hour; missing times are in the empty category.');if(x.overlapping)notes.push('Categories overlap; do not sum their visitor-days.');
  workspaceSort(x.rows,s.sort,s.descending,x.dimension).forEach(function(row){rows.push([r.from,r.to,r.country||'all',r.device||'all',x.measure,x.unit,x.dimension,filters,row.key,row.value,x.total,x.unknown,x.overlapping,x.missingIdentity,data.generatedAt,notes.join(' ')]);});
  if(!x.rows.length)rows.push([r.from,r.to,r.country||'all',r.device||'all',x.measure,x.unit,x.dimension,filters,'',0,x.total,x.unknown,x.overlapping,x.missingIdentity,data.generatedAt,'No matching events. '+notes.join(' ')]);
  return rows.map(function(row){return row.map(exportCell).join(',');}).join('\n')+'\n';
}
function workspaceObservation(data, measure, compare) {
  if(!compare||!data.range.compareAvailable)return '';
  var value=data.daily.reduce(function(a,d){return a+d[measure];},0),previous=data.previous.reduce(function(a,d){return a+d[measure];},0);
  if(!previous)return value?'No previous activity in the comparison period.':'';
  if(value===previous)return 'Unchanged: '+value.toLocaleString('en-US')+' in each period.';
  return value.toLocaleString('en-US')+' versus '+previous.toLocaleString('en-US')+' in the previous period ('+Math.abs(Math.round((value-previous)/previous*100))+'% '+(value>previous?'higher':'lower')+').';
}
`

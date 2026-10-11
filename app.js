let map;
let markers = [];
let reports = [];
let currentFilter = 'All';
let latestFare = null;

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function riskClass(level){ return `risk-${level.replace(/\s/g,'-')}`; }
function initMap(){
  map = L.map('scamMap', { scrollWheelZoom: false }).setView([28.625,77.205], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
}
function markerColor(severity){ return severity==='High' ? '#ff6d7a' : severity==='Medium' ? '#ffad5c' : '#4fe0ae'; }
function renderReports(){
  const filtered = currentFilter === 'All' ? reports : reports.filter(r => r.category === currentFilter);
  $('reportCount').textContent = `${filtered.length} reports`;
  markers.forEach(m => map.removeLayer(m)); markers=[];
  $('mapReportList').innerHTML = filtered.map(r => `<article class="mini-report" data-id="${esc(r.id)}"><div class="topline"><span class="severity ${esc(r.severity)}">${esc(r.severity)} RISK</span><span class="severity">${esc(r.category)}</span></div><h4>${esc(r.title)}</h4><p>${esc(r.location)} · ${esc(r.status || 'Community report')}</p></article>`).join('') || '<p style="color:#9db0c9">No reports in this filter.</p>';
  filtered.forEach(r => {
    const marker = L.circleMarker([r.lat,r.lng],{radius:9,color:markerColor(r.severity),fillColor:markerColor(r.severity),fillOpacity:.72,weight:2}).addTo(map);
    marker.bindPopup(`<b>${esc(r.title)}</b><br><small>${esc(r.location)} · ${esc(r.severity)} risk</small><br><br>${esc(r.description)}<br><br><b>Suggested action:</b> ${esc(r.action)}`);
    markers.push(marker);
  });
  document.querySelectorAll('.mini-report').forEach(el => el.onclick=()=>{ const r=reports.find(x=>x.id===el.dataset.id); if(r){map.setView([r.lat,r.lng],14); markers.find(m=>m.getLatLng().lat===r.lat && m.getLatLng().lng===r.lng)?.openPopup();} });
}
function setupFilters(){
 const cats=['All','Transport','Tourist Trap','Guide','Restaurant','Money'];
 $('mapFilters').innerHTML=cats.map(c=>`<button class="${c===currentFilter?'active':''}" data-filter="${c}">${c}</button>`).join('');
 document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{currentFilter=b.dataset.filter;setupFilters();renderReports();});
}
async function loadReports(){ const res=await fetch('/api/reports'); reports=await res.json(); renderReports(); }
function fareResultHTML(r){ return `<div class="result-top"><div><p class="eyebrow">FARE ASSESSMENT</p><h3>${esc(r.riskLevel)}</h3></div><span class="risk-label ${riskClass(r.riskLevel)}">${esc(r.riskLevel)}</span></div><div class="result-stats"><div><small>Quoted</small><strong>₹${r.quotedFare}</strong></div><div><small>Fair range</small><strong class="green">₹${r.low}–₹${r.high}</strong></div><div><small>Above typical</small><strong class="orange">${r.priceDeviation}%</strong></div><div><small>Confidence</small><strong>${esc(r.confidence)}</strong></div></div><div class="result-block"><h4>Why this was flagged</h4><ul>${r.explanation.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div class="result-block"><h4>Recommended action</h4><div class="action-box">${esc(r.recommendation)}</div></div><div class="result-block"><h4>What to say</h4><div class="phrase"><b>English:</b> ${esc(r.phraseEnglish)}<br><br><b>Hindi:</b> ${esc(r.phraseHindi)}<br><span style="color:#9db0c9">${esc(r.phraseRomanHindi)}</span></div><button class="copy-button" id="copyPhrase">Copy Hindi phrase</button></div>`; }
$('fareForm').addEventListener('submit',async(e)=>{e.preventDefault(); const button=e.submitter;button.disabled=true;button.textContent='Analyzing…';try{const payload={city:$('city').value,serviceType:$('serviceType').value,origin:$('origin').value,destination:$('destination').value,quotedFare:$('quotedFare').value,tripTime:$('tripTime').value,meterRefused:$('meterRefused').checked};const res=await fetch('/api/fare-analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await res.json();if(!res.ok)throw new Error(data.error);latestFare=data;$('fareResult').classList.remove('empty-result');$('fareResult').innerHTML=fareResultHTML(data);$('copyPhrase').onclick=async()=>{await navigator.clipboard.writeText(data.phraseHindi);$('copyPhrase').textContent='Copied ✓';setTimeout(()=> $('copyPhrase').textContent='Copy Hindi phrase',1200);};}catch(err){$('fareResult').innerHTML=`<div class="empty-result"><div class="empty-icon">!</div><h3>Could not analyze</h3><p>${esc(err.message)}</p></div>`;}finally{button.disabled=false;button.innerHTML='Analyze this fare <span>→</span>';}});
$('reportForm').addEventListener('submit',async(e)=>{e.preventDefault();const btn=e.submitter;btn.disabled=true;btn.textContent='Submitting…';try{const location=$('reportLocation').value;const offsets={"Connaught Place":[28.6315,77.2167],"IGI Airport Arrivals":[28.5562,77.1],"Paharganj":[28.642,77.214]};const pos=offsets[location]||[28.6139+(Math.random()-.5)*.06,77.209+(Math.random()-.5)*.06];const payload={title:$('reportTitle').value,category:$('reportCategory').value,severity:$('reportSeverity').value,location,amount:$('reportAmount').value,description:$('reportDescription').value,action:$('reportAction').value,lat:pos[0],lng:pos[1]};const res=await fetch('/api/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await res.json();if(!res.ok)throw new Error(data.error);$('reportSuccess').classList.remove('hidden');$('reportSuccess').textContent='Report submitted. It now appears as a new prototype community report on the map.';$('reportForm').reset();await loadReports();setTimeout(()=>document.querySelector('#map').scrollIntoView({behavior:'smooth'}),600);}catch(err){$('reportSuccess').classList.remove('hidden');$('reportSuccess').textContent=`Could not submit: ${err.message}`;}finally{btn.disabled=false;btn.textContent='Submit community report';}});
function addMessage(text,type){const div=document.createElement('div');div.className=`message ${type}`;div.textContent=text;$('chatMessages').appendChild(div);$('chatMessages').scrollTop=$('chatMessages').scrollHeight;}
async function askAI(question){if(!question.trim())return;addMessage(question,'user');$('assistantQuestion').value='';try{const res=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,context:{fare:latestFare}})});const data=await res.json();addMessage(data.answer,'bot');}catch{addMessage('I could not reach the assistant. Try checking your connection.','bot');}}
$('assistantForm').addEventListener('submit',e=>{e.preventDefault();askAI($('assistantQuestion').value);});document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>askAI(b.dataset.prompt));
initMap();setupFilters();loadReports();

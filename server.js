const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend');
const DATA_FILE = path.join(__dirname, 'data.json');
const PORT = process.env.PORT || 3000;

const benchmarks = [
  { serviceType: 'Airport Taxi', origin: 'IGI Airport Terminal 3', destination: 'Connaught Place', low: 700, typical: 800, high: 900, confidence: 'High' },
  { serviceType: 'Airport Taxi', origin: 'IGI Airport Terminal 3', destination: 'Paharganj', low: 650, typical: 750, high: 850, confidence: 'High' },
  { serviceType: 'Auto Rickshaw', origin: 'Connaught Place', destination: 'India Gate', low: 70, typical: 100, high: 140, confidence: 'Medium' },
  { serviceType: 'Taxi', origin: 'New Delhi Railway Station', destination: 'Karol Bagh', low: 180, typical: 250, high: 320, confidence: 'Medium' }
];

function readData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return { reports: [] }; }
}
function writeData(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }
function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(body));
}
function getBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); } });
  });
}
function fareAnalysis(input) {
  const quote = Number(input.quotedFare);
  if (!Number.isFinite(quote) || quote <= 0) throw new Error('Enter a valid quoted fare.');
  const found = benchmarks.find(b => b.serviceType === input.serviceType && b.origin === input.origin && b.destination === input.destination) || benchmarks[0];
  const multiplier = input.tripTime === 'Night' ? 1.15 : 1;
  const low = Math.round(found.low * multiplier);
  const typical = Math.round(found.typical * multiplier);
  const high = Math.round(found.high * multiplier);
  const deviation = Math.max(0, Math.round(((quote - typical) / typical) * 100));
  const score = Math.min(100, Math.round(Math.min(deviation * 0.78, 75) + (input.meterRefused ? 18 : 0) + (String(input.origin).includes('Airport') ? 10 : 0)));
  const riskLevel = score >= 70 ? 'High Risk' : score >= 45 ? 'Suspicious' : score >= 20 ? 'Caution' : 'Fair';
  const offer = Math.min(high, Math.round(typical * 1.06));
  return {
    low, typical, high, quotedFare: quote, priceDeviation: deviation, riskScore: score, riskLevel,
    confidence: found.confidence,
    explanation: [
      `The quoted fare is ${deviation}% above the typical prototype benchmark of ₹${typical}.`,
      `Comparable fares for this route are estimated at ₹${low}–₹${high}.`,
      ...(String(input.origin).includes('Airport') ? ['Airport pickup zones have additional reported overcharging risk.'] : []),
      ...(input.meterRefused ? ['Meter refusal increases the risk assessment.'] : [])
    ],
    recommendation: riskLevel === 'Fair' ? 'The fare is within the expected range. Confirm all tolls and the final amount before starting.' : `Ask for the meter or propose ₹${offer} including reasonable tolls.`,
    phraseEnglish: `Could you please use the meter, or can we agree on ₹${offer} including tolls?`,
    phraseHindi: `कृपया मीटर से चलिए, या टोल सहित ₹${offer} में चलेंगे?`,
    phraseRomanHindi: `Kripya meter se chaliye, ya toll sahit ₹${offer} mein chalenge?`
  };
}
function assistantAnswer(question, context) {
  const q = String(question || '').toLowerCase();
  const fare = context && context.fare;
  if (fare && (q.includes('fare') || q.includes('price') || q.includes('taxi') || q.includes('quote'))) {
    return `Based on your check, ₹${fare.quotedFare} was rated ${fare.riskLevel}. The prototype fair range is ₹${fare.low}–₹${fare.high}. ${fare.recommendation}`;
  }
  if (q.includes('meter')) return 'Ask for the meter before luggage is loaded. If the driver refuses, use an official/prepaid counter or a verified ride option where available.';
  if (q.includes('airport')) return 'At the airport, confirm the full fare, tolls, and meter use before the trip begins. Avoid rushed decisions and keep a receipt or booking record.';
  if (q.includes('scam') || q.includes('safe')) return 'Watch for meter refusal, unclear fixed fares, “attraction is closed” redirection, unofficial guides, and undisclosed service charges. Verify information directly and use official options when possible.';
  if (q.includes('hindi') || q.includes('say')) return fare ? fare.phraseHindi : 'कृपया मीटर से चलिए। (Kripya meter se chaliye.) — Please use the meter.';
  return 'I can help assess a fare, explain common local scam patterns, suggest a polite phrase, or tell you what evidence to save. Try: “Is this taxi fare fair?”';
}
function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  return { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg' }[ext] || 'application/octet-stream';
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}); return res.end(); }
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === '/api/fare-analyze' && req.method === 'POST') return json(res, 200, fareAnalysis(await getBody(req)));
    if (url.pathname === '/api/reports' && req.method === 'GET') return json(res, 200, readData().reports);
    if (url.pathname === '/api/reports' && req.method === 'POST') {
      const b = await getBody(req);
      if (!b.title || !b.category || !b.location || !b.description) return json(res, 400, { error: 'Title, category, location, and description are required.' });
      const report = { id: crypto.randomUUID(), title: String(b.title).slice(0,100), category: String(b.category).slice(0,40), severity: ['High','Medium','Low'].includes(b.severity) ? b.severity : 'Medium', location: String(b.location).slice(0,100), lat: Number(b.lat) || 28.6139, lng: Number(b.lng) || 77.2090, amount: Number(b.amount) || 0, description: String(b.description).slice(0,700), action: String(b.action || 'Confirm the price and use official services where possible.').slice(0,400), createdAt: new Date().toISOString(), status: 'New community report (prototype)' };
      const data = readData(); data.reports.unshift(report); writeData(data); return json(res, 201, report);
    }
    if (url.pathname === '/api/assistant' && req.method === 'POST') { const b = await getBody(req); return json(res, 200, { answer: assistantAnswer(b.question, b.context) }); }
    let reqPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const filePath = path.normalize(path.join(FRONTEND, reqPath));
    if (!filePath.startsWith(FRONTEND)) return json(res, 403, { error: 'Forbidden' });
    fs.readFile(filePath, (err, data) => {
      if (err) return fs.readFile(path.join(FRONTEND, 'index.html'), (fallbackErr, fallback) => {
        if (fallbackErr) return json(res, 404, { error: 'Not found' });
        res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); res.end(fallback);
      });
      res.writeHead(200, {'Content-Type': contentType(filePath)}); res.end(data);
    });
  } catch (e) { json(res, 400, { error: e.message || 'Request failed.' }); }
});
server.listen(PORT, () => console.log(`Travel Trap Detector running at http://localhost:${PORT}`));

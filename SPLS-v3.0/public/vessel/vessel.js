/* Vessel simulator script
   - loads CSV masters from /db
   - finds eligible berths (2-5) using LOA/Draft checks against VM_berth_master
   - estimates stay hours using a simple cargo norm: default manual throughput rate (mt/day)
   - computes Port Dues, Pilotage and Berth Hire from CSVs
*/

function fetchText(url){
  return fetch(url).then(r=>{ if(!r.ok) throw new Error('fetch failed '+url); return r.text();});
}

function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim()!=='');
  const hdr = lines[0].split(',').map(h=>h.trim());
  return lines.slice(1).map(l=>{
    const cols = l.split(',');
    const obj = {};
    hdr.forEach((h,i)=> obj[h]=cols[i] ? cols[i].trim() : '');
    return obj;
  });
}

document.addEventListener('DOMContentLoaded', async ()=>{
  const form = document.getElementById('vesselForm');
  const cargoSelect = document.getElementById('cargoSelect');
  const rightPanel = document.getElementById('rightPanel');
  const costBtns = document.getElementById('costBtns');

  // results area
  const resultsWrap = document.createElement('div');
  resultsWrap.style.marginTop = '18px';
  resultsWrap.style.width = '100%';
  rightPanel.appendChild(resultsWrap);

  // load CSV masters including Cargo Master for norms
  let berthMaster = [], berthHire = [], portDues = [], pilotage = [], cargoMaster = [];
  try{
    const [btxt, htxt, ptxt, piltxt, cargotxt] = await Promise.all([
      fetchText('/db/VM_berth_master.csv'),
      fetchText('/db/VM_berth_hire.csv'),
      fetchText('/db/VM_port_dues.csv'),
      fetchText('/db/VM_Pilotage_Master_with_Category.csv'),
      fetchText('/db/CM_CargoMaster.csv')
    ]);
    berthMaster = parseCSV(btxt);
    berthHire = parseCSV(htxt);
    portDues = parseCSV(ptxt);
    pilotage = parseCSV(piltxt);
    cargoMaster = parseCSV(cargotxt);
  }catch(err){
    console.error('Error loading CSVs', err);
  }

  // Populate cargo options from CM_CargoMaster.csv (Cargo Description preferred)
  try{
    const cargoNames = [...new Set(cargoMaster.map(r=>r['Cargo Description']).filter(Boolean))].sort();
    cargoNames.forEach(name=>{
      const opt = document.createElement('option'); opt.value = name; opt.textContent = name; cargoSelect.appendChild(opt);
    });
  }catch(e){
    console.warn('could not load cargo master, using default options');
    ['General Cargo','Bulk Cargo','Container','Liquid Bulk'].forEach(name=>{const opt=document.createElement('option');opt.value=name;opt.textContent=name;cargoSelect.appendChild(opt);});
  }

  function findEligibleBerths({loa,draft,beam,cargo}){
    const isYes = v => {
      if(v==null) return false;
      const s = String(v).trim().toLowerCase();
      return s === 'yes' || s === 'y' || s === 'true' || s === '1';
    };

    const candidates = berthMaster.filter(b=>{
      const quay = parseFloat(b.Quay_Len) || 0;
      const berthDraft = parseFloat(b.Draft) || 0;
      let cargoOk = true;
      if(cargo){
        const low = cargo.toLowerCase();
        // Container requirement
        if(low.includes('container')){
          cargoOk = isYes(b.Container || b['Container'] || b['CONTAINER']);
        }
        // Liquid bulk: require both Liquid_Bulk AND Bulk to be yes
        else if(low.includes('liquid') || low.includes('tank') || low.includes('tanker')){
          const liquid = isYes(b.Liquid_Bulk || b['Liquid_Bulk'] || b['Liquid Bulk'] || b['LIQUID_BULK']);
          const bulk = isYes(b.Bulk || b['Bulk'] || b['Bulk_Cargo'] || b['Bulk Cargo']);
          cargoOk = liquid && bulk;
        }
        // Bulk (non-liquid): require Bulk to be yes
        else if(low.includes('bulk') || low.includes('ore') || low.includes('iron')){
          console.debug('checking bulk for cargo',cargo);
          cargoOk = isYes(b.Bulk || b['Bulk'] || b['Bulk_Cargo'] || b['Bulk Cargo']);
          console.debug('bulk cargoOk=',cargoOk);
        }
      }
      return quay >= loa && berthDraft >= draft && cargoOk;
    });

    // sort by Quay_Len descending (larger quays first) and return up to 5 berth names
    candidates.sort((a,b)=> (parseFloat(b.Quay_Len)||0) - (parseFloat(a.Quay_Len)||0));
    return candidates.slice(0,5).map(c=>c.BerthName);
  }

  function getCargoRateFromMaster(cargoName){
    if(!cargoMaster || cargoMaster.length===0) return null;
    const name = (cargoName||'').trim().toLowerCase();
    // try matching Cargo Description or Cargo Short Name
    let row = cargoMaster.find(r=> (r['Cargo Description']||'').trim().toLowerCase() === name ) ||
              cargoMaster.find(r=> (r['Cargo Short Name']||'').trim().toLowerCase() === name );
    if(!row){
      // try substring match
      row = cargoMaster.find(r=> (r['Cargo Description']||'').toLowerCase().includes(name) ) ||
            cargoMaster.find(r=> (r['Cargo Short Name']||'').toLowerCase().includes(name) );
    }
    if(!row) return null;
    const v = Number(row['DSCHRG_RATE_PR_DAY']) || Number(row['LD_RATE_PR_DAY']) || null;
    return v;
  }

  function estimateStayHours(cargoName, qty){
    // Prefer cargo master DSCHRG_RATE_PR_DAY (mt/day). Fallback to heuristics if missing.
    let rateMtPerDay = getCargoRateFromMaster(cargoName);
    if(!rateMtPerDay || rateMtPerDay <= 0){
      const name = (cargoName||'').toLowerCase();
      rateMtPerDay = 1000; // default
      if(name.includes('grain') || name.includes('food')) rateMtPerDay = 800;
      if(name.includes('iron') || name.includes('ore')) rateMtPerDay = 2500;
      if(name.includes('cement') || name.includes('clinker')) rateMtPerDay = 1200;
      if(name.includes('container')) rateMtPerDay = 400; // TEU equiv unknown
      if(name.includes('liquid') || name.includes('oil') || name.includes('diesel') || name.includes('tank')) rateMtPerDay = 5000;
    }
    const days = Math.max( (qty || 0) / rateMtPerDay, 0.1);
    return Math.round(days * 24);
  }

  function lookupPortDues(gt, tradeType, cargo){
    // VM_port_dues.csv has rows per vessel_type with coastal_rate and foreign_rate
    const gtN = Number(gt)||0;
    // map cargo keywords -> vessel_type in port dues file
    const t = (cargo||'Others').toLowerCase();
    let key = 'Others';
    if(t.includes('tanker') || t.includes('oil') || t.includes('tank')) key='Tankers';
    else if(t.includes('container')) key='Container';
    else if(t.includes('roro') || t.includes('ro-ro')) key='RoRo';
    else if(t.includes('bulk') || t.includes('ore') || t.includes('iron')) key='Bulk Cargo';

    const row = portDues.find(r=> r.vessel_type && r.vessel_type.trim().toLowerCase() === key.trim().toLowerCase());
    if(!row){ console.debug('lookupPortDues: no vessel_type row for key',key); return null; }
    const rate = tradeType==='Coastal' ? Number(row.coastal_rate) : Number(row.foreign_rate);
    if(isNaN(rate)){ console.debug('lookupPortDues: rate NaN for row',row); return null; }
    // Interpret rate as per-GT multiplier (common for port dues). Compute amount = rate * GT
    const inrPerUsd = (window.currencyRates && window.currencyRates.INR) || 82.5;
    const amount = gtN * rate * inrPerUsd;
    console.debug('lookupPortDues: key',key,'rate',rate,'gt',gtN,'ER',inrPerUsd,'amount',amount);
    return amount;
  }

  function lookupPilotage(gt, tradeType, cargo){
    // VM_Pilotage_Master_with_Category.csv contains GT ranges with columns for Tankers, Container, RoRo, Bulk, Other and Category (Coastal/Foreign)
    const gtN = Number(gt)||0;
    const cat = (tradeType||'Foreign').trim();
    // find GT range row for the trade category
    const row = pilotage.find(r=>{
      const min = Number(r.GT_Min)||0; const max = r.GT_Max?Number(r.GT_Max):Infinity;
      return gtN >= min && gtN <= max && r.Category && r.Category.trim().toLowerCase() === cat.toLowerCase();
    });
    if(!row){ console.debug('lookupPilotage: no pilotage row for GT',gtN,'category',cat); return null; }
    // map cargo -> column name in pilotage CSV
    const t = (cargo||'Other').toLowerCase();
    let col = 'Other';
    if(t.includes('tanker') || t.includes('oil') || t.includes('tank')) col='Tankers';
    else if(t.includes('container')) col='Container';
    else if(t.includes('roro') || t.includes('ro-ro')) col='RoRo';
    else if(t.includes('bulk') || t.includes('ore') || t.includes('iron')) col='Bulk';
    if(row[col]===undefined){ console.debug('lookupPilotage: column',col,'not found in pilotage row',row); return null; }
    const val = Number(row[col]);
    if(isNaN(val)){ console.debug('lookupPilotage: value NaN for col',col,'row',row); return null; }
    // interpret value as per-GT multiplier (common); compute amount = val * GT
    const inrPerUsd = (window.currencyRates && window.currencyRates.INR) || 82.5;
    const amount = val * gtN * inrPerUsd;
    console.debug('lookupPilotage: col',col,'val',val,'gt',gtN,'ER',inrPerUsd,'amount',amount);
    return amount;
  }

  function lookupBerthHire(hours, gt, tradeType, cargo){
    // berthHire CSV has vessel_type and rates; approximate by selecting a per-hour rate based on vessel length categories
    // We'll take a simple value: for now use average of coastal_rate/foreign_rate rows if present
    if(!berthHire || berthHire.length===0) return null;
  // try to find 'Bulk Cargo' else take first
  let initialRow = berthHire.find(r=> r.vessel_type && r.vessel_type.trim().toLowerCase().includes('bulk')) || berthHire[0];
  const coastal = Number(initialRow.coastal_rate); const foreign = Number(initialRow.foreign_rate);
    // Currency handling: try to refresh rates from an online API (non-blocking).
    // If offline or API fails, fall back to cached CSV '/db/VM_currency_lookup.csv'.
    // We aim to return berth hire in USD. Assumption: coastal_rate is INR, foreign_rate is USD.
    // Start a background load of currency data (will not block this function). For immediate calculation
    // we use any already-loaded value or a sensible default.
    if (!window._currencyRatesPromise) {
      window._currencyRatesPromise = (async () => {
      // prefer online source if available
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
        const res = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=INR');
        if (res.ok) {
          const js = await res.json();
          if (js && js.rates && js.rates.INR) {
          window.currencyRates = { INR: Number(js.rates.INR) };
          console.debug('currencyRates updated from exchangerate.host', window.currencyRates);
          return window.currencyRates;
          }
        }
        } catch (e) {
        console.debug('online currency API failed', e);
        }
      }
      // fallback to local cache CSV
      try {
        const txt = await fetch('/db/VM_currency_lookup.csv').then(r => { if (!r.ok) throw new Error('no cache'); return r.text(); });
        const rows = parseCSV(txt);
        if (rows && rows.length) {
          const r = rows[0];
          // map headers case-insensitively
          const keyMap = {};
          Object.keys(r).forEach(k => { if(k) keyMap[k.trim().toLowerCase()] = k; });
          const inrKey = keyMap['INR'];
          const usdKey = keyMap['USD'];
          const inrVal = inrKey ? Number(r[inrKey]) : NaN;
          const usdVal = usdKey ? Number(r[usdKey]) : NaN;
          let inrPerUsd = NaN;
          // if usd column is >1 assume it's INR per USD, if <=1 assume it's USD per INR (invert)
          if (!isNaN(usdVal)) {
        if (usdVal > 1) inrPerUsd = usdVal;
        else if (usdVal > 0) inrPerUsd = 1 / usdVal;
          }
          // if still unknown, try inr column (common case: inr=1, usd contains rate; or inr contains rate)
          if (isNaN(inrPerUsd) && !isNaN(inrVal)) {
        if (inrVal > 1) inrPerUsd = inrVal;
        else if (inrVal === 1 && !isNaN(usdVal) && usdVal > 0) inrPerUsd = 1 / usdVal;
          }
          if (!isNaN(inrPerUsd)) {
        window.currencyRates = { INR: inrPerUsd };
        console.debug('currencyRates loaded from cache', window.currencyRates);
        return window.currencyRates;
          }
        }
      } catch (e) {
        console.debug('currency cache load failed', e);
      }
      // final fallback default (sensible recent value)
      // fallback: use decimal USD-per-INR so multiplication yields USD
      window.currencyRates = { INR: 1 / 82.5 };
      console.debug('currencyRates fallback used', window.currencyRates);
      return window.currencyRates;
      })();
    }

    // pick berth hire rate row (by vessel type similar to port dues)
    let key = 'Others';
    const t = (cargo||'Others').toLowerCase();
    if(t.includes('tanker') || t.includes('oil') || t.includes('tank')) key='Tankers';
    else if(t.includes('container')) key='Container';
    else if(t.includes('roro') || t.includes('ro-ro')) key='RoRo';
    else if(t.includes('bulk') || t.includes('ore') || t.includes('iron')) key='Bulk Cargo';
  const selRow = berthHire.find(r=> r.vessel_type && r.vessel_type.trim().toLowerCase() === key.trim().toLowerCase()) || berthHire[0];
  const rate = selRow ? (tradeType==='Coastal' ? Number(selRow.coastal_rate) : Number(selRow.foreign_rate)) : NaN;
    if(isNaN(rate)){ console.debug('lookupBerthHire: no numeric rate found, row=',row); return null; }
    const inrPerUsd = (window.currencyRates && window.currencyRates.INR) || 82.5;
    const gtN = Number(gt) || 0;
    // Apply formula: Berth Hire (INR) = GT * StayHours * Rate * ER
    const amount = gtN * hours * rate * inrPerUsd;
    console.debug('lookupBerthHire: key',key,'rate',rate,'gt',gtN,'hours',hours,'ER',inrPerUsd,'amount',amount);
    return amount;
  }

  function renderResults(preferredBerths, stayHours, charges, tradeType){
    resultsWrap.innerHTML = '';
    const tabs = document.createElement('div'); tabs.style.display='flex'; tabs.style.gap='10px';
    const logBtn = document.getElementById('logisticBtn') || (function(){
      const b = document.createElement('button'); b.id='logisticBtn'; b.textContent='Logistics Simulator'; return b;
    })();
    const costBtn = document.getElementById('costBtn') || (function(){
      const b = document.createElement('button'); b.id='costBtn'; b.textContent='Cost Simulator'; return b;
    })();
    if(!tabs.contains(logBtn)) tabs.appendChild(logBtn);
    if(!tabs.contains(costBtn)) tabs.appendChild(costBtn);
    resultsWrap.appendChild(tabs);

    const logPanel = document.createElement('div');
    const costPanel = document.createElement('div');
    logPanel.style.marginTop='12px'; costPanel.style.marginTop='12px';

    logPanel.innerHTML = `<h3>Vessel Logistics Simulator</h3>
      <p><strong>Preferred Berths:</strong> ${preferredBerths.length? preferredBerths.join(', '): 'No suitable berths found'}</p>
      <p><strong>Stay at Berth:</strong> ${stayHours} hours</p>`;
    if (tradeType === 'Foreign') {
      console.log('fuk nigga', tradeType);
      costPanel.innerHTML = `<h3>Vessel Cost Simulator</h3>
      <p><strong>Port Dues (USD):</strong> ${charges.portDues!=null? charges.portDues.toFixed(2): 'N/A'}</p>
      <p><strong>Pilotage (USD):</strong> ${charges.pilotage!=null? charges.pilotage.toFixed(2): 'N/A'}</p>
      <p><strong>Berth Hire (USD):</strong> ${charges.berthHire!=null? charges.berthHire.toFixed(2): 'N/A'}</p>`;

    }
    else {
      console.log('fuk  '+toString(tradeType));
    costPanel.innerHTML = `<h3>Vessel Cost Simulator</h3>
      <p><strong>Port Dues (INR):</strong> ${charges.portDues!=null? charges.portDues.toFixed(2): 'N/A'}</p>
      <p><strong>Pilotage (INR):</strong> ${charges.pilotage!=null? charges.pilotage.toFixed(2): 'N/A'}</p>
      <p><strong>Berth Hire (INR):</strong> ${charges.berthHire!=null? charges.berthHire.toFixed(2): 'N/A'}</p>`;
    }
    resultsWrap.appendChild(logPanel); resultsWrap.appendChild(costPanel);
    logPanel.style.display='block'; costPanel.style.display='none';

    logBtn.onclick = ()=>{ logPanel.style.display='block'; costPanel.style.display='none'; };
    costBtn.onclick = ()=>{ logPanel.style.display='none'; costPanel.style.display='block'; };
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    const fd = new FormData(form);
    const tradeType = fd.get('tradeType') || 'Foreign';
    const gt = Number(fd.get('gt')) || 0;
    const loa = Number(fd.get('loa')) || 0;
    const draft = Number(fd.get('draft')) || 0;
    const beam = Number(fd.get('beam')) || 0;
    const cargo = fd.get('cargo');
    const qty = Number(fd.get('cargoQty')) || 0;

    rightPanel.style.display = 'flex'; costBtns.style.display = 'flex';

    const berths = findEligibleBerths({loa,draft,beam,cargo});
    const stay = estimateStayHours(cargo, qty);
  const portDuesVal = lookupPortDues(gt, tradeType, cargo) || 0;
  const pilotageVal = lookupPilotage(gt, tradeType, cargo) || 0;
  const berthHireVal = lookupBerthHire(stay, gt, tradeType, cargo) || 0;

    renderResults(berths, stay, {portDues: portDuesVal, pilotage: pilotageVal, berthHire: berthHireVal, tradeType: tradeType});
  });

  document.getElementById('resetBtn').onclick = ()=>{ form.reset(); resultsWrap.innerHTML=''; rightPanel.style.display='none'; };
  document.getElementById('backBtn').onclick = function(){ window.location.href = '../dashboard.html'; };

});

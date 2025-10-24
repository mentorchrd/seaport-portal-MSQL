/* Vessel simulator script
   - loads CSV masters from /db
   - finds eligible berths (2-5) using LOA/Draft checks against VM_berth_master
   - estimates stay hours using a simple cargo norm: default manual throughput rate (mt/day)
   - computes Port Dues, Pilotage and Berth Hire from CSVs
*/

async function fetchText(url){
  // Try the provided URL first, then several fallback relative prefixes so that the code works
  // whether the server is serving from project root or the vessel folder.
  const tryFetch = async (u)=>{
    try{
      const r = await fetch(u);
      if(!r.ok) throw new Error('fetch failed '+u+' status='+r.status);
      return await r.text();
    }catch(e){
      throw e;
    }
  };

  const original = url;
  const suffix = url.replace(/^\/+/,''); // remove leading slashes
  const candidates = [original, './'+suffix, '../'+suffix, '../../'+suffix, suffix, window.location.origin + '/' + suffix];
  let lastErr = null;
  for(const c of candidates){
    try{
      const txt = await tryFetch(c);
      if(c !== original) console.debug('fetchText: resolved', original, 'via', c);
      return txt;
    }catch(err){
      lastErr = err;
      // try next
    }
  }
  // none worked
  throw new Error('All fetch attempts failed for ' + url + ' last error: ' + (lastErr && lastErr.message));
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
  // New UI element IDs (fall back to older ids where present)
  const calculateCostBtn = document.getElementById('calculateCostBtn');
  const calculateLogisticsBtn = document.getElementById('calculateLogisticsBtn');
  const costPanel = document.getElementById('costPanel');
  const logisticsPanel = document.getElementById('logisticsPanel');
  const totalCostValue = document.getElementById('totalCostValue');
  const wharfageVal = document.getElementById('wharfageVal');
  const demurrageVal = document.getElementById('demurrageVal');
  const subtotalVal = document.getElementById('subtotalVal');
  const taxesVal = document.getElementById('taxesVal');
  const handlingHoursEl = document.getElementById('handlingHours');
  const berthsList = document.getElementById('berthsList');

  // attempt to find older controls too (backwards compatibility)
  const oldForm = document.getElementById('vesselForm');
  const oldCargoSelect = document.getElementById('cargoSelect');

  // results area for older UI (kept for compatibility)
  let resultsWrap = document.getElementById('resultsWrap');
  if(!resultsWrap){ resultsWrap = document.createElement('div'); resultsWrap.id = 'resultsWrap'; resultsWrap.style.marginTop='18px'; }

  // load masters: prefer server-side MySQL API (/api/:table) then fallback to CSV in /db/*.csv
  let berthMaster = [], berthHire = [], portDues = [], pilotage = [], cargoMaster = [], currencyLookup = [];

  async function fetchRows(tableName){
    // try API first
    try{
      const res = await fetch('/api/' + tableName);
      if(res.ok){
        const js = await res.json();
        if(Array.isArray(js)) return js;
      }
    }catch(e){
      // ignore and try CSV fallback
    }
    // CSV fallback (keeps existing behavior for deployments without server API)
    try{
      const txt = await fetchText('/db/' + tableName + '.csv');
      return parseCSV(txt);
    }catch(e){
      console.error('Both API and CSV fetch failed for', tableName, e);
      return [];
    }
  }

  try{
    [berthMaster, berthHire, portDues, pilotage, cargoMaster, currencyLookup] = await Promise.all([
      fetchRows('VM_berth_master'),
      fetchRows('VM_berth_hire'),
      fetchRows('VM_port_dues'),
      fetchRows('VM_Pilotage_Master_with_Category'),
      fetchRows('CM_CargoMaster'),
      fetchRows('VM_currency_lookup')
    ]);
  }catch(err){
    console.error('Error loading masters', err);
  }

  // initialize currencyRates from loaded currencyLookup (if available)
  try{
    if(Array.isArray(currencyLookup) && currencyLookup.length>0){
      const r = currencyLookup[0];
      // find INR or USD fields case-insensitively
      const keyMap = {};
      Object.keys(r).forEach(k => { if(k) keyMap[k.trim().toLowerCase()] = k; });
      const inrKey = keyMap['inr'] || keyMap['indian rupee'] || keyMap['rs'] || keyMap['rupee'];
      const usdKey = keyMap['usd'] || keyMap['dollar'];
      let inrPerUsd = NaN;
      const inrVal = inrKey ? Number(r[inrKey]) : NaN;
      const usdVal = usdKey ? Number(r[usdKey]) : NaN;
      if(!isNaN(usdVal)){
        if(usdVal > 1) inrPerUsd = usdVal;
        else if (usdVal > 0) inrPerUsd = 1 / usdVal;
      }
      if(isNaN(inrPerUsd) && !isNaN(inrVal)){
        if(inrVal > 1) inrPerUsd = inrVal;
      }
  if(!isNaN(inrPerUsd)) window.currencyRates = { INR: inrPerUsd };
  if(window.currencyRates && !window._currencyRatesPromise) window._currencyRatesPromise = Promise.resolve(window.currencyRates);
    }
  }catch(e){ console.debug('currency init failed', e); }

  // Populate cargo options into either old or new select
  try{
    const cargoNames = [...new Set(cargoMaster.map(r=>r['Cargo Description']).filter(Boolean))].sort();
    const target = oldCargoSelect || document.getElementById('cargoName');
    if(target){
      target.innerHTML = '<option value="">Select Cargo</option>';
      cargoNames.forEach(name=>{ const opt = document.createElement('option'); opt.value = name; opt.textContent = name; target.appendChild(opt); });
    }
    // when cargo changes, update the cargoGroup display if present
    const cargoGroupEl = document.getElementById('cargoGroup');
    const updateCargoGroup = (val)=>{
      if(!val){ if(cargoGroupEl) cargoGroupEl.value = ''; return; }
      const match = cargoMaster.find(r=> ((r['Cargo Description']||'').trim().toLowerCase() === (val||'').trim().toLowerCase()) || ((r['Cargo Short Name']||'').trim().toLowerCase() === (val||'').trim().toLowerCase()));
      if(match){
        // prefer Cargo Category Name, then Cargo Type Name, then Cargo Sub Category Name
        const group = match['Cargo Category Name'] || match['Cargo Type Name'] || match['Cargo Sub Category Name'] || match['Cargo Category'] || '';
        if(cargoGroupEl) cargoGroupEl.value = group || '';
      } else {
        if(cargoGroupEl) cargoGroupEl.value = '';
      }
    };
    if(target){
      target.addEventListener('change', (ev)=> updateCargoGroup(ev.target.value));
      // set initial if any
      if(target.value) updateCargoGroup(target.value);
    }
  }catch(e){
    console.warn('could not load cargo master, using default options');
    const fallback = oldCargoSelect || document.getElementById('cargoName');
    if(fallback){ ['General Cargo','Bulk Cargo','Container','Liquid Bulk'].forEach(name=>{const opt=document.createElement('option');opt.value=name;opt.textContent=name;fallback.appendChild(opt);}); }
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
        const txt = await fetchText('/db/VM_currency_lookup.csv');
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
  // Use INR per USD (approx). This value is used as multiplier when converting USD rates to INR.
  window.currencyRates = { INR: 82.5 };
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
  // small helper: format INR
  function formatINR(x){
    if(x==null || isNaN(Number(x))) return '₹0';
    const num = Number(x);
    return '₹' + num.toLocaleString('en-IN', {maximumFractionDigits:0});
  }

  // Chart handling
  let costChart = null;
  function renderChart(wharfage, demurrage, taxes){
    const ctx = document.getElementById('costChart');
    if(!ctx) return;
    if(costChart) costChart.destroy();
    // display values in lakhs for better readability on chart
    const data = [wharfage/100000, demurrage/100000, taxes/100000];
    costChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Wharfage (lakhs)','Demurrage (lakhs)','Taxes (lakhs)'],
        datasets: [{ data: data, backgroundColor: ['#3b82f6','#60a5fa','#93c5fd'], borderColor: 'white', borderWidth: 2 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
  }

  // compute inputs from either old form or new UI
  function readInputs(){
    // prefer new UI fields
    const vesselTypeEl = document.getElementById('vesselType');
    const tradeType = (vesselTypeEl && vesselTypeEl.value && vesselTypeEl.value.trim().toLowerCase() === 'domestic') ? 'Coastal' : 'Foreign';
    const gt = Number(document.getElementById('gt') ? document.getElementById('gt').value : (oldForm ? (oldForm.querySelector('[name="gt"]')||{value:0}).value : 0)) || 0;
    const loa = Number(document.getElementById('loa') ? document.getElementById('loa').value : (oldForm ? (oldForm.querySelector('[name="loa"]')||{value:0}).value : 0)) || 0;
    const draft = Number(document.getElementById('draft') ? document.getElementById('draft').value : (oldForm ? (oldForm.querySelector('[name="draft"]')||{value:0}).value : 0)) || 0;
    const beam = Number(document.getElementById('beam') ? document.getElementById('beam').value : (oldForm ? (oldForm.querySelector('[name="beam"]')||{value:0}).value : 0)) || 0;
    const cargo = (document.getElementById('cargoName') ? document.getElementById('cargoName').value : (oldCargoSelect ? oldCargoSelect.value : '')) || '';
    const qty = Number(document.getElementById('weight') ? document.getElementById('weight').value : (oldForm ? (oldForm.querySelector('[name="cargoQty"]')||{value:0}).value : 0)) || 0;
    const daysAfterFree = Number(document.getElementById('daysAfterFree') ? document.getElementById('daysAfterFree').value : (document.getElementById('daysAfterFree') ? document.getElementById('daysAfterFree').value : 0)) || 0;
    const qtyDelivered = Number(document.getElementById('quantityDelivered') ? document.getElementById('quantityDelivered').value : qty) || qty;
    return { tradeType, gt, loa, draft, beam, cargo, qty, daysAfterFree, qtyDelivered };
  }

  // compute and render both cost & logistics
  function computeAndRender(){
    const inp = readInputs();
    const berths = findEligibleBerths({loa: inp.loa, draft: inp.draft, beam: inp.beam, cargo: inp.cargo});
    const stayHours = estimateStayHours(inp.cargo, inp.qty);
    const portDuesVal = lookupPortDues(inp.gt, inp.tradeType, inp.cargo) || 0;
    const pilotageVal = lookupPilotage(inp.gt, inp.tradeType, inp.cargo) || 0;
    const berthHireVal = lookupBerthHire(stayHours, inp.gt, inp.tradeType, inp.cargo) || 0;

    // demurrage: try to get rate from cargo master, fallback to default INR per ton/day
    let demurrageRate = null;
    try{
      const row = cargoMaster.find(r=> (r['Cargo Description']||'').trim().toLowerCase() === (inp.cargo||'').trim().toLowerCase());
      if(row){ demurrageRate = Number(row.DEMURRAGE_RATE_PR_DAY || row.DEMURRAGE_RATE || row.demurrage_rate) || null; }
    }catch(e){ }
    if(!demurrageRate || isNaN(demurrageRate)) demurrageRate = 50; // INR per ton per day default
    const demurrageAmount = inp.daysAfterFree > 0 ? (inp.daysAfterFree * inp.qtyDelivered * demurrageRate) : 0;

    const subtotal = (portDuesVal||0) + (pilotageVal||0) + (berthHireVal||0) + demurrageAmount;
    const taxes = subtotal * 0.18;
    const total = subtotal + taxes;

    // update cost panel values
    if(totalCostValue) totalCostValue.textContent = formatINR(total);
    if(wharfageVal) wharfageVal.textContent = formatINR(portDuesVal);
    if(demurrageVal) demurrageVal.textContent = formatINR(demurrageAmount);
    if(subtotalVal) subtotalVal.textContent = formatINR(subtotal);
    if(taxesVal) taxesVal.textContent = formatINR(taxes);

    // update logistics panel
    if(handlingHoursEl) handlingHoursEl.textContent = String(stayHours);
    if(berthsList) berthsList.innerHTML = '<div class="logistics-item-label">' + (berths.length? berths.join(', ') : 'No suitable berths found') + '</div>';

    // render chart (values in INR converted to lakhs for chart)
    renderChart(portDuesVal, demurrageAmount, taxes);

    return { berths, stayHours, amounts: { portDuesVal, pilotageVal, berthHireVal, demurrageAmount, subtotal, taxes, total } };
  }

  // wire buttons
  if(calculateCostBtn){
    calculateCostBtn.addEventListener('click', ()=>{
      const res = computeAndRender();
      if(costPanel){ costPanel.classList.add('active'); costPanel.setAttribute('aria-hidden','false'); }
      if(logisticsPanel){ logisticsPanel.classList.remove('active'); logisticsPanel.setAttribute('aria-hidden','true'); }
    });
  }
  if(calculateLogisticsBtn){
    calculateLogisticsBtn.addEventListener('click', ()=>{
      const res = computeAndRender();
      if(logisticsPanel){ logisticsPanel.classList.add('active'); logisticsPanel.setAttribute('aria-hidden','false'); }
      if(costPanel){ costPanel.classList.remove('active'); costPanel.setAttribute('aria-hidden','true'); }
    });
  }

  // initial hide
  if(costPanel) costPanel.classList.remove('active');
  if(logisticsPanel) logisticsPanel.classList.remove('active');

});

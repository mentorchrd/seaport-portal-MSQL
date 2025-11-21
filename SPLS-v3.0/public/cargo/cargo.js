/* Cargo charges calculator
   - Wharfage based on SoRNoCode from cargo master
   - Demurrage based on cargo rates and days after free period
*/

async function fetchText(url){
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
  const suffix = url.replace(/^\/+/,'');
  const candidates = [original, './'+suffix, '../'+suffix, '../../'+suffix, suffix, window.location.origin + '/' + suffix];
  let lastErr = null;
  for(const c of candidates){
    try{
      const txt = await tryFetch(c);
      if(c !== original) console.debug('fetchText: resolved', original, 'via', c);
      return txt;
    }catch(err){
      lastErr = err;
    }
  }
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
  const calculateCostBtn = document.getElementById('calculateCostBtn');
  const costPanel = document.getElementById('costPanel');
  const totalCostValue = document.getElementById('totalCostValue');
  const wharfageValEl = document.getElementById('wharfageVal');
  const demurrageValEl = document.getElementById('demurrageVal');
  const subtotalVal = document.getElementById('subtotalVal');
  const taxesVal = document.getElementById('taxesVal');

  let cargoDescriptions = [];
  let selectedCargoData = null;

  async function fetchCargoDescriptions(){
    try {
      const res = await fetch('/api/mysql/cargo-descriptions');
      if (res.ok) {
        const js = await res.json();
        if (Array.isArray(js)) return js;
      }
    } catch (e) {
      console.error('Failed to fetch cargo descriptions', e);
    }
    try {
      const txt = await fetchText('/db/CM_CargoMaster.csv');
      const rows = parseCSV(txt);
      return rows.map(r => ({
        CargoDescription: r['CargoDescription'] || r['Cargo Description'],
        CargoCategoryName: r['CargoCategoryName'] || r['Cargo Category Name']
      })).filter(r => r.CargoDescription);
    } catch (err) {
      console.error('Both MySQL and CSV fetch failed for cargo descriptions', err);
      return [];
    }
  }

  async function fetchCargoDetails(description) {
    try {
      const res = await fetch(`/api/mysql/cargo-details/${encodeURIComponent(description)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('Failed to fetch cargo details', e);
    }
    return null;
  }

  async function fetchWharfageRates(sorNoCode) {
    if (!sorNoCode) return null;
    try {
      const res = await fetch(`/api/mysql/wharfage?sor=${encodeURIComponent(sorNoCode)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('Failed to fetch wharfage rates', e);
    }
    return null;
  }

  try {
    cargoDescriptions = await fetchCargoDescriptions();
  } catch(err) {
    console.error('Error loading cargo descriptions', err);
  }

  // Populate cargo options
  try {
    const target = document.getElementById('cargoName');
    const cargoGroupEl = document.getElementById('cargoGroup');
    
    if (target) {
      target.innerHTML = '<option value="">Select Cargo</option>';
      cargoDescriptions.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.CargoDescription;
        opt.textContent = item.CargoDescription;
        opt.dataset.category = item.CargoCategoryName || '';
        target.appendChild(opt);
      });
      
      target.addEventListener('change', async (ev) => {
        const val = ev.target.value;
        if (!val) {
          if (cargoGroupEl) cargoGroupEl.value = '';
          selectedCargoData = null;
          return;
        }
        
        const selectedOption = ev.target.options[ev.target.selectedIndex];
        if (cargoGroupEl && selectedOption) {
          cargoGroupEl.value = selectedOption.dataset.category || '';
        }
        
        selectedCargoData = await fetchCargoDetails(val);
        
        if (selectedCargoData && selectedCargoData.SoRNoCode) {
          selectedCargoData.wharfageRates = await fetchWharfageRates(selectedCargoData.SoRNoCode);
        }
      });
    }
  } catch (e) {
    console.warn('could not load cargo descriptions', e);
  }

  function lookupWharfage(weight, tradeType) {
    if (!selectedCargoData || !selectedCargoData.wharfageRates) {
      console.debug('lookupWharfage: no wharfage rates available');
      return null;
    }
    
    const rates = selectedCargoData.wharfageRates;
    const rate = tradeType === 'Coastal' ? Number(rates.coastal_rate) : Number(rates.foreign_rate);
    
    if (isNaN(rate)) {
      console.debug('lookupWharfage: invalid rate', rates);
      return null;
    }
    
    const amount = weight * rate;
    console.debug('lookupWharfage: weight', weight, 'tradeType', tradeType, 'rate', rate, 'amount', amount);
    return amount;
  }

  function formatINR(x){
    if(x==null || isNaN(Number(x))) return '₹0';
    const num = Number(x);
    return '₹' + num.toLocaleString('en-IN', {maximumFractionDigits:0});
  }

  let costChart = null;
  function renderChart(wharfage, demurrage, taxes){
    const ctx = document.getElementById('costChart');
    if(!ctx) return;
    if(costChart) costChart.destroy();
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

  function readInputs(){
    const tradeTypeEl = document.getElementById('tradeType');
    const tradeType = tradeTypeEl ? tradeTypeEl.value : 'Foreign';
    const weight = Number(document.getElementById('weight').value) || 0;
    const daysAfterFree = Number(document.getElementById('daysAfterFree').value) || 0;
    const qtyDelivered = Number(document.getElementById('quantityDelivered').value) || weight;
    return { tradeType, weight, daysAfterFree, qtyDelivered };
  }

  function computeAndRender(){
    const inp = readInputs();
    const wharfageVal = lookupWharfage(inp.weight, inp.tradeType) || 0;

    let demurrageRate = null;
    if(selectedCargoData){
      demurrageRate = Number(selectedCargoData.DEMURRAGE_RATE_PR_DAY || selectedCargoData.DEMURRAGE_RATE || selectedCargoData.demurrage_rate) || null;
    }
    if(!demurrageRate || isNaN(demurrageRate)) demurrageRate = 50;
    const demurrageAmount = inp.daysAfterFree > 0 ? (inp.daysAfterFree * inp.qtyDelivered * demurrageRate) : 0;

    const subtotal = (wharfageVal||0) + demurrageAmount;
    const taxes = subtotal * 0.18;
    const total = subtotal + taxes;

    if(totalCostValue) totalCostValue.textContent = formatINR(total);
    if(wharfageValEl) wharfageValEl.textContent = formatINR(wharfageVal);
    if(demurrageValEl) demurrageValEl.textContent = formatINR(demurrageAmount);
    if(subtotalVal) subtotalVal.textContent = formatINR(subtotal);
    if(taxesVal) taxesVal.textContent = formatINR(taxes);

    renderChart(wharfageVal, demurrageAmount, taxes);

    return { amounts: { wharfageVal, demurrageAmount, subtotal, taxes, total } };
  }

  if(calculateCostBtn){
    calculateCostBtn.addEventListener('click', ()=>{
      computeAndRender();
    });
  }
});

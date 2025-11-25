/* Shared utility functions for SPLS modules
   - CSV parsing and data fetching
   - Currency formatting
   - Common API calls
*/

// Fetch text with multiple fallback paths
export async function fetchText(url){
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

// Parse CSV text into array of objects
export function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim()!=='');
  const hdr = lines[0].split(',').map(h=>h.trim());
  return lines.slice(1).map(l=>{
    const cols = l.split(',');
    const obj = {};
    hdr.forEach((h,i)=> obj[h]=cols[i] ? cols[i].trim() : '');
    return obj;
  });
}

// Fetch cargo descriptions from MySQL API or CSV fallback
export async function fetchCargoDescriptions(){
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
      CargoCategoryName: r['CargoCategoryName'] || r['Cargo Category Name'],
      DSCHRG_RATE_PR_DAY: r['DSCHRG_RATE_PR_DAY'],
      LD_RATE_PR_DAY: r['LD_RATE_PR_DAY']
    })).filter(r => r.CargoDescription);
  } catch (err) {
    console.error('Both MySQL and CSV fetch failed for cargo descriptions', err);
    return [];
  }
}

// Fetch cargo details by description
export async function fetchCargoDetails(description) {
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

// Fetch wharfage rates by SoR code
export async function fetchWharfageRates(sorNoCode) {
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

// Generic fetch for table/CSV with fallback
export async function fetchRows(tableName){
  if (tableName === 'cargo_descriptions') {
    return await fetchCargoDescriptions();
  }
  // Try API first
  try{
    const res = await fetch('/api/' + tableName);
    if(res.ok){
      const js = await res.json();
      if(Array.isArray(js)) return js;
    }
  }catch(e){
    // ignore and try CSV fallback
  }
  // Fallback to CSV
  try{
    const txt = await fetchText('/db/' + tableName + '.csv');
    return parseCSV(txt);
  }catch(e){
    console.error('Both API and CSV fetch failed for', tableName, e);
    return [];
  }
}

// Format number as Indian Rupees
export function formatINR(x){
  if(x==null || isNaN(Number(x))) return '₹0';
  const num = Number(x);
  return '₹' + num.toLocaleString('en-IN', {maximumFractionDigits:0});
}

// Find eligible berths based on vessel and cargo requirements
export function findEligibleBerths({loa, draft, beam, cargo}, berthMaster){
  const isYes = v => {
    if(v==null) return false;
    const s = String(v).trim().toLowerCase();
    return s === 'yes' || s === 'y' || s === 'true' || s === '1';
  };

  const candidates = berthMaster.filter(b=>{
    const quay = parseFloat(b.Quay_Len) || 0;
    const berthDraft = parseFloat(b.Draft) || 0;
    const berthBeam = parseFloat(b.Beam) || 999;
    
    let cargoOk = false;
    if(cargo){
      const low = cargo.toLowerCase();
      if(low.includes('container')){
        cargoOk = isYes(b.Container);
      }
      else if(low.includes('liquid') && low.includes('bulk')){
        cargoOk = isYes(b.Liquid_Bulk);
      }
      else if(low.includes('liquid') || low.includes('tank') || low.includes('tanker') || low.includes('oil')){
        cargoOk = isYes(b.Liquid_Bulk);
      }
      else if(low.includes('bulk') || low.includes('ore') || low.includes('iron') || low.includes('coal') || low.includes('grain')){
        cargoOk = isYes(b.Bulk);
      }
      else if(low.includes('roro') || low.includes('ro-ro')){
        cargoOk = isYes(b.RORO);
      }
      else if(low.includes('pol')){
        cargoOk = isYes(b.POL);
      }
      else if(low.includes('passenger') || low.includes('cruise')){
        cargoOk = isYes(b.PassnCruise);
      }
      else if(low.includes('bunker')){
        cargoOk = isYes(b.Bunker);
      }
      else {
        const hasSpecializedType = isYes(b.Container) || isYes(b.Liquid_Bulk) || isYes(b.RORO) || 
                                   isYes(b.POL) || isYes(b.PassnCruise) || isYes(b.Bunker);
        cargoOk = !hasSpecializedType && isYes(b.Bulk);
      }
    } else {
      cargoOk = isYes(b.Bulk);
    }
    
    return quay >= loa && berthDraft >= draft && beam <= berthBeam && cargoOk;
  });

  // Group berths by Dock_Name
  const dockGroups = {};
  candidates.forEach(b => {
    const dock = b.Dock_Name || 'Unknown Dock';
    if(!dockGroups[dock]) dockGroups[dock] = [];
    dockGroups[dock].push(b.BerthName);
  });

  // Format as HTML with dock name and berths
  const formatted = Object.keys(dockGroups).map(dock => {
    const berths = dockGroups[dock].slice(0, 5).map(b => ` • ${b}`).join('<br>');
    return `<b>${dock}</b><br>${berths}`;
  });

  return formatted;
}

// Estimate handling time based on cargo type and quantity
export function estimateHandlingTime(cargo, quantity, selectedCargoData) {
  let rateMtPerDay = 1000; // default
  
  if (selectedCargoData) {
    const rate = Number(selectedCargoData.DSCHRG_RATE_PR_DAY) || Number(selectedCargoData.LD_RATE_PR_DAY);
    if (rate && rate > 0) rateMtPerDay = rate;
  } else if (cargo) {
    const name = cargo.toLowerCase();
    if(name.includes('grain') || name.includes('food')) rateMtPerDay = 800;
    if(name.includes('iron') || name.includes('ore')) rateMtPerDay = 2500;
    if(name.includes('cement') || name.includes('clinker')) rateMtPerDay = 1200;
    if(name.includes('container')) rateMtPerDay = 400;
    if(name.includes('liquid') || name.includes('oil') || name.includes('diesel') || name.includes('tank')) rateMtPerDay = 5000;
  }

  const days = Math.max((quantity || 0) / rateMtPerDay, 0.1);
  return Math.round(days * 24);
}

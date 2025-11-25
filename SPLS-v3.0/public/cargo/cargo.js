/* Cargo charges calculator
   - Wharfage based on SoRNoCode from cargo master (weight/value/unit based)
   - Demurrage with slab-based rates
   - Container handling charges
   - Berth allocation and logistics
*/

import { fetchText, parseCSV, fetchCargoDescriptions, fetchCargoDetails, fetchWharfageRates, formatINR, findEligibleBerths, estimateHandlingTime } from '../utils.js';

document.addEventListener('DOMContentLoaded', async ()=>{
  const calculateCostBtn = document.getElementById('calculateCostBtn');
  const calculateLogisticsBtn = document.getElementById('calculateLogisticsBtn');
  const costPanel = document.getElementById('costPanel');
  const logisticsPanel = document.getElementById('logisticsPanel');
  const totalCostValue = document.getElementById('totalCostValue');
  const wharfageValEl = document.getElementById('wharfageVal');
  const demurrageValEl = document.getElementById('demurrageVal');
  const subtotalVal = document.getElementById('subtotalVal');
  const taxesVal = document.getElementById('taxesVal');
  const handlingHoursEl = document.getElementById('handlingHours');
  const berthsList = document.getElementById('berthsList');

  // Mode selector elements
  const cargoModeSection = document.getElementById('cargoModeSection');
  const containerModeSection = document.getElementById('containerModeSection');
  const modeRadios = document.querySelectorAll('input[name="cargoMode"]');
  const containerTypeSelect = document.getElementById('containerType');
  const standardContainerInputs = document.getElementById('standardContainerInputs');
  const shipperOwnInputs = document.getElementById('shipperOwnInputs');

  let cargoDescriptions = [];
  let selectedCargoData = null;
  let berthMaster = [];
  let demCharges = [];
  let exchangeRate = 88.46; // Default USD to INR rate
  let currentMode = 'cargo';

  // Mode switching logic
  modeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      currentMode = e.target.value;
      if(currentMode === 'cargo'){
        cargoModeSection.classList.remove('hidden');
        containerModeSection.classList.add('hidden');
      } else {
        cargoModeSection.classList.add('hidden');
        containerModeSection.classList.remove('hidden');
      }
    });
  });

  // Container type change handler
  containerTypeSelect.addEventListener('change', (e) => {
    const type = e.target.value;
    if(type === 'Shipper Own'){
      standardContainerInputs.classList.add('hidden');
      shipperOwnInputs.classList.remove('hidden');
    } else {
      standardContainerInputs.classList.remove('hidden');
      shipperOwnInputs.classList.add('hidden');
    }
  });

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

  async function fetchDemCharges() {
    try {
      const res = await fetch('/api/mysql/dem-charges');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('Failed to fetch demurrage charges', e);
    }
    try {
      const txt = await fetchText('/db/CM_Dem_Charges.csv');
      return parseCSV(txt);
    } catch (err) {
      console.error('Both MySQL and CSV fetch failed for demurrage charges', err);
      return [];
    }
  }

  async function fetchRows(tableName){
    try{
      const res = await fetch('/api/' + tableName);
      if(res.ok){
        const js = await res.json();
        if(Array.isArray(js)) return js;
      }
    }catch(e){
      // ignore and try CSV fallback
    }
    try{
      const txt = await fetchText('/db/' + tableName + '.csv');
      return parseCSV(txt);
    }catch(e){
      console.error('Both API and CSV fetch failed for', tableName, e);
      return [];
    }
  }

  async function fetchExchangeRate() {
    try {
      const txt = await fetchText('/db/ExchangeRateMaster.csv');
      const rows = parseCSV(txt);
      if (rows.length > 0) {
        // Get the latest rate (last row)
        const latest = rows[rows.length - 1];
        return Number(latest.ExchangeRate) || 88.46;
      }
    } catch (e) {
      console.error('Failed to fetch exchange rate', e);
    }
    return 88.46; // Default rate
  }

  try {
    [cargoDescriptions, demCharges, berthMaster, exchangeRate] = await Promise.all([
      fetchCargoDescriptions(),
      fetchDemCharges(),
      fetchRows('VM_berth_master'),
      fetchExchangeRate()
    ]);
    console.debug('Exchange rate loaded:', exchangeRate);
  } catch(err) {
    console.error('Error loading masters', err);
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

  function lookupWharfage(weight, tradeType, cargoValue) {
    if (currentMode === 'container') {
      const result = calculateContainerWharfage();
      return result.total;
    }

    if (!selectedCargoData || !selectedCargoData.wharfageRates) {
      console.debug('lookupWharfage: no wharfage rates available');
      return null;
    }
    
    const rates = selectedCargoData.wharfageRates;
    const costBasis = rates.Cost_basis || 'Weight';
    const rate = tradeType === 'Coastal' ? Number(rates.coastal_rate) : Number(rates.foreign_rate);
    
    if (isNaN(rate)) {
      console.debug('lookupWharfage: invalid rate', rates);
      return null;
    }
    
    let amount = 0;
    if (costBasis === 'Value') {
      // Ad valorem - rate is percentage
      amount = (cargoValue || 0) * (rate / 100);
      console.debug('lookupWharfage: value-based', cargoValue, 'rate%', rate, 'amount', amount);
    } else if (costBasis === 'Unit') {
      // Per unit
      amount = weight * rate;
      console.debug('lookupWharfage: unit-based', weight, 'rate', rate, 'amount', amount);
    } else {
      // Weight-based (default)
      amount = weight * rate;
      console.debug('lookupWharfage: weight-based', weight, 'rate', rate, 'amount', amount);
    }
    
    return amount;
  }

  function calculateContainerWharfage() {
    const containerType = document.getElementById('containerType').value;
    const tradeType = document.getElementById('containerTradeType').value;

    if (containerType === 'Shipper Own') {
      // Ad valorem for shipper own containers
      const cargoValue = Number(document.getElementById('shipperOwnCargoValue').value) || 0;
      const rate = tradeType === 'Foreign' ? 0.4250 : 0.2550;
      return { total: (cargoValue * rate / 100), containers: {} };
    }

    // Standard and MAFI containers - use fixed rates
    const rateTable = {
      'Standard': {
        'Empty': {
          'Upto 20 Feet': { Foreign: 127, Coastal: 76 },
          '20-40 Feet': { Foreign: 190, Coastal: 113 },
          'Above 40 Feet': { Foreign: 253, Coastal: 151 }
        },
        'Laden': {
          'Upto 20 Feet': { Foreign: 1252, Coastal: 750 },
          '20-40 Feet': { Foreign: 1878, Coastal: 1126 },
          'Above 40 Feet': { Foreign: 2503, Coastal: 1500 }
        }
      },
      'MAFI': {
        'Empty': {
          'Upto 20 Feet': { Foreign: 127, Coastal: 76 },
          '20-40 Feet': { Foreign: 190, Coastal: 113 },
          'Above 40 Feet': { Foreign: 253, Coastal: 151 }
        },
        'Laden': {
          'Upto 20 Feet': { Foreign: 127, Coastal: 76 },
          '20-40 Feet': { Foreign: 190, Coastal: 113 },
          'Above 40 Feet': { Foreign: 253, Coastal: 151 }
        }
      }
    };

    // Read container quantities from form
    const containers = {
      '20Empty': Number(document.getElementById('container20Empty').value) || 0,
      '20Laden': Number(document.getElementById('container20Laden').value) || 0,
      '2040Empty': Number(document.getElementById('container2040Empty').value) || 0,
      '2040Laden': Number(document.getElementById('container2040Laden').value) || 0,
      '40PlusEmpty': Number(document.getElementById('container40PlusEmpty').value) || 0,
      '40PlusLaden': Number(document.getElementById('container40PlusLaden').value) || 0
    };

    // Calculate wharfage for each category
    let totalWharfage = 0;
    const rates = rateTable[containerType];
    
    totalWharfage += containers['20Empty'] * (rates['Empty']['Upto 20 Feet'][tradeType] || 0);
    totalWharfage += containers['20Laden'] * (rates['Laden']['Upto 20 Feet'][tradeType] || 0);
    totalWharfage += containers['2040Empty'] * (rates['Empty']['20-40 Feet'][tradeType] || 0);
    totalWharfage += containers['2040Laden'] * (rates['Laden']['20-40 Feet'][tradeType] || 0);
    totalWharfage += containers['40PlusEmpty'] * (rates['Empty']['Above 40 Feet'][tradeType] || 0);
    totalWharfage += containers['40PlusLaden'] * (rates['Laden']['Above 40 Feet'][tradeType] || 0);

    console.debug('Container wharfage breakdown:', containers, 'total:', totalWharfage);
    
    return { total: totalWharfage, containers: containers };
  }

  function calculateDemurrage(daysAfterFree, quantity, operationType, storageType, tradeType, demCargo) {
    if (daysAfterFree <= 0 || quantity <= 0) return 0;

    // Find matching demurrage slab
    const matching = demCharges.filter(row => {
      const cargoMatch = row.DemCargo && row.DemCargo.toLowerCase().includes(demCargo.toLowerCase());
      const oprMatch = row.OprType === 'both' || row.OprType.toLowerCase() === operationType.toLowerCase();
      const tradeMatch = row.TradeType === 'both' || row.TradeType.toLowerCase() === tradeType.toLowerCase();
      const strMatch = row.StrType === 'any' || row.StrType.toLowerCase() === storageType.toLowerCase();
      
      return cargoMatch && oprMatch && tradeMatch && strMatch;
    });

    if (matching.length === 0) {
      console.debug('calculateDemurrage: no matching slabs found');
      return 0;
    }

    // Calculate demurrage for each slab
    let totalDemurrage = 0;
    let remainingDays = daysAfterFree;

    // Sort slabs by start day
    const sortedSlabs = matching.sort((a, b) => Number(a.DemStart_day) - Number(b.DemStart_day));

    for (const slab of sortedSlabs) {
      const slabStart = Number(slab.DemStart_day);
      const slabEnd = Number(slab.DemEnd_day);
      const slabRate = Number(slab.dem_rate);

      if (remainingDays <= 0) break;

      // Calculate days in this slab
      const daysInSlab = Math.min(remainingDays, slabEnd - slabStart + 1);
      
      // Apply rate and convert USD to INR if needed
      let slabAmount = quantity * daysInSlab * slabRate;
      const rateType = slab.RateType || 'INR';
      if (rateType.toUpperCase() === 'USD') {
        slabAmount = slabAmount * exchangeRate;
        console.debug(`Demurrage slab: days ${slabStart}-${slabEnd}, rate $${slabRate} (₹${(slabRate * exchangeRate).toFixed(2)}), daysInSlab ${daysInSlab}, amount ₹${slabAmount.toFixed(2)}`);
      } else {
        console.debug(`Demurrage slab: days ${slabStart}-${slabEnd}, rate ₹${slabRate}, daysInSlab ${daysInSlab}, amount ₹${slabAmount}`);
      }
      
      totalDemurrage += slabAmount;
      remainingDays -= daysInSlab;
    }

    return totalDemurrage;
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
    if (currentMode === 'cargo') {
      const tradeType = document.getElementById('tradeType').value;
      const weight = Number(document.getElementById('weight').value) || 0;
      const daysAfterFree = Number(document.getElementById('daysAfterFree').value) || 0;
      const qtyDelivered = Number(document.getElementById('quantityDelivered').value) || weight;
      const operationType = document.getElementById('operationType').value;
      const storageType = document.getElementById('storageType').value;
      const loa = Number(document.getElementById('loa').value) || 0;
      const draft = Number(document.getElementById('draft').value) || 0;
      const beam = Number(document.getElementById('beam').value) || 0;
      const cargo = document.getElementById('cargoName').value || '';
      const cargoValue = 0; // Not used in cargo mode unless wharfage is value-based
      
      return { tradeType, weight, daysAfterFree, qtyDelivered, operationType, storageType, 
               loa, draft, beam, cargo, cargoValue };
    } else {
      // Container mode
      const tradeType = document.getElementById('containerTradeType').value;
      const daysAfterFree = Number(document.getElementById('containerDaysAfterFree').value) || 0;
      const operationType = document.getElementById('containerOperationType').value;
      const loa = Number(document.getElementById('containerLoa').value) || 0;
      const draft = Number(document.getElementById('containerDraft').value) || 0;
      const beam = Number(document.getElementById('containerBeam').value) || 0;
      
      const containerType = document.getElementById('containerType').value;
      let quantity = 0;
      let cargoValue = 0;
      
      if (containerType === 'Shipper Own') {
        cargoValue = Number(document.getElementById('shipperOwnCargoValue').value) || 0;
        quantity = Number(document.getElementById('shipperOwnContainers').value) || 0;
      } else {
        // Calculate total containers from all size categories
        const container20Empty = Number(document.getElementById('container20Empty').value) || 0;
        const container20Laden = Number(document.getElementById('container20Laden').value) || 0;
        const container2040Empty = Number(document.getElementById('container2040Empty').value) || 0;
        const container2040Laden = Number(document.getElementById('container2040Laden').value) || 0;
        const container40PlusEmpty = Number(document.getElementById('container40PlusEmpty').value) || 0;
        const container40PlusLaden = Number(document.getElementById('container40PlusLaden').value) || 0;
        
        quantity = container20Empty + container20Laden + container2040Empty + 
                   container2040Laden + container40PlusEmpty + container40PlusLaden;
      }
      
      return { tradeType, weight: quantity, daysAfterFree, qtyDelivered: quantity, 
               operationType, storageType: 'any', loa, draft, beam, cargo: 'container', cargoValue };
    }
  }

  function computeAndRender(){
    const inp = readInputs();
    
    // Calculate wharfage
    let wharfageVal = 0;
    if (currentMode === 'container') {
      const result = calculateContainerWharfage();
      wharfageVal = result.total;
    } else {
      wharfageVal = lookupWharfage(inp.weight, inp.tradeType, inp.cargoValue) || 0;
    }

    // Determine cargo category for demurrage
    let demCargo = 'non-container';
    if (currentMode === 'container' || (selectedCargoData && selectedCargoData.CargoCategoryName && 
        selectedCargoData.CargoCategoryName.toLowerCase().includes('container'))) {
      demCargo = 'container';
    }

    // Calculate demurrage using slabs
    const demurrageAmount = calculateDemurrage(
      inp.daysAfterFree,
      inp.qtyDelivered,
      inp.operationType,
      inp.storageType,
      inp.tradeType,
      demCargo
    );

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

  function computeLogistics() {
    const inp = readInputs();
    const berths = findEligibleBerths({loa: inp.loa, draft: inp.draft, beam: inp.beam, cargo: inp.cargo}, berthMaster);
    const handlingTime = estimateHandlingTime(inp.cargo, inp.weight, selectedCargoData);

    if(handlingHoursEl) handlingHoursEl.textContent = String(handlingTime);
    if(berthsList) {
      if(berths.length) {
        berthsList.innerHTML = berths.map(b => '<div class="logistics-item-label">' + b + '</div>').join('');
      } else {
        berthsList.innerHTML = '<div class="logistics-item-label">No suitable berths found</div>';
      }
    }

    return { berths, handlingTime };
  }

  if(calculateCostBtn){
    calculateCostBtn.addEventListener('click', ()=>{
      computeAndRender();
      if(costPanel) {
        costPanel.classList.remove('hidden');
        logisticsPanel.classList.add('hidden');
      }
    });
  }

  if(calculateLogisticsBtn){
    calculateLogisticsBtn.addEventListener('click', ()=>{
      computeLogistics();
      if(logisticsPanel) {
        logisticsPanel.classList.remove('hidden');
        costPanel.classList.add('hidden');
      }
    });
  }
});

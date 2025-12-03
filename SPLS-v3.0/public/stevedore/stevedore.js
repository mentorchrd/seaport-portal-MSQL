/* Stevedore/Labour Module
   - Calculate number of gangs and work duration
   - Calculate composite stevedoring charges
   - Calculate royalty charges for stevedoring and shore handling
*/

import { fetchText, parseCSV, fetchCargoDescriptions, formatINR } from '../utils.js';

document.addEventListener('DOMContentLoaded', async ()=>{
  const calculateLogisticsBtn = document.getElementById('calculateLogisticsBtn');
  const calculateCostBtn = document.getElementById('calculateCostBtn');
  const logisticsPanel = document.getElementById('logisticsPanel');
  const costPanel = document.getElementById('costPanel');
  
  // Output elements
  const workDaysEl = document.getElementById('workDays');
  const gangsRequiredEl = document.getElementById('gangsRequired');
  const datumValueEl = document.getElementById('datumValue');
  const totalCostValue = document.getElementById('totalCostValue');
  const compositeVal = document.getElementById('compositeVal');
  const royaltyStevedoringVal = document.getElementById('royaltyStevedoringVal');
  const royaltyShoreVal = document.getElementById('royaltyShoreVal');
  const subtotalVal = document.getElementById('subtotalVal');
  const taxesVal = document.getElementById('taxesVal');

  let cargoMaster = [];
  let labourManningMaster = [];
  let labourDatumMaster = [];
  let compositeRateMaster = [];
  let royaltyMaster = [];
  let selectedCargoData = null;

  async function fetchRows(csvFileName){
    try{
      const txt = await fetchText('/db/' + csvFileName);
      return parseCSV(txt);
    }catch(e){
      console.error('CSV fetch failed for', csvFileName, e);
      return [];
    }
  }

  // Load all master data
  try {
    [cargoMaster, labourManningMaster, labourDatumMaster, compositeRateMaster, royaltyMaster] = await Promise.all([
      fetchCargoDescriptions(),
      fetchRows('LM_labourManningMaster.csv'),
      fetchRows('LM_labourDatumMaster.csv'),
      fetchRows('LM_CompositeRate.csv'),
      fetchRows('LM_RoyaltyMaster.csv')
    ]);
    console.debug('Masters loaded:', {cargoMaster: cargoMaster.length, manning: labourManningMaster.length, 
                    datum: labourDatumMaster.length, composite: compositeRateMaster.length, royalty: royaltyMaster.length});
  } catch(err) {
    console.error('Error loading masters', err);
  }

  // Populate cargo dropdown
  const cargoNameSelect = document.getElementById('cargoName');
  const cargoCategoryInput = document.getElementById('cargoCategory');
  const royaltyCargoTypeSelect = document.getElementById('royaltyCargoType');

  if (cargoNameSelect && cargoMaster.length > 0) {
    cargoMaster.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.CargoDescription;
      opt.textContent = item.CargoDescription;
      opt.dataset.category = item.CargoCategoryName || '';
      opt.dataset.dschrgRate = item.DSCHRG_RATE_PR_DAY || '1000';
      opt.dataset.ldRate = item.LD_RATE_PR_DAY || '1000';
      cargoNameSelect.appendChild(opt);
    });

    cargoNameSelect.addEventListener('change', (ev) => {
      const val = ev.target.value;
      if (!val) {
        cargoCategoryInput.value = '';
        selectedCargoData = null;
        return;
      }
      
      const selectedOption = ev.target.options[ev.target.selectedIndex];
      const category = selectedOption.dataset.category || '';
      cargoCategoryInput.value = category;
      
      selectedCargoData = {
        CargoDescription: val,
        CargoCategoryName: category,
        DSCHRG_RATE_PR_DAY: selectedOption.dataset.dschrgRate,
        LD_RATE_PR_DAY: selectedOption.dataset.ldRate
      };

      // Auto-detect royalty cargo type
      autoDetectRoyaltyType(category);
      
      // Update labour gang line dropdown based on 100-ton crane selection
      updateLabourGangLineOptions();
    });
  }

  // Populate royalty cargo type dropdown
  if (royaltyCargoTypeSelect && royaltyMaster.length > 0) {
    const uniqueTypes = [...new Set(royaltyMaster.map(r => r.RltyCargo_Type))].filter(t => t);
    uniqueTypes.forEach(type => {
      const opt = document.createElement('option');
      opt.value = type;
      opt.textContent = type;
      royaltyCargoTypeSelect.appendChild(opt);
    });
  }

  function autoDetectRoyaltyType(category) {
    if (!category) return;
    const catLower = category.toLowerCase();
    let detected = '';
    
    if (catLower.includes('container')) {
      detected = 'Container -Laden'; // Default, can be refined
    } else if (catLower.includes('dry bulk') || catLower.includes('bulk')) {
      detected = 'Dry Bulk';
    } else if (catLower.includes('break bulk')) {
      detected = 'Break Bulk except Automobiles';
    } else if (catLower.includes('automobile') || catLower.includes('vehicle')) {
      detected = 'Automobiles - Upto 4 wheelers';
    } else {
      detected = 'Break Bulk except Automobiles'; // Default
    }
    
    royaltyCargoTypeSelect.value = detected;
    console.debug('Auto-detected royalty type:', detected, 'from category:', category);
  }

  // Update labour gang line dropdown when crane selection changes
  const use100TonCraneSelect = document.getElementById('use100TonCrane');
  const labourGangLineSelect = document.getElementById('labourGangLine');

  use100TonCraneSelect.addEventListener('change', updateLabourGangLineOptions);

  function updateLabourGangLineOptions() {
    if (!labourGangLineSelect || labourDatumMaster.length === 0) return;
    
    const craneType = use100TonCraneSelect.value; // 'Y' or 'N'
    labourGangLineSelect.innerHTML = '<option value="">Select Labour Line</option>';
    
    const filtered = labourDatumMaster.filter(row => row['100_tons_Mobile_Crane'] === craneType);
    
    // Get unique line numbers with descriptions
    const uniqueLines = new Map();
    filtered.forEach(row => {
      const lineNo = row.LINE_NO;
      if (lineNo && !uniqueLines.has(lineNo)) {
        uniqueLines.set(lineNo, row.Cargo_Type_Description || lineNo);
      }
    });
    
    uniqueLines.forEach((desc, lineNo) => {
      const opt = document.createElement('option');
      opt.value = lineNo;
      opt.textContent = `${lineNo} - ${desc}`;
      labourGangLineSelect.appendChild(opt);
    });
    
    console.debug('Updated labour lines for crane type:', craneType, 'count:', uniqueLines.size);
  }

  // Initialize labour gang line options
  updateLabourGangLineOptions();

  function readInputs() {
    const cargoName = document.getElementById('cargoName').value;
    const weight = Number(document.getElementById('weight').value) || 0;
    const royaltyCargoType = document.getElementById('royaltyCargoType').value;
    const vesselTonnage = Number(document.getElementById('vesselTonnage').value) || 0;
    const use100TonCrane = document.getElementById('use100TonCrane').value;
    const labourGangLine = document.getElementById('labourGangLine').value;
    const shiftType = document.getElementById('shiftType').value;
    
    return { cargoName, weight, royaltyCargoType, vesselTonnage, use100TonCrane, labourGangLine, shiftType };
  }

  function getDatumColumn(tonnage) {
    // Note: For vessels, the columns represent LABOR HOURS per shift, not direct datum values
    // The actual interpretation depends on whether we're calculating gangs or time
    if (tonnage <= 100) return 'Datum_per_Crane';
    if (tonnage <= 150) return '101to150';
    if (tonnage <= 200) return '151to200';
    return 'Above200';
  }

  function calculateLogistics() {
    const inp = readInputs();
    
    if (!inp.cargoName || !inp.labourGangLine) {
      alert('Please select cargo and labour gang line');
      return null;
    }

    // Find datum row
    const datumRow = labourDatumMaster.find(row => 
      row.LINE_NO === inp.labourGangLine && 
      row['100_tons_Mobile_Crane'] === inp.use100TonCrane
    );

    if (!datumRow) {
      alert('No datum found for selected labour line');
      return null;
    }

    // IMPORTANT: Datum_per_Crane is in TONS per crane per shift
    // The other columns (101to150, etc.) are HOURS required per shift
    // For gang calculation, we ALWAYS use Datum_per_Crane (tons)
    const datumValue = Number(datumRow.Datum_per_Crane) || 1;
    
    console.debug('Datum lookup:', {line: inp.labourGangLine, datum: datumValue, 'tons per crane': datumValue});

    // Calculate number of gangs (round up)
    const gangsRequired = Math.ceil(inp.weight / datumValue);

    // Calculate work days using cargo norm
    let cargoNorm = 1000; // default
    if (selectedCargoData) {
      const dschrgRate = Number(selectedCargoData.DSCHRG_RATE_PR_DAY);
      const ldRate = Number(selectedCargoData.LD_RATE_PR_DAY);
      cargoNorm = Math.max(dschrgRate, ldRate) || 1000;
    }
    
    const workDays = Math.ceil(inp.weight / cargoNorm);

    return { gangsRequired, workDays, datumValue, cargoNorm };
  }

  function getManningForLine(lineNo) {
    // Get both OnBoard=Y and OnBoard=N rows for this line
    const onBoardRow = labourManningMaster.find(row => 
      row['LINE NO'] === lineNo && row.OnBoard === 'Y'
    );
    const shoreRow = labourManningMaster.find(row => 
      row['LINE NO'] === lineNo && row.OnBoard === 'N'
    );

    if (!onBoardRow || !shoreRow) {
      console.warn('Manning data incomplete for line:', lineNo);
      return null;
    }

    return { onBoardRow, shoreRow };
  }

  function calculateCompositeCharges(lineNo, shiftType, gangsRequired) {
    const manning = getManningForLine(lineNo);
    if (!manning) return 0;

    // Determine cargo type code for composite rate lookup
    // Try to match based on cargo category, default to ALLOTHCG
    let cargoTypeCode = 'ALLOTHCG';
    if (selectedCargoData && selectedCargoData.CargoCategoryName) {
      const catLower = selectedCargoData.CargoCategoryName.toLowerCase();
      if (catLower.includes('sugar') || catLower.includes('agri')) {
        cargoTypeCode = 'AGPSUBGS';
      }
    }

    console.debug('Using cargo type code for composite rates:', cargoTypeCode);

    // Calculate cost for ONE gang
    const categories = ['Tindal', 'Winch_driver', 'Signal_Man', 'Mazdoor', 'Maistry', 'Tally_clerk'];
    let gangCost = 0;

    categories.forEach(cat => {
      // Get number of workers from OnBoard row
      const count = Number(manning.onBoardRow[cat]) || 0;
      if (count === 0) return;

      // Find composite rate for this category
      const rateRow = compositeRateMaster.find(row => 
        row.Lab_Category === cat.replace('_', ' ') && 
        row.Shift === shiftType && 
        row.Type_Cargo === cargoTypeCode
      );

      if (rateRow) {
        const rate = Number(rateRow.Rate) || 0;
        gangCost += count * rate;
        console.debug(`${cat}: ${count} workers × ₹${rate} = ₹${count * rate}`);
      }
    });

    const totalComposite = gangCost * gangsRequired;
    console.debug('Composite charges:', {gangCost, gangsRequired, total: totalComposite});
    
    return totalComposite;
  }

  function calculateRoyalties(weight, royaltyCargoType) {
    if (!royaltyCargoType) return { stevedoring: 0, shoreHandling: 0 };

    const royaltyRow = royaltyMaster.find(row => row.RltyCargo_Type === royaltyCargoType);
    
    if (!royaltyRow) {
      console.warn('No royalty data found for:', royaltyCargoType);
      return { stevedoring: 0, shoreHandling: 0 };
    }

    const stevedoringRate = Number(royaltyRow.Stevedoring_Royalty) || 0;
    const shoreHandlingRate = Number(royaltyRow.ShoreHanding_Royalty) || 0;
    const uom = royaltyRow.UOM || 'ton';

    console.debug('Royalty rates:', {type: royaltyCargoType, stevedoringRate, shoreHandlingRate, uom});

    // Calculate based on weight (assuming weight input matches UOM)
    const stevedoring = weight * stevedoringRate;
    const shoreHandling = weight * shoreHandlingRate;

    return { stevedoring, shoreHandling };
  }

  function calculateCosts() {
    const inp = readInputs();
    const logistics = calculateLogistics();
    
    if (!logistics) return;

    // Calculate composite stevedoring charges
    const compositeCharges = calculateCompositeCharges(inp.labourGangLine, inp.shiftType, logistics.gangsRequired);

    // Calculate royalties
    const royalties = calculateRoyalties(inp.weight, inp.royaltyCargoType);

    const subtotal = compositeCharges + royalties.stevedoring + royalties.shoreHandling;
    const taxes = subtotal * 0.18;
    const total = subtotal + taxes;

    return {
      composite: compositeCharges,
      royaltyStevedoring: royalties.stevedoring,
      royaltyShore: royalties.shoreHandling,
      subtotal,
      taxes,
      total
    };
  }

  let costChart = null;
  function renderChart(composite, royaltyStevedoring, royaltyShore, taxes){
    const ctx = document.getElementById('costChart');
    if(!ctx) return;
    if(costChart) costChart.destroy();
    
    const data = [composite/100000, royaltyStevedoring/100000, royaltyShore/100000, taxes/100000];
    costChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Composite (lakhs)','Royalty-Stev (lakhs)','Royalty-Shore (lakhs)', 'Taxes (lakhs)'],
        datasets: [{ 
          data: data, 
          backgroundColor: ['#3b82f6','#60a5fa','#93c5fd', '#bfdbfe'], 
          borderColor: 'white', 
          borderWidth: 2 
        }]
      },
      options: { 
        responsive: true, 
        maintainAspectRatio: false, 
        plugins: { legend: { display: false } } 
      }
    });
  }

  // DEBUG: Testing function for validation
  window.debugStevedore = function() {
    console.log('%c=== STEVEDORE MODULE DEBUG ===', 'color: blue; font-weight: bold; font-size: 16px');
    
    // Test Case 1: Coal - Bulk Cargo, No Crane, Line 7F
    console.log('%c\nTest Case 1: Coal (Dry Bulk)', 'color: green; font-weight: bold');
    const test1 = {
      cargo: 'COAL',
      category: 'DRY BULK',
      weight: 10000,
      vesselTonnage: 5000,
      use100TonCrane: 'N',
      labourGangLine: '7F',
      shiftType: 'Full',
      royaltyType: 'Dry Bulk'
    };
    
    console.log('Input:', test1);
    
    // Find datum
    const datum1 = labourDatumMaster.find(row => 
      row.LINE_NO === test1.labourGangLine && row['100_tons_Mobile_Crane'] === test1.use100TonCrane
    );
    console.log('Datum Row:', datum1);
    
    // IMPORTANT: Datum_per_Crane is the tons per crane per shift - this is what we use for gang calculation
    const datumValue1 = Number(datum1?.Datum_per_Crane) || 0;
    console.log(`Datum Value: ${datumValue1} tons per crane (from Datum_per_Crane column)`);
    
    const gangs1 = Math.ceil(test1.weight / datumValue1);
    console.log(`Gangs Required: ${test1.weight} / ${datumValue1} = ${gangs1} gangs`);
    
    // Work days (Coal norm ~10000 MT/day)
    const cargoNorm1 = 10000;
    const workDays1 = Math.ceil(test1.weight / cargoNorm1);
    console.log(`Work Days: ${test1.weight} / ${cargoNorm1} = ${workDays1} days`);
    
    // Manning
    const manning1 = getManningForLine(test1.labourGangLine);
    console.log('Manning OnBoard:', manning1?.onBoardRow);
    
    // Composite rates for one gang
    const categories = ['Tindal', 'Winch_driver', 'Signal_Man', 'Mazdoor', 'Maistry', 'Tally_clerk'];
    let gangCost1 = 0;
    categories.forEach(cat => {
      const count = Number(manning1?.onBoardRow?.[cat]) || 0;
      if (count === 0) return;
      const rateRow = compositeRateMaster.find(row => 
        row.Lab_Category === cat.replace('_', ' ') && 
        row.Shift === test1.shiftType && 
        row.Type_Cargo === 'ALLOTHCG'
      );
      const rate = Number(rateRow?.Rate) || 0;
      gangCost1 += count * rate;
      console.log(`  ${cat}: ${count} × ₹${rate} = ₹${count * rate}`);
    });
    console.log(`Gang Cost (1 gang): ₹${gangCost1}`);
    console.log(`Total Composite: ₹${gangCost1} × ${gangs1} = ₹${gangCost1 * gangs1}`);
    
    // Royalties
    const royalty1 = royaltyMaster.find(row => row.RltyCargo_Type === test1.royaltyType);
    console.log('Royalty Row:', royalty1);
    const stevRate1 = Number(royalty1?.Stevedoring_Royalty) || 0;
    const shoreRate1 = Number(royalty1?.ShoreHanding_Royalty) || 0;
    console.log(`Stevedoring Royalty: ${test1.weight} × ₹${stevRate1} = ₹${test1.weight * stevRate1}`);
    console.log(`Shore Handling Royalty: ${test1.weight} × ₹${shoreRate1} = ₹${test1.weight * shoreRate1}`);
    
    const subtotal1 = (gangCost1 * gangs1) + (test1.weight * stevRate1) + (test1.weight * shoreRate1);
    const taxes1 = subtotal1 * 0.18;
    const total1 = subtotal1 + taxes1;
    console.log(`Subtotal: ₹${subtotal1}`);
    console.log(`Taxes (18%): ₹${taxes1}`);
    console.log(`TOTAL: ₹${total1}`);
    
    // Test Case 2: Container - Standard, With 100T Crane, Line 8(1)
    console.log('%c\nTest Case 2: Container (20ft Laden)', 'color: green; font-weight: bold');
    const test2 = {
      cargo: 'Container',
      category: 'CONTAINER',
      weight: 100, // 100 TEU
      vesselTonnage: 8000,
      use100TonCrane: 'Y',
      labourGangLine: '8(1)',
      shiftType: 'Full',
      royaltyType: 'Container -Laden'
    };
    
    console.log('Input:', test2);
    
    const datum2 = labourDatumMaster.find(row => 
      row.LINE_NO === test2.labourGangLine && row['100_tons_Mobile_Crane'] === test2.use100TonCrane
    );
    console.log('Datum Row:', datum2);
    
    const datumValue2 = Number(datum2?.Datum_per_Crane) || 0;
    console.log(`Datum Value: ${datumValue2} tons per crane (from Datum_per_Crane column)`);
    
    const gangs2 = Math.ceil(test2.weight / datumValue2);
    console.log(`Gangs Required: ${test2.weight} / ${datumValue2} = ${gangs2} gangs`);
    
    const cargoNorm2 = 240; // container norm
    const workDays2 = Math.ceil(test2.weight / cargoNorm2);
    console.log(`Work Days: ${test2.weight} / ${cargoNorm2} = ${workDays2} days`);
    
    const manning2 = getManningForLine(test2.labourGangLine);
    console.log('Manning OnBoard:', manning2?.onBoardRow);
    
    let gangCost2 = 0;
    categories.forEach(cat => {
      const count = Number(manning2?.onBoardRow?.[cat]) || 0;
      if (count === 0) return;
      const rateRow = compositeRateMaster.find(row => 
        row.Lab_Category === cat.replace('_', ' ') && 
        row.Shift === test2.shiftType && 
        row.Type_Cargo === 'ALLOTHCG'
      );
      const rate = Number(rateRow?.Rate) || 0;
      gangCost2 += count * rate;
      console.log(`  ${cat}: ${count} × ₹${rate} = ₹${count * rate}`);
    });
    console.log(`Gang Cost (1 gang): ₹${gangCost2}`);
    console.log(`Total Composite: ₹${gangCost2} × ${gangs2} = ₹${gangCost2 * gangs2}`);
    
    const royalty2 = royaltyMaster.find(row => row.RltyCargo_Type === test2.royaltyType);
    console.log('Royalty Row:', royalty2);
    const stevRate2 = Number(royalty2?.Stevedoring_Royalty) || 0;
    const shoreRate2 = Number(royalty2?.ShoreHanding_Royalty) || 0;
    console.log(`Stevedoring Royalty: ${test2.weight} × ₹${stevRate2} = ₹${test2.weight * stevRate2}`);
    console.log(`Shore Handling Royalty: ${test2.weight} × ₹${shoreRate2} = ₹${test2.weight * shoreRate2}`);
    
    const subtotal2 = (gangCost2 * gangs2) + (test2.weight * stevRate2) + (test2.weight * shoreRate2);
    const taxes2 = subtotal2 * 0.18;
    const total2 = subtotal2 + taxes2;
    console.log(`Subtotal: ₹${subtotal2}`);
    console.log(`Taxes (18%): ₹${taxes2}`);
    console.log(`TOTAL: ₹${total2}`);
    
    // Test Case 3: Bagged Cargo (Sugar) - 50kg bags, No Crane, Line 2B1
    console.log('%c\nTest Case 3: Sugar in Bags (AGPSUBGS)', 'color: green; font-weight: bold');
    const test3 = {
      cargo: 'Sugar',
      category: 'BREAK BULK',
      weight: 5000,
      vesselTonnage: 3000,
      use100TonCrane: 'N',
      labourGangLine: '2B1',
      shiftType: 'Half',
      royaltyType: 'Break Bulk except Automobiles'
    };
    
    console.log('Input:', test3);
    
    const datum3 = labourDatumMaster.find(row => 
      row.LINE_NO === test3.labourGangLine && row['100_tons_Mobile_Crane'] === test3.use100TonCrane
    );
    console.log('Datum Row:', datum3);
    
    const datumValue3 = Number(datum3?.Datum_per_Crane) || 0;
    console.log(`Datum Value: ${datumValue3} tons per crane (from Datum_per_Crane column)`);
    
    const gangs3 = Math.ceil(test3.weight / datumValue3);
    console.log(`Gangs Required: ${test3.weight} / ${datumValue3} = ${gangs3} gangs`);
    
    const cargoNorm3 = 1200;
    const workDays3 = Math.ceil(test3.weight / cargoNorm3);
    console.log(`Work Days: ${test3.weight} / ${cargoNorm3} = ${workDays3} days`);
    
    const manning3 = getManningForLine(test3.labourGangLine);
    console.log('Manning OnBoard:', manning3?.onBoardRow);
    
    let gangCost3 = 0;
    categories.forEach(cat => {
      const count = Number(manning3?.onBoardRow?.[cat]) || 0;
      if (count === 0) return;
      const rateRow = compositeRateMaster.find(row => 
        row.Lab_Category === cat.replace('_', ' ') && 
        row.Shift === test3.shiftType && 
        row.Type_Cargo === 'AGPSUBGS' // Sugar uses special rate
      );
      const rate = Number(rateRow?.Rate) || 0;
      gangCost3 += count * rate;
      console.log(`  ${cat}: ${count} × ₹${rate} = ₹${count * rate}`);
    });
    console.log(`Gang Cost (1 gang): ₹${gangCost3}`);
    console.log(`Total Composite: ₹${gangCost3} × ${gangs3} = ₹${gangCost3 * gangs3}`);
    
    const royalty3 = royaltyMaster.find(row => row.RltyCargo_Type === test3.royaltyType);
    console.log('Royalty Row:', royalty3);
    const stevRate3 = Number(royalty3?.Stevedoring_Royalty) || 0;
    const shoreRate3 = Number(royalty3?.ShoreHanding_Royalty) || 0;
    console.log(`Stevedoring Royalty: ${test3.weight} × ₹${stevRate3} = ₹${test3.weight * stevRate3}`);
    console.log(`Shore Handling Royalty: ${test3.weight} × ₹${shoreRate3} = ₹${test3.weight * shoreRate3}`);
    
    const subtotal3 = (gangCost3 * gangs3) + (test3.weight * stevRate3) + (test3.weight * shoreRate3);
    const taxes3 = subtotal3 * 0.18;
    const total3 = subtotal3 + taxes3;
    console.log(`Subtotal: ₹${subtotal3}`);
    console.log(`Taxes (18%): ₹${taxes3}`);
    console.log(`TOTAL: ₹${total3}`);
    
    console.log('%c\n=== DEBUG COMPLETE ===', 'color: blue; font-weight: bold; font-size: 16px');
    console.log('%cTo test: Open browser console and run: debugStevedore()', 'color: orange; font-style: italic');
    
    return {
      test1: { gangs: gangs1, workDays: workDays1, composite: gangCost1 * gangs1, total: total1 },
      test2: { gangs: gangs2, workDays: workDays2, composite: gangCost2 * gangs2, total: total2 },
      test3: { gangs: gangs3, workDays: workDays3, composite: gangCost3 * gangs3, total: total3 }
    };
  };

  // Event listeners
  if (calculateLogisticsBtn) {
    calculateLogisticsBtn.addEventListener('click', () => {
      const result = calculateLogistics();
      if (!result) return;

      const resultsContainer = document.getElementById('resultsContainer');
      if (resultsContainer) resultsContainer.hidden = false;

      workDaysEl.textContent = `${result.workDays} days`;
      gangsRequiredEl.textContent = `${result.gangsRequired} Gangs`;
      datumValueEl.textContent = `${result.datumValue} tons`;

      logisticsPanel.classList.remove('hidden');
      costPanel.classList.add('hidden');
    });
  }

  if (calculateCostBtn) {
    calculateCostBtn.addEventListener('click', () => {
      const result = calculateCosts();
      if (!result) return;

      const resultsContainer = document.getElementById('resultsContainer');
      if (resultsContainer) resultsContainer.hidden = false;

      totalCostValue.textContent = formatINR(result.total);
      compositeVal.textContent = formatINR(result.composite);
      royaltyStevedoringVal.textContent = formatINR(result.royaltyStevedoring);
      royaltyShoreVal.textContent = formatINR(result.royaltyShore);
      subtotalVal.textContent = formatINR(result.subtotal);
      taxesVal.textContent = formatINR(result.taxes);

      renderChart(result.composite, result.royaltyStevedoring, result.royaltyShore, result.taxes);

      costPanel.classList.remove('hidden');
      logisticsPanel.classList.add('hidden');
    });
  }

  // Clear button handler
  const clearBtn = document.getElementById('clearBtn');
  if(clearBtn){
    clearBtn.addEventListener('click', ()=>{
      // Reset all form fields
      document.querySelectorAll('input[type="number"]').forEach(input => {
        if(input.id === 'weight') input.value = '10000';
        else if(input.id === 'vesselTonnage') input.value = '5000';
        else input.value = '0';
      });
      document.querySelectorAll('select').forEach(select => select.selectedIndex = 0);
      
      // Hide results
      const resultsContainer = document.getElementById('resultsContainer');
      if (resultsContainer) resultsContainer.hidden = true;
      logisticsPanel.classList.add('hidden');
      costPanel.classList.add('hidden');
    });
  }
});

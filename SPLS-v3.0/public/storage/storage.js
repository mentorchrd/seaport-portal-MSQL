import { fetchText, parseCSV, formatINR } from '../utils.js';

// Global state
let stowageFactorData = [];
let immediateCargoRates = [];
let licenseRates = [];
let storageChart = null;

// Initialize the module
async function init() {
    try {
        // Load master data
        await Promise.all([
            loadStowageFactors(),
            loadImmediateCargoRates(),
            loadLicenseRates()
        ]);

        // Populate cargo dropdown with stowage factor data
        populateCargoDropdown();
        populateLeaseTypeDropdown();

        // Set up event listeners
        setupEventListeners();

        console.log('Storage module initialized successfully');
    } catch (error) {
        console.error('Error initializing storage module:', error);
        alert('Failed to initialize storage module. Please check console for details.');
    }
}

// Load stowage factor master data
async function loadStowageFactors() {
    try {
        const csvText = await fetchText('/db/SM_StowageFactor.csv');
        const rows = parseCSV(csvText);
        stowageFactorData = rows; // parseCSV already returns objects
        console.log(`Loaded ${stowageFactorData.length} stowage factor records`);
    } catch (error) {
        console.error('Error loading stowage factors:', error);
        throw error;
    }
}

// Load immediate cargo rates
async function loadImmediateCargoRates() {
    try {
        const csvText = await fetchText('/db/SM_ImmediateCargoFee.csv');
        const rows = parseCSV(csvText);
        immediateCargoRates = rows; // parseCSV already returns objects
        console.log(`Loaded ${immediateCargoRates.length} immediate cargo rate records`);
    } catch (error) {
        console.error('Error loading immediate cargo rates:', error);
        throw error;
    }
}

// Load license/lease rates
async function loadLicenseRates() {
    try {
        const csvText = await fetchText('/db/SM_LicenceFee.csv');
        const rows = parseCSV(csvText);
        licenseRates = rows; // parseCSV already returns objects
        console.log(`Loaded ${licenseRates.length} license rate records`);
    } catch (error) {
        console.error('Error loading license rates:', error);
        throw error;
    }
}

// Populate cargo dropdown
function populateCargoDropdown() {
    const select = document.getElementById('cargoDescription');
    const uniqueCargos = [...new Set(stowageFactorData.map(row => row.Cargo))];

    select.innerHTML = '<option value="">Select Cargo...</option>';
    uniqueCargos.forEach(cargo => {
        const option = document.createElement('option');
        option.value = cargo;
        option.textContent = cargo;
        select.appendChild(option);
    });
}

// Populate lease type dropdown
function populateLeaseTypeDropdown() {
    const select = document.getElementById('leaseType');
    
    select.innerHTML = '<option value="">Select Lease Type...</option>';
    licenseRates.forEach((row, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${row.Description} - ${row.Location}`;
        select.appendChild(option);
    });
}

// Set up event listeners
function setupEventListeners() {
    // Storage type radio buttons
    document.querySelectorAll('input[name="storageType"]').forEach(radio => {
        radio.addEventListener('change', handleStorageTypeChange);
    });

    // Cargo type radio buttons
    document.querySelectorAll('input[name="cargoType"]').forEach(radio => {
        radio.addEventListener('change', handleCargoTypeChange);
    });

    // Cargo description change
    document.getElementById('cargoDescription').addEventListener('change', updateAreaEstimate);

    // Weight change
    document.getElementById('cargoWeight').addEventListener('input', updateAreaEstimate);

    // Container inputs
    ['container20Empty', 'container20Laden', 'container2040Empty', 
     'container2040Laden', 'container40PlusEmpty', 'container40PlusLaden'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateAreaEstimate);
    });

    // Calculate button
    document.getElementById('calculateBtn_cost').addEventListener('click', () => calculateStorage('cost'));
    document.getElementById('calculateBtn_logi').addEventListener('click', () => calculateStorage('logistics'));
    
    // Clear button
    const clearBtn = document.getElementById('clearBtn');
    if(clearBtn){
        clearBtn.addEventListener('click', ()=>{
            // Reset radio buttons to defaults
            document.querySelector('input[name="storageType"][value="immediate"]').checked = true;
            document.querySelector('input[name="cargoType"][value="cargo"]').checked = true;
            
            // Reset all number inputs
            document.querySelectorAll('input[type="number"]').forEach(input => {
                if(input.id === 'cargoWeight') input.value = '0';
                else input.value = '0';
            });
            
            // Reset selects
            document.querySelectorAll('select').forEach(select => select.selectedIndex = 0);
            
            // Hide results
            const resultsContainer = document.getElementById('resultsContainer');
            if(resultsContainer) resultsContainer.hidden = true;
            
            // Trigger storage type change to show/hide appropriate sections
            handleStorageTypeChange({target: {value: 'immediate'}});
            handleCargoTypeChange({target: {value: 'cargo'}});
        });
    }
}

// Handle storage type change
function handleStorageTypeChange(e) {
    const isImmediate = e.target.value === 'immediate';
    
    document.getElementById('durationSection').style.display = isImmediate ? 'block' : 'none';
    document.getElementById('leaseSection').style.display = isImmediate ? 'none' : 'block';
    document.getElementById('areaTypeSection').style.display = isImmediate ? 'block' : 'none';
    document.getElementById('leaseTypeSection').style.display = isImmediate ? 'none' : 'block';
}

// Handle cargo type change
function handleCargoTypeChange(e) {
    const isContainer = e.target.value === 'container';
    
    document.getElementById('cargoInputs').style.display = isContainer ? 'none' : 'block';
    document.getElementById('containerInputs').style.display = isContainer ? 'block' : 'none';

    updateAreaEstimate();
}

// Update area estimate when inputs change
function updateAreaEstimate() {
    const cargoType = document.querySelector('input[name="cargoType"]:checked').value;
    const area = calculateArea(cargoType);
    
    // Update lease area field if visible
    const leaseAreaInput = document.getElementById('leaseArea');
    if (leaseAreaInput) {
        leaseAreaInput.value = area.toFixed(2);
    }
}

// Calculate required storage area
function calculateArea(cargoType) {
    if (cargoType === 'cargo') {
        return calculateCargoArea();
    } else {
        return calculateContainerArea();
    }
}

// Calculate area for cargo
function calculateCargoArea() {
    const cargoDescription = document.getElementById('cargoDescription').value;
    const weight = parseFloat(document.getElementById('cargoWeight').value) || 0;

    if (!cargoDescription || weight === 0) {
        return 0;
    }

    // Find stowage factor for this cargo
    const stowageRow = stowageFactorData.find(row => row.Cargo === cargoDescription);
    if (!stowageRow) {
        console.warn('No stowage factor found for:', cargoDescription);
        return 0;
    }

    const stowageFactor = parseFloat(stowageRow.StowageFactor) || 1;
    const measure = parseFloat(stowageRow.Measure) || 1; // tons per sq.m

    // Area = Weight / Measure (tons per sq.m)
    const area = weight / measure;

    return area;
}

// Calculate area for containers
function calculateContainerArea() {
    const containers = {
        '20Empty': parseInt(document.getElementById('container20Empty').value) || 0,
        '20Laden': parseInt(document.getElementById('container20Laden').value) || 0,
        '2040Empty': parseInt(document.getElementById('container2040Empty').value) || 0,
        '2040Laden': parseInt(document.getElementById('container2040Laden').value) || 0,
        '40PlusEmpty': parseInt(document.getElementById('container40PlusEmpty').value) || 0,
        '40PlusLaden': parseInt(document.getElementById('container40PlusLaden').value) || 0
    };

    // Find container stowage factors
    const container20 = stowageFactorData.find(row => row.Cargo === '20 Feet');
    const container40 = stowageFactorData.find(row => row.Cargo === '40 Feet');
    const container45 = stowageFactorData.find(row => row.Cargo === '45 Feet');

    let totalArea = 0;

    // 20' containers
    if (container20) {
        const area20 = parseFloat(container20.Measure) || 14.8;
        totalArea += (containers['20Empty'] + containers['20Laden']) * area20;
    }

    // 20-40' containers (use 40' measurement)
    if (container40) {
        const area40 = parseFloat(container40.Measure) || 29.7;
        totalArea += (containers['2040Empty'] + containers['2040Laden']) * area40;
    }

    // 40'+ containers (use 45' measurement)
    if (container45) {
        const area45 = parseFloat(container45.Measure) || 33.4;
        totalArea += (containers['40PlusEmpty'] + containers['40PlusLaden']) * area45;
    }

    return totalArea;
}

// Main calculation function
async function calculateStorage(type) {
    try {
        const storageType = document.querySelector('input[name="storageType"]:checked').value;
        const cargoType = document.querySelector('input[name="cargoType"]:checked').value;

        // Calculate area
        const area = calculateArea(cargoType);

        if (area === 0) {
            alert('Please enter cargo/container details');
            return;
        }

        let results;
        if (storageType === 'immediate') {
            results = calculateImmediateStorage(area, cargoType);
        } else {
            results = calculateLeaseStorage(area, cargoType);
        }

        // Add calculation type to results
        results.calculationType = type;

        // Display results
        displayResults(results);

    } catch (error) {
        console.error('Error calculating storage:', error);
        alert('Error calculating storage. Please check console for details.');
    }
}

// Calculate immediate cargo storage
function calculateImmediateStorage(area, cargoType) {
    const days = parseInt(document.getElementById('storageDays').value) || 0;
    const areaType = document.getElementById('storageAreaType').value;

    // Get cargo description for stowage factor info
    let cargoDescription = '';
    let stowageRow = null;

    if (cargoType === 'cargo') {
        cargoDescription = document.getElementById('cargoDescription').value;
        stowageRow = stowageFactorData.find(row => row.Cargo === cargoDescription);
    }

    // Find applicable rate based on S_Type and day range
    const rateRow = immediateCargoRates.find(row => {
        const sType = row.S_Type;
        const startDay = parseInt(row.Start_Date) || 0;
        const endDay = parseInt(row.End_Date) || 999;
        
        return sType === areaType && days >= startDay && days <= endDay;
    });

    if (!rateRow) {
        throw new Error('No rate found for selected area type and duration');
    }

    const rateFor15Days = parseFloat(rateRow.Rate_for_15_days) || 0;
    const rateArea = parseFloat(rateRow.Area) || 10;

    // Calculate number of 15-day periods
    const periods = Math.ceil(days / 15);
    
    // Calculate cost: (area / rate_area) * rate * periods
    const cost = (area / rateArea) * rateFor15Days * periods;

    return {
        type: 'immediate',
        area: area,
        areaType: areaType,
        days: days,
        periods: periods,
        rate: rateFor15Days,
        rateArea: rateArea,
        totalCost: cost,
        stowageFactor: stowageRow ? parseFloat(stowageRow.StowageFactor) : null,
        density: stowageRow ? parseFloat(stowageRow.Density) : null,
        cargoDescription: cargoDescription
    };
}

// Calculate lease storage
function calculateLeaseStorage(area, cargoType) {
    const months = parseInt(document.getElementById('leaseMonths').value) || 1;
    const leaseTypeIndex = document.getElementById('leaseType').value;

    if (!leaseTypeIndex) {
        throw new Error('Please select a lease type');
    }

    const leaseRow = licenseRates[leaseTypeIndex];
    const description = leaseRow.Description;
    const location = leaseRow.Location;
    const ratePerMonth = parseFloat(leaseRow.Rate_per_month) || 0;
    const leaseArea = parseFloat(leaseRow.Area) || 1;
    const uom = leaseRow.S_UoM;

    // Calculate cost based on UOM
    let cost;
    if (uom === 'per sq. m.' || uom === 'square meter') {
        cost = area * ratePerMonth * months;
    } else if (uom === 'per rm') {
        // For track length, use area directly
        cost = area * ratePerMonth * months;
    } else {
        // For other UOMs, calculate based on lease area
        cost = (area / leaseArea) * ratePerMonth * months;
    }

    return {
        type: 'lease',
        area: area,
        description: description,
        location: location,
        months: months,
        rate: ratePerMonth,
        uom: uom,
        totalCost: cost
    };
}

// Display results
function displayResults(results) {
    const resultsSection = document.getElementById('results');
    const resultsContainer = document.getElementById('resultsContainer');   
    const logisticsCard = document.getElementById('logisticsResults');
    const costCard = document.getElementById('costResults');
    
    resultsSection.style.display = 'block';
    resultsContainer.hidden = false;

    // Show/hide sections based on calculation type
    if (results.calculationType === 'logistics') {
        logisticsCard.style.display = 'block';
        costCard.style.display = 'none';
    } else if (results.calculationType === 'cost') {
        logisticsCard.style.display = 'none';
        costCard.style.display = 'block';
    } else {
        // Show both if type not specified (for backward compatibility)
        logisticsCard.style.display = 'block';
        costCard.style.display = 'block';
    }

    // Logistics results
    document.getElementById('requiredArea').textContent = `${results.area.toFixed(2)} sq.m`;
    
    if (results.type === 'immediate') {
        document.getElementById('suggestedStorage').textContent = results.areaType;
        document.getElementById('stowageFactor').textContent = results.stowageFactor ? 
            `${results.stowageFactor} m³/ton` : 'N/A';
        document.getElementById('density').textContent = results.density ? 
            `${results.density} ton/m³` : 'N/A';
        
        // Cost results
        document.getElementById('storageCharges').textContent = formatINR(results.totalCost);
        document.getElementById('storageDuration').textContent = `${results.days} days (${results.periods} periods)`;
        document.getElementById('rateApplied').textContent = `${formatINR(results.rate)} per ${results.rateArea} sq.m for 15 days`;
    } else {
        document.getElementById('suggestedStorage').textContent = `${results.description} (${results.location})`;
        document.getElementById('stowageFactor').textContent = 'N/A';
        document.getElementById('density').textContent = 'N/A';
        
        // Cost results
        document.getElementById('storageCharges').textContent = formatINR(results.totalCost);
        document.getElementById('storageDuration').textContent = `${results.months} months`;
        document.getElementById('rateApplied').textContent = `${formatINR(results.rate)} ${results.uom}`;
    }

    document.getElementById('totalCost').textContent = formatINR(results.totalCost);

    // Update chart
    updateChart(results);

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// Update chart
function updateChart(results) {
    const ctx = document.getElementById('storageChart').getContext('2d');

    // Destroy existing chart
    if (storageChart) {
        storageChart.destroy();
    }

    if (results.type === 'immediate') {
        // Show cost breakdown by period
        const periods = results.periods;
        const labels = [];
        const data = [];
        const costPerPeriod = results.totalCost / periods;

        for (let i = 1; i <= periods; i++) {
            labels.push(`Period ${i}`);
            data.push(costPerPeriod);
        }

        storageChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Cost per 15-day Period (₹)',
                    data: data,
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₹' + value.toLocaleString('en-IN');
                            }
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Storage Cost Breakdown by Period'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return 'Cost: ₹' + context.parsed.y.toLocaleString('en-IN');
                            }
                        }
                    }
                }
            }
        });
    } else {
        // Show monthly cost breakdown
        const months = results.months;
        const labels = [];
        const data = [];
        const costPerMonth = results.totalCost / months;

        for (let i = 1; i <= Math.min(months, 12); i++) {
            labels.push(`Month ${i}`);
            data.push(costPerMonth);
        }

        storageChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Monthly Lease Cost (₹)',
                    data: data,
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 2,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₹' + value.toLocaleString('en-IN');
                            }
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Monthly Lease Cost'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return 'Cost: ₹' + context.parsed.y.toLocaleString('en-IN');
                            }
                        }
                    }
                }
            }
        });
    }
}

// Debug function for testing
window.debugStorage = function() {
    console.log('=== Storage Module Debug ===');
    
    // Test 1: Coal storage for 45 days
    console.log('\n--- Test 1: Coal Storage (10,000 tons, 45 days, Open Unpaved) ---');
    document.querySelector('input[name="storageType"][value="immediate"]').checked = true;
    document.querySelector('input[name="cargoType"][value="cargo"]').checked = true;
    document.getElementById('cargoDescription').value = 'Coal';
    document.getElementById('cargoWeight').value = '10000';
    document.getElementById('storageDays').value = '45';
    document.getElementById('storageAreaType').value = 'Open Space Unpaved';
    handleStorageTypeChange({ target: { value: 'immediate' }});
    handleCargoTypeChange({ target: { value: 'cargo' }});
    
    const coalArea = calculateCargoArea();
    console.log('Coal area required:', coalArea.toFixed(2), 'sq.m');
    const coalResults = calculateImmediateStorage(coalArea, 'cargo');
    console.log('Coal storage cost:', formatINR(coalResults.totalCost));
    console.log('Periods:', coalResults.periods);
    
    // Test 2: Container storage (20 x 40' containers, 60 days, Paved)
    console.log('\n--- Test 2: Container Storage (20x 40\' containers, 60 days, Paved) ---');
    document.querySelector('input[name="cargoType"][value="container"]').checked = true;
    document.getElementById('container40PlusLaden').value = '20';
    document.getElementById('storageDays').value = '60';
    document.getElementById('storageAreaType').value = 'Open Space Paved';
    handleCargoTypeChange({ target: { value: 'container' }});
    
    const containerArea = calculateContainerArea();
    console.log('Container area required:', containerArea.toFixed(2), 'sq.m');
    const containerResults = calculateImmediateStorage(containerArea, 'container');
    console.log('Container storage cost:', formatINR(containerResults.totalCost));
    console.log('Periods:', containerResults.periods);
    
    // Test 3: Lease calculation (1000 sq.m covered space, 12 months)
    console.log('\n--- Test 3: Covered Space Lease (1000 sq.m, 12 months) ---');
    document.querySelector('input[name="storageType"][value="lease"]').checked = true;
    document.getElementById('leaseMonths').value = '12';
    handleStorageTypeChange({ target: { value: 'lease' }});
    
    // Find covered cargo storage inside port
    const coveredIndex = licenseRates.findIndex(row => 
        row.Description.includes('Covered') && row.Location === 'Inside Port'
    );
    document.getElementById('leaseType').value = coveredIndex;
    
    const leaseResults = calculateLeaseStorage(1000, 'cargo');
    console.log('Lease cost for 1000 sq.m:', formatINR(leaseResults.totalCost));
    console.log('Monthly rate:', formatINR(leaseResults.rate));
    
    console.log('\n=== Debug Complete ===');
};

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

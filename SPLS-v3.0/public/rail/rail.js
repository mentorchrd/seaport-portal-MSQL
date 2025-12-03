import { fetchText, parseCSV, formatINR } from '../utils.js';

// Global state
let wagonMasterData = [];
let sidingMasterData = [];
let haulageData = [];
let terminalHandlingData = [];
let demurrageData = [];
let railwayChart = null;

// Initialize the module
async function init() {
    try {
        // Load master data
        await Promise.all([
            loadWagonMaster(),
            loadSidingMaster(),
            loadHaulageRates(),
            loadTerminalHandling(),
            loadDemurrageRates()
        ]);

        // Populate wagon types dropdown
        populateWagonTypes();

        // Set up event listeners
        setupEventListeners();

        console.log('Railway module initialized successfully');
    } catch (error) {
        console.error('Error initializing railway module:', error);
        alert('Failed to initialize railway module. Please check console for details.');
    }
}

// Load wagon master data
async function loadWagonMaster() {
    try {
        const csvText = await fetchText('/db/RM_WagonMaster.csv');
        const rows = parseCSV(csvText);
        wagonMasterData = rows;
        console.log(`Loaded ${wagonMasterData.length} wagon master records`);
    } catch (error) {
        console.error('Error loading wagon master:', error);
        throw error;
    }
}

// Load railway siding master data
async function loadSidingMaster() {
    try {
        const csvText = await fetchText('/db/RM_RailwaySidingMaster.csv');
        const rows = parseCSV(csvText);
        sidingMasterData = rows;
        console.log(`Loaded ${sidingMasterData.length} siding master records`);
    } catch (error) {
        console.error('Error loading siding master:', error);
        throw error;
    }
}

// Load haulage rates
async function loadHaulageRates() {
    try {
        const csvText = await fetchText('/db/RM_Haulage.csv');
        const rows = parseCSV(csvText);
        haulageData = rows;
        console.log(`Loaded ${haulageData.length} haulage rate records`);
    } catch (error) {
        console.error('Error loading haulage rates:', error);
        throw error;
    }
}

// Load terminal handling rates
async function loadTerminalHandling() {
    try {
        const csvText = await fetchText('/db/RM_TerminalHandling.csv');
        const rows = parseCSV(csvText);
        terminalHandlingData = rows;
        console.log(`Loaded ${terminalHandlingData.length} terminal handling records`);
    } catch (error) {
        console.error('Error loading terminal handling:', error);
        throw error;
    }
}

// Load demurrage rates
async function loadDemurrageRates() {
    try {
        const csvText = await fetchText('/db/RM_Demurrage.csv');
        const rows = parseCSV(csvText);
        demurrageData = rows;
        console.log(`Loaded ${demurrageData.length} demurrage rate records`);
    } catch (error) {
        console.error('Error loading demurrage rates:', error);
        throw error;
    }
}

// Populate wagon types dropdown
function populateWagonTypes() {
    const select = document.getElementById('wagonType');
    const uniqueWagons = [...new Set(wagonMasterData.map(row => row.wagon_type))];

    select.innerHTML = '<option value="">Select Wagon Type...</option>';
    uniqueWagons.forEach(wagon => {
        const option = document.createElement('option');
        option.value = wagon;
        option.textContent = wagon;
        select.appendChild(option);
    });
}

// Set up event listeners
function setupEventListeners() {
    // Cargo type change
    document.getElementById('cargoType').addEventListener('change', handleCargoTypeChange);

    // Calculate buttons
    document.getElementById('calculateBtn_logi').addEventListener('click', () => calculateRailway('logistics'));
    document.getElementById('calculateBtn_cost').addEventListener('click', () => calculateRailway('cost'));
    
    // Clear button
    const clearBtn = document.getElementById('clearBtn');
    if(clearBtn){
        clearBtn.addEventListener('click', ()=>{
            // Reset all inputs
            document.getElementById('cargoType').selectedIndex = 0;
            document.getElementById('wagonType').selectedIndex = 0;
            document.getElementById('numWagons').value = '40';
            document.getElementById('container20ft').value = '0';
            document.getElementById('container40ft').value = '0';
            document.getElementById('container40ftPlus').value = '0';
            document.getElementById('cargoWeight').value = '2000';
            document.getElementById('operationHours').value = '10';
            
            // Hide results
            const resultsContainer = document.getElementById('resultsContainer');
            if(resultsContainer) resultsContainer.hidden = true;
            
            // Reset cargo type display
            handleCargoTypeChange({target: {value: ''}});
        });
    }
}

// Handle cargo type change
function handleCargoTypeChange(e) {
    const isContainer = e.target.value === 'Container';
    
    document.getElementById('containerSection').style.display = isContainer ? 'block' : 'none';
    document.getElementById('cargoWeightSection').style.display = isContainer ? 'none' : 'block';
}

// Main calculation function
async function calculateRailway(type) {
    try {
        const cargoType = document.getElementById('cargoType').value;
        const wagonType = document.getElementById('wagonType').value;
        const numWagons = parseInt(document.getElementById('numWagons').value) || 0;
        const operationHours = parseFloat(document.getElementById('operationHours').value) || 0;

        if (!cargoType || !wagonType || numWagons === 0) {
            alert('Please fill in all required fields');
            return;
        }

        // Get wagon details
        const wagonData = wagonMasterData.find(row => row.wagon_type === wagonType);
        if (!wagonData) {
            alert('Wagon type not found in master data');
            return;
        }

        // Calculate logistics
        const logisticsResults = calculateLogistics(wagonData, numWagons, cargoType);

        // Calculate costs
        const costResults = calculateCosts(wagonData, numWagons, cargoType, operationHours);

        // Combine results
        const results = {
            ...logisticsResults,
            ...costResults,
            calculationType: type
        };

        // Display results
        displayResults(results);

    } catch (error) {
        console.error('Error calculating railway:', error);
        alert('Error calculating railway. Please check console for details.');
    }
}

// Calculate logistics
function calculateLogistics(wagonData, numWagons, cargoType) {
    const rakeSize = parseInt(wagonData.Rake_Size) || 0;
    const wagonGroup = wagonData.Wagon_Group;

    // Determine if full or partial loading
    let loadingType;
    let suitableSiding = null;

    if (numWagons >= rakeSize) {
        // Full rake loading
        loadingType = 'Full Rake';
        // Find siding with full capacity for this wagon type
        suitableSiding = sidingMasterData.find(row => 
            row['BOX TYPE'] === wagonData.wagon_type && row.YardCapType === 'Full'
        );
    } else {
        // Partial loading
        loadingType = 'Partial Rake';
        // Find siding with partial capacity
        suitableSiding = sidingMasterData.find(row => 
            row['BOX TYPE'] === wagonData.wagon_type && row.YardCapType === 'Partial'
        );
    }

    // If no exact match, find any compatible siding
    if (!suitableSiding) {
        suitableSiding = sidingMasterData.find(row => row['BOX TYPE'] === wagonData.wagon_type);
    }

    // Fallback to first available siding
    if (!suitableSiding && sidingMasterData.length > 0) {
        suitableSiding = sidingMasterData[0];
    }

    return {
        railwaySiding: suitableSiding ? suitableSiding.Lines : 'N/A',
        railwayYard: suitableSiding ? suitableSiding.RailwayYard : 'N/A',
        sidingType: suitableSiding ? suitableSiding.LineType : 'N/A',
        holdingCapacity: suitableSiding ? suitableSiding['Holding Capacity'] : 'N/A',
        loadingType: loadingType,
        rakeSize: rakeSize,
        wagonGroup: wagonGroup
    };
}

// Calculate costs
function calculateCosts(wagonData, numWagons, cargoType, operationHours) {
    const isContainer = cargoType === 'Container';
    let category;

    // Determine category for haulage
    if (isContainer) {
        const container20 = parseInt(document.getElementById('container20ft').value) || 0;
        const container40 = parseInt(document.getElementById('container40ft').value) || 0;
        const container40Plus = parseInt(document.getElementById('container40ftPlus').value) || 0;

        // Calculate haulage for containers
        const haulage20 = container20 * getHaulageRate('20ft_Container', 'Loaded Wagon');
        const haulage40 = container40 * getHaulageRate('40ft_Container', 'Loaded Wagon');
        const haulage40Plus = container40Plus * getHaulageRate('Above 40ft_Container', 'Loaded Wagon');

        const totalHaulage = haulage20 + haulage40 + haulage40Plus;

        // Terminal handling for containers
        const thcRate = getTerminalHandlingRate('containerised');
        const cargoWeight = parseFloat(document.getElementById('cargoWeight').value) || 0;
        const terminalCharges = cargoWeight * thcRate;

        // Demurrage calculation
        const freeHours = parseFloat(wagonData.Free_Hours) || 8;
        const demurrageCharges = calculateDemurrage(operationHours, freeHours, numWagons);

        return {
            haulageCharges: totalHaulage,
            terminalCharges: terminalCharges,
            demurrageCharges: demurrageCharges.totalCharge,
            freeHours: freeHours,
            chargeableHours: demurrageCharges.chargeableHours,
            demurrageRate: demurrageCharges.rate,
            totalCost: totalHaulage + terminalCharges + demurrageCharges.totalCharge
        };
    } else {
        // Non-containerized cargo
        const cargoWeight = parseFloat(document.getElementById('cargoWeight').value) || 0;

        // Haulage: wagons x rate (assuming loaded wagon)
        const haulageRate = getHaulageRate('non_Container', 'Loaded Wagon');
        const haulageCharges = cargoWeight * haulageRate;

        // Terminal handling
        const thcRate = getTerminalHandlingRate('non_containerised');
        const terminalCharges = cargoWeight * thcRate;

        // Demurrage calculation
        const freeHours = parseFloat(wagonData.Free_Hours) || 8;
        const demurrageCharges = calculateDemurrage(operationHours, freeHours, numWagons);

        return {
            haulageCharges: haulageCharges,
            terminalCharges: terminalCharges,
            demurrageCharges: demurrageCharges.totalCharge,
            freeHours: freeHours,
            chargeableHours: demurrageCharges.chargeableHours,
            demurrageRate: demurrageCharges.rate,
            totalCost: haulageCharges + terminalCharges + demurrageCharges.totalCharge
        };
    }
}

// Get haulage rate
function getHaulageRate(category, description) {
    const rateRow = haulageData.find(row => 
        row.category === category && row.Haulage_description === description
    );
    return rateRow ? parseFloat(rateRow.H_Rate) : 0;
}

// Get terminal handling rate
function getTerminalHandlingRate(cargoType) {
    const thcRow = terminalHandlingData.find(row => row.cargo_type === cargoType);
    return thcRow ? parseFloat(thcRow.THC_rate) : 0;
}

// Calculate demurrage
function calculateDemurrage(totalHours, freeHours, numWagons) {
    if (totalHours <= freeHours) {
        return {
            totalCharge: 0,
            chargeableHours: 0,
            rate: 0
        };
    }

    const chargeableHours = totalHours - freeHours;

    // Find applicable demurrage rate based on chargeable hours
    const demRow = demurrageData.find(row => {
        const start = parseFloat(row.Time_start_HRS) || 0;
        const end = parseFloat(row.Time_end_HRS) || 999;
        return chargeableHours >= start && chargeableHours <= end;
    });

    const rate = demRow ? parseFloat(demRow.Dem_Rate) : 0;
    const totalCharge = rate * numWagons;

    return {
        totalCharge: totalCharge,
        chargeableHours: chargeableHours,
        rate: rate
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
        logisticsCard.style.display = 'block';
        costCard.style.display = 'block';
    }

    // Logistics results
    if (results.railwaySiding) {
        document.getElementById('railwaySiding').textContent = results.railwaySiding;
        document.getElementById('sidingType').textContent = results.sidingType;
        document.getElementById('holdingCapacity').textContent = `${results.holdingCapacity} wagons`;
        document.getElementById('loadingType').textContent = results.loadingType;
        document.getElementById('rakeSize').textContent = `${results.rakeSize} wagons`;
    }

    // Cost results
    if (results.haulageCharges !== undefined) {
        document.getElementById('haulageCharges').textContent = formatINR(results.haulageCharges);
        document.getElementById('terminalCharges').textContent = formatINR(results.terminalCharges);
        document.getElementById('demurrageCharges').textContent = formatINR(results.demurrageCharges);
        document.getElementById('freeHours').textContent = `${results.freeHours} hours`;
        document.getElementById('chargeableHours').textContent = `${results.chargeableHours.toFixed(1)} hours`;
        document.getElementById('totalCost').textContent = formatINR(results.totalCost);
    }

    // Update chart
    updateChart(results);

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// Update chart
function updateChart(results) {
    const ctx = document.getElementById('railwayChart').getContext('2d');

    // Destroy existing chart
    if (railwayChart) {
        railwayChart.destroy();
    }

    if (results.calculationType === 'cost' && results.haulageCharges !== undefined) {
        // Show cost breakdown
        railwayChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Haulage Charges', 'Terminal Handling', 'Demurrage'],
                datasets: [{
                    data: [
                        results.haulageCharges,
                        results.terminalCharges,
                        results.demurrageCharges
                    ],
                    backgroundColor: [
                        'rgba(54, 162, 235, 0.8)',
                        'rgba(75, 192, 192, 0.8)',
                        'rgba(255, 99, 132, 0.8)'
                    ],
                    borderColor: [
                        'rgba(54, 162, 235, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(255, 99, 132, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Railway Cost Breakdown'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ₹${value.toLocaleString('en-IN')} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    } else {
        // Show logistics bar chart
        railwayChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Rake Size', 'Holding Capacity', 'Wagons Requested'],
                datasets: [{
                    label: 'Number of Wagons',
                    data: [
                        results.rakeSize || 0,
                        parseInt(results.holdingCapacity) || 0,
                        parseInt(document.getElementById('numWagons').value) || 0
                    ],
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
                            stepSize: 10
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Railway Logistics Comparison'
                    }
                }
            }
        });
    }
}

// Debug function for testing
window.debugRailway = function() {
    console.log('=== Railway Module Debug ===');
    
    // Test 1: Dry Bulk with BOXN wagons
    console.log('\n--- Test 1: Dry Bulk (40 BOXN wagons, 2000 tons, 10 hours) ---');
    document.getElementById('cargoType').value = 'Dry Bulk';
    document.getElementById('wagonType').value = 'BOXN';
    document.getElementById('numWagons').value = '40';
    document.getElementById('cargoWeight').value = '2000';
    document.getElementById('operationHours').value = '10';
    handleCargoTypeChange({ target: { value: 'Dry Bulk' }});
    
    calculateRailway('cost').then(() => {
        console.log('Dry bulk calculation completed');
    });
    
    // Test 2: Container cargo
    console.log('\n--- Test 2: Container (20x 40ft containers, 12 hours) ---');
    setTimeout(() => {
        document.getElementById('cargoType').value = 'Container';
        document.getElementById('wagonType').value = 'BLC';
        document.getElementById('numWagons').value = '20';
        document.getElementById('container40ft').value = '20';
        document.getElementById('operationHours').value = '12';
        handleCargoTypeChange({ target: { value: 'Container' }});
        
        calculateRailway('cost').then(() => {
            console.log('Container calculation completed');
        });
    }, 2000);
    
    console.log('\n=== Debug Complete ===');
};

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

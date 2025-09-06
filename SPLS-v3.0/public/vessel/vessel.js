document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('vesselForm');
  const rightPanel = document.getElementById('rightPanel');
  const costBtns = document.getElementById('costBtns');
  const cargoSelect = document.getElementById('cargoSelect');

  // Populate cargo options from cargo_master.csv (static list for now)
  const cargoNames = [
    "Ammonium Sulphate",
    "Muriate of Potash",
    "Rock Phosphate",
    "Sulphur",
    "Urea",
    "Silica Sand",
    "Dolomite",
    "Limestone",
    "Iron Ore Pellet",
    "Gypsum",
    "Food Grains",
    "Shredded Scrap",
    "Heavy Melting Scrap",
    "Food grains (Maize, etc.)",
    "Barytes",
    "Cobble Stones",
    "Mil Scale",
    "Cement Clinkers",
    "Ferro Slag",
    "Steel bar/tubes/ pipes",
    "Steel CR Coil",
    "Steel Plate",
    "Steel Billet",
    "HR Coil",
    "Excavator",
    "Machinery",
    "Windmill",
    "Logs",
    "Steel bar",
    "Steel tubes",
    "Steel pipes",
    "Granite Block",
    "Barytes - J. Bags"
  ];
  cargoNames.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    cargoSelect.appendChild(opt);
  });

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    rightPanel.style.display = 'flex';
    costBtns.style.display = 'flex';
  });

  document.getElementById('backBtn').onclick = function() {
    window.location.href = '../dashboard.html';
  };
});

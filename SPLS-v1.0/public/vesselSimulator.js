document.addEventListener('DOMContentLoaded', function () {
  const vesselTypeSelect = document.getElementById('vesselType');
  const cargoSelect = document.getElementById('cargoSelect');
  const cargoQtyInput = document.getElementById('cargoQty');
  const sabOutput = document.getElementById('sabOutput');

  fetch('/api/vessel-types')
    .then(res => res.json())
    .then(data => {
      data.forEach(vessel => {
        const opt = document.createElement('option');
        opt.value = vessel.id;
        opt.textContent = vessel.name;
        vesselTypeSelect.appendChild(opt);
      });
    });

  vesselTypeSelect.addEventListener('change', () => {
    fetch(`/api/cargos/${vesselTypeSelect.value}`)
      .then(res => res.json())
      .then(data => {
        cargoSelect.innerHTML = '<option value="">-- Select Cargo --</option>';
        data.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = c.name;
          cargoSelect.appendChild(opt);
        });
      });
  });

  async function calculateSAB() {
    const cargoId = cargoSelect.value;
    const quantity = parseFloat(cargoQtyInput.value);
    if (!cargoId || isNaN(quantity)) return;

    const res = await fetch(`/api/cargo-norms/${cargoId}`);
    const data = await res.json();
    if (data.norms > 0) {
      const workingTime = quantity / data.norms;
      const sab = (workingTime + 6).toFixed(2);
      sabOutput.value = sab;
    }
  }

  cargoQtyInput.addEventListener('input', calculateSAB);
  cargoSelect.addEventListener('change', calculateSAB);
});

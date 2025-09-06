// vessel.js - client logic for vessel module
op.value = c.id;
op.textContent = c.name + (c.unit ? ` (${c.unit})` : '');
cargoSelect.appendChild(op);
});
}catch(err){
cargoSelect.innerHTML = '<option value="">(failed to load)</option>';
console.error('Failed to load cargo list', err);
}
}


form.addEventListener('submit', async (e)=>{
e.preventDefault();
const fd = new FormData(form);
const payload = {
vesselName: fd.get('vesselName') || '',
tradeType: fd.get('tradeType'),
gt: Number(fd.get('gt')),
parcelSize: Number(fd.get('parcelSize')),
loa: Number(fd.get('loa')),
beam: Number(fd.get('beam')),
draft: Number(fd.get('draft')),
cargoId: Number(fd.get('cargoId'))
};


// client-side validation
if(!payload.tradeType || !payload.gt || !payload.parcelSize || !payload.loa || !payload.beam || !payload.draft || !payload.cargoId){
alert('Please fill all mandatory fields.');
return;
}


try{
const res = await fetch('/api/vessel/simulate', {
method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
});
const j = await res.json();
if(!j.success){ alert('Simulation failed: ' + (j.message || 'server error')); console.error(j); return; }


const data = j.data || {};
// fill logistics
preferredBerthsEl.innerHTML = '';
(data.preferredBerths || []).forEach(b=>{
const li = document.createElement('li');
li.textContent = b.name + (b.reason ? ` — ${b.reason}` : '');
preferredBerthsEl.appendChild(li);
});
if((data.preferredBerths||[]).length === 0) preferredBerthsEl.innerHTML = '<li>No suitable berths found</li>';
stayHoursEl.textContent = data.sabHours !== undefined ? Number(data.sabHours).toFixed(2) : '-';
logisticsDebug.textContent = JSON.stringify(data.debug || {}, null, 2);


// fill cost
portDuesEl.textContent = data.portDues !== undefined ? Number(data.portDues).toFixed(2) : '-';
pilotageEl.textContent = data.pilotage !== undefined ? Number(data.pilotage).toFixed(2) : '-';
berthHireEl.textContent = data.berthHire !== undefined ? Number(data.berthHire).toFixed(2) : '-';
totalCostEl.textContent = data.totalCost !== undefined ? Number(data.totalCost).toFixed(2) : '-';
costDebug.textContent = JSON.stringify(data.costBreakdown || {}, null, 2);


// show logistics tab by default
showTab('log');


}catch(err){
console.error('Simulation error', err);
alert('Simulation request failed. See console for details.');
}
});


// initialize
loadCargoList();
})();
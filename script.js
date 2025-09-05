// script.js — Customer page logic
// Uses global 'db' and 'auth' created in firebase-config.js

// Helpers
function numberWithCommas(x){return (x||0).toString().replace(/\B(?=(\d{3})+(?!\d))/g,",");}
function escapeHtml(s){return (s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}

const inventoryTableBody = document.querySelector('#inventoryTable tbody');
const partSelect = document.getElementById('partSelect');
const searchInput = document.getElementById('searchInput');

function loadInventory(){
  // Listen to spareParts collection and update UI in real time
  db.collection('spareParts').orderBy('category').onSnapshot(snap=>{
    inventoryTableBody.innerHTML = '';
    partSelect.innerHTML = '<option value="">-- Select part --</option>';
    snap.forEach(doc=>{
      const d = doc.data();
      const id = doc.id;
      const name = d.category === 'Tires' ? (`Tire ${d.size}`) : d.name;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(name)}</td><td>${escapeHtml(d.category || 'General')}</td><td>${numberWithCommas(d.price)}</td><td>${d.stock ?? 0}</td><td></td>`;
      const actionCell = tr.cells[4];
      if ((d.stock ?? 0) > 0){
        const btn = document.createElement('button');
        btn.className = 'btn small';
        btn.textContent = 'Order';
        btn.onclick = () => { partSelect.value = id; window.scrollTo({top: document.body.scrollHeight, behavior:'smooth'}); };
        actionCell.appendChild(btn);
      } else {
        actionCell.textContent = 'Out of stock';
      }
      inventoryTableBody.appendChild(tr);

      // Add dropdown option
      const opt = document.createElement('option');
      opt.value = id;
      opt.text = `${name} — KSh ${numberWithCommas(d.price)}`;
      partSelect.add(opt);
    });
  },err=>{
    console.error('Load inventory error', err);
    alert('Could not load inventory. Check console.');
  });
}

function filterParts(){
  const q = (searchInput.value||'').toLowerCase();
  const rows = inventoryTableBody.querySelectorAll('tr');
  rows.forEach(r=>{
    const name = (r.cells[0].innerText||'').toLowerCase();
    const cat = (r.cells[1].innerText||'').toLowerCase();
    r.style.display = (name.indexOf(q)!==-1 || cat.indexOf(q)!==-1) ? '' : 'none';
  });
}

// Place order — in test mode client updates stock (for production replace with Cloud Function)
async function placeOrder(){
  try{
    const partId = partSelect.value;
    const qty = parseInt(document.getElementById('orderQty').value || '0',10);
    const name = document.getElementById('custName').value.trim();
    const email = document.getElementById('custEmail').value.trim();
    const phone = document.getElementById('custPhone').value.trim();
    if (!partId || !qty || !name || !email || !phone) { alert('Complete all fields'); return; }

    // Read part
    const partRef = db.collection('spareParts').doc(partId);
    const pSnap = await partRef.get();
    if (!pSnap.exists) { alert('Selected item not found'); return; }
    const p = pSnap.data();
    if ((p.stock||0) < qty) { alert('Insufficient stock'); return; }

    const total = (p.price||0) * qty;

    // Create order document
    await db.collection('orders').add({
      name, email, phone,
      partId, quantity: qty,
      status: 'new',
      walkIn: false,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      total
    });

    // Decrement stock (test mode; for production use Cloud Function)
    await partRef.update({ stock: firebase.firestore.FieldValue.increment(-qty) });

    // Generate receipt
    generateReceipt({ name, partName: (p.category==='Tires'?('Tire '+p.size):p.name), quantity:qty, price:p.price, total, timestamp:new Date() });

    alert('Order placed — receipt downloaded (browser).');
    document.getElementById('orderForm').reset();
  }catch(err){
    console.error('Place order error', err);
    alert('Error placing order. See console.');
  }
}

function generateReceipt(o){
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({unit:'pt'});
    doc.setFontSize(18); doc.text('AutoFix Spare Parts — Receipt', 40, 60);
    doc.setFontSize(11);
    doc.text(`Date: ${o.timestamp.toLocaleString()}`, 40, 90);
    doc.text(`Customer: ${o.name}`, 40, 110);
    doc.text(`Item: ${o.partName}`, 40, 130);
    doc.text(`Quantity: ${o.quantity}`, 40, 150);
    doc.text(`Price (each): KSh ${numberWithCommas(o.price)}`, 40, 170);
    doc.setFontSize(13);
    doc.text(`Total: KSh ${numberWithCommas(o.total)}`, 40, 200);
    doc.setFontSize(10);
    doc.text('Thank you for your purchase. AutoFix Spare Parts', 40, 240);
    doc.save(`receipt_${Date.now()}.pdf`);
  } catch(e){ console.error('Receipt error', e); }
}

document.addEventListener('DOMContentLoaded', () => loadInventory());

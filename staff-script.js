// staff-script.js
// Uses global db and auth

function logout(){ auth.signOut().then(()=> window.location='login.html'); }

auth.onAuthStateChanged(user=>{
  if(!user) { window.location = 'login.html'; }
  else { loadPartsForWalkin(); loadOrders(); }
});

function loadPartsForWalkin(){
  const sel = document.getElementById('walkPartSelect');
  db.collection('spareParts').orderBy('category').onSnapshot(snapshot=>{
    sel.innerHTML = '<option value="">-- Select part --</option>';
    snapshot.forEach(doc=>{
      const d = doc.data();
      if ((d.stock||0) > 0){
        const opt = document.createElement('option');
        opt.value = doc.id;
        opt.text = (d.category==='Tires') ? (`Tire ${d.size} — KSh ${d.price} — ${d.stock} in stock`) : (`${d.name} — KSh ${d.price} — ${d.stock} in stock`);
        sel.add(opt);
      }
    });
  });
}

function loadOrders(){
  const tbody = document.querySelector('#ordersTable tbody');
  db.collection('orders').orderBy('timestamp','desc').onSnapshot(snapshot=>{
    tbody.innerHTML = '';
    snapshot.forEach(async doc=>{
      const o = doc.data(); const id = doc.id;
      const tr = document.createElement('tr');
      const partDoc = await db.collection('spareParts').doc(o.partId).get();
      const p = partDoc.exists ? partDoc.data() : {name:'Unknown',category:'General'};
      const itemName = p.category==='Tires' ? `Tire ${p.size}` : p.name;

      tr.innerHTML = `<td>${o.name}</td><td>${itemName}</td><td>${o.quantity}</td><td>${(o.total||0)}</td><td>${o.status||''}</td><td></td>`;
      const actionCell = tr.cells[5];

      if (o.walkIn) {
        actionCell.innerHTML = '<em>Walk-in recorded</em>';
      } else {
        if (o.status === 'new') {
          const btn = document.createElement('button');
          btn.className='btn small'; btn.textContent='Mark Ready';
          btn.onclick = ()=> db.collection('orders').doc(id).update({ status:'ready' });
          actionCell.appendChild(btn);
        } else if (o.status === 'ready') {
          const btn = document.createElement('button');
          btn.className='btn small'; btn.textContent='Complete';
          btn.onclick = ()=> db.collection('orders').doc(id).update({ status:'completed' });
          actionCell.appendChild(btn);
        } else {
          actionCell.textContent = o.status;
        }
      }

      // Receipt button
      const rbtn = document.createElement('button');
      rbtn.className='btn small'; rbtn.style.marginLeft='6px'; rbtn.textContent='Receipt';
      rbtn.onclick = async ()=>{
        const pr = p;
        generateReceipt({
          name: o.name, partName: (pr.category==='Tires'?('Tire '+pr.size):pr.name),
          quantity:o.quantity, price: Math.round((o.total||0)/ (o.quantity||1) ), total:o.total||0,
          timestamp: (o.timestamp && o.timestamp.toDate) ? o.timestamp.toDate() : new Date()
        });
      };
      actionCell.appendChild(rbtn);

      tbody.appendChild(tr);
    });
  });
}

async function logWalkIn(){
  try{
    const name = document.getElementById('walkName').value.trim();
    const email = document.getElementById('walkEmail').value.trim();
    const phone = document.getElementById('walkPhone').value.trim();
    const partId = document.getElementById('walkPartSelect').value;
    const qty = parseInt(document.getElementById('walkQty').value||'0',10);
    if (!name||!phone||!partId||!qty) { alert('Complete fields'); return; }
    const pRef = db.collection('spareParts').doc(partId); const pSnap = await pRef.get();
    if(!pSnap.exists){ alert('Part not found'); return; }
    const p = pSnap.data();
    if ((p.stock||0) < qty) { alert('Insufficient stock'); return; }

    const total = (p.price||0)*qty;
    await db.collection('orders').add({
      name,email,phone,partId,quantity:qty,status:'completed',walkIn:true,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(), total
    });

    // Decrement stock (test mode)
    await pRef.update({ stock: firebase.firestore.FieldValue.increment(-qty) });

    // Generate receipt
    generateReceipt({ name, partName:(p.category==='Tires'?('Tire '+p.size):p.name), quantity:qty, price:p.price, total, timestamp:new Date() });

    alert('Walk-in recorded, receipt downloaded.');
    document.getElementById('walkinForm').reset();
  }catch(err){ console.error('Walk-in error', err); alert('Error recording walk-in');}
}

function generateReceipt(o){
  try { const { jsPDF } = window.jspdf; const doc = new jsPDF({unit:'pt'}); doc.setFontSize(18); doc.text('AutoFix Spare Parts — Receipt',40,60); doc.setFontSize(11); doc.text(`Date: ${o.timestamp.toLocaleString()}`,40,90); doc.text(`Customer: ${o.name}`,40,110); doc.text(`Item: ${o.partName}`,40,130); doc.text(`Quantity: ${o.quantity}`,40,150); doc.text(`Price (each): KSh ${o.price}`,40,170); doc.setFontSize(13); doc.text(`Total: KSh ${o.total}`,40,200); doc.save(`receipt_${Date.now()}.pdf`); } catch(e){console.error('PDF error',e);}
}

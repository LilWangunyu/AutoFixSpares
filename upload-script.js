// upload-script.js
const uploadBtn = document.getElementById('uploadBtn');
const output = document.getElementById('output');

function parseLines(text){
  return text.split('\n').map(l=>l.trim()).filter(l=>l.length);
}

async function uploadInventory(){
  output.textContent = 'Starting upload...';
  const defaultStock = Math.max(0, parseInt(document.getElementById('defaultStock').value||'10',10));
  const general = parseLines(document.getElementById('generalInput').value);
  const tires = parseLines(document.getElementById('tireInput').value);

  let added = 0;
  // Upload general parts
  for (const line of general){
    // expected format: name-price (dash can be normal hyphen)
    const m = line.match(/^(.+?)[\s]*-[\s]*([\d]+)$/);
    if (!m) { output.textContent += `\nSkipped invalid line (general): ${line}`; continue; }
    const name = m[1].trim();
    const price = parseInt(m[2],10);
    await db.collection('spareParts').add({
      name, price, stock: defaultStock, category: 'General', createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    added++;
  }

  // Upload tires
  for (const line of tires){
    const m = line.match(/^(.+?)[\s]*-[\s]*([\d]+)$/);
    if (!m) { output.textContent += `\nSkipped invalid line (tire): ${line}`; continue; }
    const size = m[1].trim();
    const price = parseInt(m[2],10);
    // store as part with category Tires and size field
    await db.collection('spareParts').add({
      name: `Tire ${size}`,
      price,
      stock: defaultStock,
      category: 'Tires',
      size,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    added++;
  }

  output.textContent = `Upload complete: ${added} items added.`;
}

uploadBtn.addEventListener('click', ()=> {
  if (!confirm('Upload inventory to Firestore? (This will add documents to spareParts collection)')) return;
  uploadInventory().catch(err => {
    console.error('Upload error', err);
    output.textContent = 'Upload failed — check console.';
  });
});

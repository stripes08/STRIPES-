const API = '/api';
let editingId = null;
async function api(path, opts={}) {
  const res = await fetch(API + path, Object.assign({}, opts));
  if(!res.ok) { const t = await res.text().catch(()=>null); throw t || res.statusText; }
  try { return await res.json(); } catch(e) { return {}; }
}
document.addEventListener('DOMContentLoaded', ()=>{
  const addBtn = document.getElementById('addBtn');
  const importBtn = document.getElementById('importBtn');
  const exportBtn = document.getElementById('exportBtn');
  const modal = document.getElementById('modal');
  const modalClose = document.getElementById('modalClose');
  const modalCancel = document.getElementById('modalCancel');
  const orderForm = document.getElementById('orderForm');
  const search = document.getElementById('search');
  const csvInput = document.getElementById('csvInput');
  const pdfModal = document.getElementById('pdfModal');
  const pdfClose = document.getElementById('pdfClose');
  const pdfFrame = document.getElementById('pdfFrame');
  const downloadLink = document.getElementById('downloadLink');

  addBtn.addEventListener('click', ()=>{ openModal(); });
  modalClose.addEventListener('click', closeModal);
  modalCancel.addEventListener('click', closeModal);

  importBtn.addEventListener('click', ()=> csvInput.click());
  csvInput.addEventListener('change', async ()=>{
    const f = csvInput.files[0]; if(!f) return; const fd = new FormData(); fd.append('file', f);
    try{ const res = await fetch('/api/import', { method:'POST', body: fd }); const json = await res.json(); alert('Imported rows: ' + (json.imported || 'unknown')); load(); } catch (e){ alert('Import failed: '+ e); }
  });

  exportBtn.addEventListener('click', ()=> window.location = '/api/export');

  search.addEventListener('input', async (e)=>{ const q = e.target.value.trim(); const rows = await api('/orders' + (q?('?q='+encodeURIComponent(q)):'')); render(rows); });

  orderForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const formData = new FormData(orderForm);
    const obj = {};
    formData.forEach((v,k)=>{ if(k!=='billFile' && k!=='poFile') obj[k]=v });
    const fd = new FormData();
    Object.keys(obj).forEach(k=>fd.append(k,obj[k]));
    const bill = document.getElementById('billFile').files[0];
    const po = document.getElementById('poFile').files[0];
    if(bill) fd.append('billFile', bill);
    if(po) fd.append('poFile', po);

    try{
      if(editingId){
        const res = await fetch('/api/orders/' + editingId, { method:'PUT', body: fd });
        await res.json();
        editingId = null;
      } else {
        const res = await fetch('/api/orders', { method:'POST', body: fd });
        await res.json();
      }
      closeModal();
      orderForm.reset();
      load();
    } catch (err){ alert('Save failed: ' + err); }
  });

  pdfClose.addEventListener('click', ()=> { pdfModal.style.display='none'; pdfFrame.src=''; });

  document.getElementById('ordersTable').addEventListener('click', async (e)=>{
    const tr = e.target.closest('tr'); if(!tr) return;
    const id = tr.dataset.id;
    if(e.target.matches('.edit-btn')){
      const o = await api('/orders/'+id);
      fillForm(o);
      editingId = id;
      openModal('Edit Order');
    }
    if(e.target.matches('.del-btn')){
      if(!confirm('Delete order?')) return;
      try{ await api('/orders/'+id, { method:'DELETE' }); load(); } catch(e){ alert('Delete failed: ' + e); }
    }
    if(e.target.matches('.view-file')){
      const fp = e.target.dataset.path; if(!fp) return alert('No file');
      pdfFrame.src = fp; downloadLink.href = fp; pdfModal.style.display='flex';
    }
  });

  function openModal(title='Add Order'){ document.getElementById('modalTitle').textContent = title; modal.style.display='flex'; }
  function closeModal(){ document.getElementById('orderForm').reset(); editingId=null; modal.style.display='none'; }
  function fillForm(o){ const f = document.getElementById('orderForm'); ['po_no','po_date','client_name','product_details','qty','dispatch_status','invoice_no','invoice_date','invoice_amount','payment_status','delivered_items','undelivered_items'].forEach(k=>{ if(f[k]) f[k].value = o[k] || '' }); }
  async function load(){ const rows = await api('/orders'); render(rows); }
  function render(rows){
    const tbody = document.querySelector('#ordersTable tbody'); tbody.innerHTML='';
    rows.forEach((r,i)=>{
      const tr = document.createElement('tr'); tr.dataset.id = r.id;
      const billLink = r.bill_path ? `<a class="file-link view-file" data-path="${r.bill_path}">View</a>` : '';
      const poLink = r.po_path ? `<a class="file-link view-file" data-path="${r.po_path}">View</a>` : '';
      tr.innerHTML = `<td>${i+1}</td><td>${r.po_no||''}</td><td>${r.client_name||''}</td><td>${(r.product_details||'').replace(/;/g,'; ')}</td><td>${r.qty||0}</td><td>${r.dispatch_status||''}</td><td>${r.invoice_no||''}</td><td>${r.payment_status||''}</td><td>${billLink}</td><td>${poLink}</td><td><button class="edit-btn btn ghost">Edit</button> <button class="del-btn btn ghost">Delete</button></td>`;
      tbody.appendChild(tr);
    });
  }
  load();
});


let orders = [];
let currentSort = { key: 'sr_no', order: 'asc' };

async function api(path, opts={}){
  const res = await fetch(path, Object.assign({ credentials:'include' }, opts));
  if (res.status===401) { alert('Not authenticated - please login'); window.location='/login.html'; throw new Error('unauth'); }
  return res.json();
}

function renderSummary(data){
  document.getElementById('summary').innerHTML = `<strong>Total:</strong> ${data.total||0} &nbsp; <strong>Received:</strong> ${data.received||0} &nbsp; <strong>Pending:</strong> ${data.pending||0}`;
}

async function loadSummary(){ const s = await api('/api/summary'); renderSummary(s); }

async function loadOrders(){
  const q = `?sortBy=${encodeURIComponent(currentSort.key)}&order=${encodeURIComponent(currentSort.order)}`;
  orders = await api('/api/orders' + q);
  renderTable();
}

function renderTable(){
  const tbody = document.querySelector('#ordersTable tbody');
  const filter = document.getElementById('search').value.toLowerCase();
  tbody.innerHTML = '';
  orders.filter(o => {
    if (!filter) return true;
    return String(o.po_no||'').toLowerCase().includes(filter) || String(o.client_name||'').toLowerCase().includes(filter);
  }).forEach(o => {
    const tr = document.createElement('tr');
    tr.dataset.id = o.id;
    tr.innerHTML = `
      <td>${o.sr_no||''}</td>
      <td>${o.po_no||''}</td>
      <td>${o.po_date||''}</td>
      <td>${o.client_name||''}</td>
      <td>${(o.items||[]).map(i=>i.product_name + ' x'+ (i.qty||'')).join('<br>')||''}</td>
      <td>${o.qty_total||''}</td>
      <td>${o.dispatch_status||''}</td>
      <td>${o.invoice_no||''}</td>
      <td>${o.invoice_date||''}</td>
      <td>${o.invoice_amount||''}</td>
      <td class="${(o.payment_status||'').toLowerCase().includes('pending')?'pending': ((o.payment_status||'').toLowerCase().includes('received')?'received':'')}">${o.payment_status||''}</td>
      <td class="actions">
        <button data-id="${o.id}" class="editBtn">Edit</button>
        <button data-id="${o.id}" class="delBtn">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function makeProductLine(defaults={}){
  const div = document.createElement('div');
  div.className = 'product-line';
  div.innerHTML = `
    <input class="pname" placeholder="Product name" value="${defaults.product_name||''}" />
    <input class="pqty" type="number" placeholder="Qty" value="${defaults.qty||''}" style="width:80px" />
    <input class="punit" type="number" placeholder="Unit price" value="${defaults.unit_price||''}" style="width:100px" />
    <input class="premarks" placeholder="Remarks" value="${defaults.remarks||''}" />
    <button type="button" class="removeLine">-</button>
  `;
  div.querySelector('.removeLine').addEventListener('click', ()=>div.remove());
  return div;
}

document.getElementById('addProductBtn').addEventListener('click', ()=>{
  document.getElementById('productContainer').appendChild(makeProductLine());
});

document.getElementById('orderForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const f = e.target;
  const form = new FormData(f);
  const items = Array.from(document.querySelectorAll('.product-line')).map(div => {
    return {
      product_name: div.querySelector('.pname').value,
      qty: Number(div.querySelector('.pqty').value||0),
      unit_price: Number(div.querySelector('.punit').value||0),
      remarks: div.querySelector('.premarks').value||''
    };
  }).filter(it => it.product_name);
  const payload = {
    sr_no: form.get('sr_no'),
    po_no: form.get('po_no'),
    po_date: form.get('po_date'),
    client_name: form.get('client_name'),
    items,
    dispatch_status: form.get('dispatch_status'),
    invoice_no: form.get('invoice_no'),
    invoice_date: form.get('invoice_date'),
    invoice_amount: form.get('invoice_amount'),
    payment_status: form.get('payment_status')
  };
  await api('/api/orders', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  f.reset();
  document.getElementById('productContainer').innerHTML = '<h4>Products</h4>';
  loadSummary();
  loadOrders();
});

document.getElementById('ordersTable').addEventListener('click', async (e)=>{
  if (e.target.classList.contains('delBtn')){
    const id = e.target.dataset.id;
    if (!confirm('Delete order?')) return;
    await api('/api/orders/' + id, { method:'DELETE' });
    loadSummary(); loadOrders();
  }
  if (e.target.classList.contains('editBtn')){
    const id = e.target.dataset.id;
    const order = orders.find(o=>o.id==id);
    if (!order) return;
    if (!confirm('This will load the order into the form for editing. After saving, the original will be replaced. Continue?')) return;
    document.querySelector('input[name=sr_no]').value = order.sr_no || '';
    document.querySelector('input[name=po_no]').value = order.po_no || '';
    document.querySelector('input[name=po_date]').value = order.po_date || '';
    document.querySelector('input[name=client_name]').value = order.client_name || '';
    document.getElementById('productContainer').innerHTML = '<h4>Products</h4>';
    (order.items||[]).forEach(it => document.getElementById('productContainer').appendChild(makeProductLine(it)));
    document.querySelector('input[name=dispatch_status]').value = order.dispatch_status || '';
    document.querySelector('input[name=invoice_no]').value = order.invoice_no || '';
    document.querySelector('input[name=invoice_date]').value = order.invoice_date || '';
    document.querySelector('input[name=invoice_amount]').value = order.invoice_amount || '';
    document.querySelector('input[name=payment_status]').value = order.payment_status || '';
    await api('/api/orders/' + id, { method:'DELETE' });
    loadOrders(); loadSummary();
  }
});

document.getElementById('search').addEventListener('input', ()=>renderTable());

document.querySelectorAll('th[data-key]').forEach(h => h.addEventListener('click', ()=>{
  const key = h.dataset.key;
  if (currentSort.key===key) currentSort.order = currentSort.order==='asc' ? 'desc' : 'asc';
  else { currentSort.key = key; currentSort.order = 'asc'; }
  loadOrders();
}));

document.getElementById('exportBtn').addEventListener('click', ()=>{ window.location='/api/export-csv'; });

document.getElementById('importBtn').addEventListener('click', async ()=>{
  const f = document.getElementById('importFile');
  if (!f.files.length) return alert('Select CSV first');
  const fd = new FormData(); fd.append('file', f.files[0]);
  const res = await fetch('/api/import-csv', { method:'POST', body: fd, credentials:'include' });
  const data = await res.json();
  alert('Imported ' + (data.imported||0) + ' rows');
  loadSummary(); loadOrders();
});

document.getElementById('logoutBtn').addEventListener('click', async ()=>{
  await fetch('/logout', { method:'POST' });
  window.location = '/login.html';
});

loadSummary();
loadOrders();

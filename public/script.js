
const API_ROOT = '';
async function api(path, opts){ const res = await fetch(path, Object.assign({headers:{'Content-Type':'application/json'}}, opts)); if (!res.ok) { const t = await res.text(); throw t; } return res.json(); }

async function load(){
  try{
    const rows = await api('/orders');
    render(rows);
  }catch(e){ console.error(e); alert('Error loading orders'); }
}

function render(rows){
  const tbody = document.querySelector('#ordersTable tbody'); tbody.innerHTML='';
  rows.forEach((r, i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td>
      <td>${r.order_number}</td>
      <td>${r.order_date||''}</td>
      <td>${r.company_name||''}</td>
      <td>${(r.product_details||'').replace(/;/g,'; ')}</td>
      <td>${r.qty||0}</td>
      <td>${r.dispatch_status||''}</td>
      <td>${r.invoice_no||''}</td>
      <td>${r.invoice_amount||''}</td>
      <td>${r.payment_status||''}</td>
      <td>${(r.delivered_items||'')}</td>
      <td>${(r.undelivered_items||'')}</td>
      <td class="actions">
        <button onclick="edit(${r.id})">Edit</button>
        <button onclick="del(${r.id})" style="background:#ef4444;color:#fff">Delete</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

document.getElementById('orderForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const f = e.target;
  const data = {
    order_number: f.order_number.value.trim(),
    order_date: f.order_date.value,
    company_name: f.company_name.value.trim(),
    product_details: f.product_details.value.trim(),
    qty: Number(f.qty.value)||0,
    dispatch_status: f.dispatch_status.value,
    invoice_no: f.invoice_no.value,
    invoice_date: f.invoice_date.value,
    invoice_amount: Number(f.invoice_amount.value)||0,
    payment_status: f.payment_status.value,
    delivered_items: f.delivered_items.value,
    undelivered_items: f.undelivered_items.value
  };
  try{
    await api('/add-order', { method:'POST', body: JSON.stringify(data) });
    f.reset();
    load();
  }catch(err){ alert('Error saving order: ' + err); }
});

function del(id){
  if(!confirm('Delete this order?')) return;
  fetch('/delete/' + id, { method:'DELETE' }).then(()=>load()).catch(e=>alert('Delete error'));
}

document.getElementById('refreshBtn').addEventListener('click', load);
document.getElementById('clearBtn').addEventListener('click', ()=>document.getElementById('orderForm').reset());
document.getElementById('search').addEventListener('input', async (e)=>{
  const q = e.target.value.toLowerCase();
  const rows = await (await fetch('/orders')).json();
  const filtered = rows.filter(r=> (r.order_number||'').toLowerCase().includes(q) || (r.company_name||'').toLowerCase().includes(q) || (r.product_details||'').toLowerCase().includes(q));
  render(filtered);
});

load();

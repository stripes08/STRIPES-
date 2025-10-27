
const API = '/api';
let editingId = null;
let currentDispatchOrder = null;

async function api(path, opts={}) {
  const res = await fetch(API + path, Object.assign({headers: {'Content-Type':'application/json'}}, opts));
  if (!res.ok) {
    const t = await res.text().catch(()=>null);
    throw t || res.statusText;
  }
  try { return await res.json(); } catch(e) { return {}; }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('orderForm');
  const tbody = document.querySelector('#ordersTable tbody');
  const importFile = document.getElementById('fileInput');

  loadOrders();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if (data.qty) data.qty = Number(data.qty);
    try {
      if (editingId) {
        await api(`/orders/${editingId}`, { method: 'PUT', body: JSON.stringify(data) });
        editingId = null;
      } else {
        await api('/orders', { method: 'POST', body: JSON.stringify(data) });
      }
      form.reset();
      loadOrders();
    } catch (err) {
      alert('Save failed: ' + err);
    }
  });

  document.getElementById('clearBtn').addEventListener('click', () => {
    form.reset();
    editingId = null;
  });

  document.getElementById('importBtn').addEventListener('click', async () => {
    const file = importFile.files[0];
    if (!file) return alert('Choose CSV file first');
    const fd = new FormData(); fd.append('file', file);
    try {
      const res = await fetch('/api/import', { method: 'POST', body: fd });
      const json = await res.json();
      alert('Imported rows: ' + (json.imported || 'unknown'));
      loadOrders();
    } catch (err) {
      alert('Import failed: ' + err);
    }
  });

  document.getElementById('exportBtn').addEventListener('click', () => {
    window.location = '/api/export';
  });

  document.getElementById('refreshBtn').addEventListener('click', loadOrders);

  document.getElementById('search').addEventListener('input', async (e) => {
    const q = e.target.value.trim();
    const rows = await api('/orders' + (q ? ('?q=' + encodeURIComponent(q)) : ''));
    renderTable(rows);
  });

  tbody.addEventListener('click', async (e) => {
    const tr = e.target.closest('tr');
    if (!tr) return;
    const id = tr.dataset.id;
    if (e.target.matches('.edit-btn')) {
      try {
        const o = await api('/orders/' + id);
        fillForm(o);
        editingId = id;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) { alert('Failed to load order: ' + err); }
    }
    if (e.target.matches('.del-btn')) {
      if (!confirm('Delete order?')) return;
      try {
        await api('/orders/' + id, { method: 'DELETE' });
        loadOrders();
      } catch (err) { alert('Delete failed: ' + err); }
    }
    if (e.target.matches('.dispatch-btn')) {
      try {
        currentDispatchOrder = await api('/orders/' + id);
        openDispatchModal(currentDispatchOrder);
      } catch (err) { alert('Load failed: ' + err); }
    }
  });

  document.getElementById('dispatchClose').addEventListener('click', () => closeDispatchModal());
  document.getElementById('dispatchSave').addEventListener('click', async () => {
    const checks = Array.from(document.querySelectorAll('#dispatch-list input[type=checkbox]'));
    const total = checks.length;
    const checked = checks.filter(c => c.checked).length;
    let status = 'Pending';
    if (checked === total) status = 'Delivered';
    else if (checked > 0) status = 'Partial';
    const delivered = checks.filter(c => c.checked).map(c => c.dataset.prod).join('; ');
    const undelivered = checks.filter(c => !c.checked).map(c => c.dataset.prod).join('; ');
    const body = Object.assign({}, currentDispatchOrder, {
      dispatch_status: status,
      delivered_items: delivered,
      undelivered_items: undelivered
    });
    try {
      await api('/orders/' + currentDispatchOrder.id, { method: 'PUT', body: JSON.stringify(body) });
      closeDispatchModal();
      loadOrders();
    } catch (err) { alert('Save dispatch failed: ' + err); }
  });

  function fillForm(o) {
    for (const k of ['po_no','po_date','client_name','product_details','qty','dispatch_status','invoice_no','invoice_date','invoice_amount','payment_status','delivered_items','undelivered_items']) {
      if (o[k] !== undefined && form[k]) form[k].value = o[k];
    }
  }

  function openDispatchModal(order) {
    const list = document.getElementById('dispatch-list');
    list.innerHTML = '';
    const parts = (order.product_details || '').split(';').map(s => s.trim()).filter(Boolean);
    const deliveredSet = new Set(((order.delivered_items || '')).split(';').map(s => s.trim()).filter(Boolean));
    parts.forEach(p => {
      const li = document.createElement('li');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.prod = p;
      if (deliveredSet.has(p)) checkbox.checked = true;
      li.appendChild(checkbox);
      const text = document.createTextNode(' ' + p);
      li.appendChild(text);
      list.appendChild(li);
    });
    document.getElementById('dispatch-info').textContent = `PO: ${order.po_no} — ${order.client_name}`;
    document.getElementById('dispatch-modal').style.display = 'flex';
  }

  function closeDispatchModal() {
    document.getElementById('dispatch-modal').style.display = 'none';
  }

  async function loadOrders() {
    const rows = await api('/orders');
    renderTable(rows);
  }

  function renderTable(rows) {
    const tbody = document.querySelector('#ordersTable tbody');
    tbody.innerHTML = '';
    rows.forEach((r,i) => {
      const tr = document.createElement('tr');
      tr.dataset.id = r.id;
      tr.innerHTML = `<td>${i+1}</td>
        <td>${r.po_no||''}</td>
        <td>${r.po_date||''}</td>
        <td>${r.client_name||''}</td>
        <td>${(r.product_details||'').replace(/;/g,'; ')}</td>
        <td>${r.qty||0}</td>
        <td>${r.dispatch_status||''}</td>
        <td>${r.invoice_no||''}</td>
        <td>${r.invoice_amount||''}</td>
        <td>${r.payment_status||''}</td>
        <td>${r.delivered_items||''}</td>
        <td>${r.undelivered_items||''}</td>
        <td class="actions">
          <button class="edit-btn">Edit</button>
          <button class="dispatch-btn">Dispatch</button>
          <button class="del-btn">Delete</button>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  // initial load
  loadOrders();
});

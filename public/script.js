// public/script.js
document.addEventListener('DOMContentLoaded', () => {
  const orderForm = document.getElementById('order-form');
  const ordersTableBody = document.querySelector('#orders-table tbody');
  const addProductBtn = document.getElementById('add-product');
  const exportBtn = document.getElementById('export-btn');
  const importInput = document.getElementById('import-csv');
  const searchInput = document.getElementById('search');
  const dispatchModal = document.getElementById('dispatch-modal');
  const dispatchList = document.getElementById('dispatch-list');
  const saveDispatchBtn = document.getElementById('save-dispatch');

  let editingOrderId = null;
  let currentDispatchOrder = null;

  // Fetch and display orders
  async function loadOrders() {
    const res = await fetch('/api/orders');
    const orders = await res.json();
    renderOrders(orders);
  }

  // Render orders into table
  function renderOrders(orders) {
    ordersTableBody.innerHTML = '';
    orders.forEach((order, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${order.po_no}</td>
        <td>${order.po_date}</td>
        <td>${order.client_name}</td>
        <td>${order.product_details}</td>
        <td>${order.qty}</td>
        <td>${order.dispatch_status}</td>
        <td>${order.invoice_no || ''}</td>
        <td>${order.invoice_date || ''}</td>
        <td>${order.invoice_amount || ''}</td>
        <td>${order.payment_status || ''}</td>
        <td>
          <button class="edit-btn" data-id="${order.id}">Edit</button>
          <button class="delete-btn" data-id="${order.id}">Delete</button>
          <button class="dispatch-btn" data-id="${order.id}">Dispatch</button>
        </td>
      `;
      ordersTableBody.appendChild(tr);
    });
  }

  // Add or update order
  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(orderForm);
    const data = Object.fromEntries(formData.entries());

    const url = editingOrderId ? `/api/orders/${editingOrderId}` : '/api/orders';
    const method = editingOrderId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      alert(editingOrderId ? 'Order updated!' : 'Order added!');
      orderForm.reset();
      editingOrderId = null;
      loadOrders();
    } else {
      alert('Failed to save order');
    }
  });

  // Handle edit/delete/dispatch buttons
  ordersTableBody.addEventListener('click', async (e) => {
    const id = e.target.dataset.id;

    if (e.target.classList.contains('delete-btn')) {
      if (confirm('Are you sure you want to delete this order?')) {
        await fetch(`/api/orders/${id}`, { method: 'DELETE' });
        loadOrders();
      }
    }

    if (e.target.classList.contains('edit-btn')) {
      const res = await fetch(`/api/orders/${id}`);
      const order = await res.json();
      for (let key in order) {
        if (orderForm[key]) orderForm[key].value = order[key];
      }
      editingOrderId = id;
    }

    if (e.target.classList.contains('dispatch-btn')) {
      const res = await fetch(`/api/orders/${id}`);
      const order = await res.json();
      currentDispatchOrder = order;
      openDispatchModal(order);
    }
  });

  // CSV Export
  exportBtn.addEventListener('click', async () => {
    const res = await fetch('/api/export');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orders.csv';
    a.click();
  });

  // CSV Import
  importInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/import', {
      method: 'POST',
      body: formData,
    });
    if (res.ok) {
      alert('CSV imported successfully!');
      loadOrders();
    } else {
      alert('Failed to import CSV.');
    }
  });

  // Search
  searchInput.addEventListener('input', async () => {
    const query = searchInput.value.toLowerCase();
    const res = await fetch('/api/orders');
    const orders = await res.json();
    const filtered = orders.filter(o =>
      o.po_no.toLowerCase().includes(query) ||
      o.client_name.toLowerCase().includes(query)
    );
    renderOrders(filtered);
  });

  // Dispatch modal functions
  function openDispatchModal(order) {
    dispatchList.innerHTML = '';
    const products = order.product_details.split(';').map(p => p.trim());
    products.forEach(prod => {
      const li = document.createElement('li');
      li.innerHTML = `
        <label>
          <input type="checkbox" class="dispatch-item">
          ${prod}
        </label>
      `;
      dispatchList.appendChild(li);
    });
    dispatchModal.style.display = 'block';
  }

  saveDispatchBtn.addEventListener('click', async () => {
    const checkboxes = document.querySelectorAll('.dispatch-item');
    const total = checkboxes.length;
    const checked = [...checkboxes].filter(cb => cb.checked).length;

    let status = 'Pending';
    if (checked === total) status = 'Delivered';
    else if (checked > 0) status = 'Partially Delivered';

    currentDispatchOrder.dispatch_status = status;

    await fetch(`/api/orders/${currentDispatchOrder.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentDispatchOrder),
    });

    alert('Dispatch status updated!');
    dispatchModal.style.display = 'none';
    loadOrders();
  });

  // Close modal on outside click
  window.addEventListener('click', (e) => {
    if (e.target === dispatchModal) dispatchModal.style.display = 'none';
  });

  loadOrders();
});

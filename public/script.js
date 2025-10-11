// --- GLOBAL STATE ---
let editingOrderId = null;
let orders = [];
const API_URL = window.location.origin;

// --- DOM ELEMENTS ---
const form = document.getElementById("orderForm");
const tableBody = document.querySelector("#orderTable tbody");
const searchInput = document.getElementById("search");
const filterStatus = document.getElementById("filterStatus");
const filterPayment = document.getElementById("filterPayment");
const filterDate = document.getElementById("filterDate");

// --- FETCH ORDERS ---
async function fetchOrders() {
  const res = await fetch(`${API_URL}/api/orders`);
  orders = await res.json();
  renderTable(orders);
}

// --- RENDER TABLE ---
function renderTable(data) {
  tableBody.innerHTML = "";
  data.forEach((order, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${order.po_no}</td>
      <td>${order.po_date}</td>
      <td>${order.client_name}</td>
      <td>${order.product_details}</td>
      <td>${order.qty}</td>
      <td>${order.dispatch_status}</td>
      <td>${order.invoice_no || "-"}</td>
      <td>${order.invoice_date || "-"}</td>
      <td>${order.invoice_amount || "-"}</td>
      <td>${order.payment_status || "-"}</td>
      <td class="actions">
        <button class="edit" onclick="editOrder(${order.id})">Edit</button>
        <button class="delete" onclick="deleteOrder(${order.id})">Delete</button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

// --- HANDLE FORM SUBMIT ---
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const order = {
    po_no: form.po_no.value.trim(),
    po_date: form.po_date.value,
    client_name: form.client_name.value.trim(),
    product_details: form.product_details.value.trim(),
    qty: form.qty.value,
    dispatch_status: form.dispatch_status.value,
    invoice_no: form.invoice_no.value.trim(),
    invoice_date: form.invoice_date.value,
    invoice_amount: form.invoice_amount.value,
    payment_status: form.payment_status.value
  };

  // Prevent duplicate PO numbers
  const duplicate = orders.find(
    (o) => o.po_no.toLowerCase() === order.po_no.toLowerCase() && o.id !== editingOrderId
  );
  if (duplicate) {
    alert("⚠️ This PO Number already exists!");
    return;
  }

  if (editingOrderId) {
    await fetch(`${API_URL}/api/orders/${editingOrderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order)
    });
    editingOrderId = null;
  } else {
    await fetch(`${API_URL}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order)
    });
  }

  form.reset();
  fetchOrders();
});

// --- EDIT ORDER ---
async function editOrder(id) {
  const order = orders.find((o) => o.id === id);
  if (!order) return;

  form.po_no.value = order.po_no;
  form.po_date.value = order.po_date;
  form.client_name.value = order.client_name;
  form.product_details.value = order.product_details;
  form.qty.value = order.qty;
  form.dispatch_status.value = order.dispatch_status;
  form.invoice_no.value = order.invoice_no;
  form.invoice_date.value = order.invoice_date;
  form.invoice_amount.value = order.invoice_amount;
  form.payment_status.value = order.payment_status;

  editingOrderId = id;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// --- DELETE ORDER ---
async function deleteOrder(id) {
  if (!confirm("Delete this order?")) return;
  await fetch(`${API_URL}/api/orders/${id}`, { method: "DELETE" });
  fetchOrders();
}

// --- FILTERING / SEARCHING ---
function applyFilters() {
  let filtered = [...orders];

  const searchText = searchInput.value.toLowerCase();
  if (searchText) {
    filtered = filtered.filter(
      (o) =>
        o.po_no.toLowerCase().includes(searchText) ||
        o.client_name.toLowerCase().includes(searchText)
    );
  }

  if (filterStatus.value !== "all") {
    filtered = filtered.filter((o) => o.dispatch_status === filterStatus.value);
  }

  if (filterPayment.value !== "all") {
    filtered = filtered.filter((o) => o.payment_status === filterPayment.value);
  }

  if (filterDate.value) {
    filtered = filtered.filter((o) => o.po_date === filterDate.value);
  }

  renderTable(filtered);
}

searchInput.addEventListener("input", applyFilters);
filterStatus.addEventListener("change", applyFilters);
filterPayment.addEventListener("change", applyFilters);
filterDate.addEventListener("change", applyFilters);

// --- INIT ---
fetchOrders();

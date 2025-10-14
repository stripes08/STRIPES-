document.addEventListener("DOMContentLoaded", () => {
  fetchOrders();

  // Add order
  document.getElementById("orderForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    await fetch("/add-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    e.target.reset();
    fetchOrders();
  });
});

// Fetch orders
async function fetchOrders() {
  const res = await fetch("/orders");
  const orders = await res.json();
  const table = document.querySelector("#orderTable tbody");
  table.innerHTML = "";

  orders.forEach((o) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${o.id}</td>
      <td>${o.order_number}</td>
      <td>${o.company_name}</td>
      <td>${o.order_remark}</td>
      <td>${o.ready_status}</td>
      <td>${o.delivery_status}</td>
      <td>${o.payment_status}</td>
      <td>
        <button onclick="editOrder(${o.id})">Edit</button>
        <button onclick="deleteOrder(${o.id})">Delete</button>
      </td>
    `;
    table.appendChild(row);
  });
}

// Edit order
async function editOrder(id) {
  const res = await fetch(`/orders/${id}`);
  const order = await res.json();

  // Fill form with existing order data
  document.getElementById("order_number").value = order.order_number;
  document.getElementById("company_name").value = order.company_name;
  document.getElementById("order_remark").value = order.order_remark;
  document.getElementById("ready_status").value = order.ready_status;
  document.getElementById("delivery_status").value = order.delivery_status;
  document.getElementById("payment_status").value = order.payment_status;

  // Change button text
  const btn = document.querySelector("#orderForm button[type='submit']");
  btn.textContent = "Update Order";

  // Update submit event for editing
  document.getElementById("orderForm").onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    await fetch(`/update-order/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    btn.textContent = "Add Order";
    e.target.reset();
    fetchOrders();
  };
}

// Delete order
async function deleteOrder(id) {
  if (confirm("Are you sure you want to delete this order?")) {
    await fetch(`/delete-order/${id}`, { method: "DELETE" });
    fetchOrders();
  }
}

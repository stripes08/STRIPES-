document.addEventListener("DOMContentLoaded", async () => {
  const tableBody = document.querySelector("#orderTableBody");

  // ✅ Fetch and display orders
  async function loadOrders() {
    const res = await fetch("/orders");
    const orders = await res.json();

    tableBody.innerHTML = "";
    orders.forEach(order => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${order.order_no}</td>
        <td>${order.order_date}</td>
        <td>${order.company_name}</td>
        <td>${order.remark}</td>
        <td>${order.ready_status}</td>
        <td>${order.delivery_status}</td>
        <td>${order.payment_status}</td>
        <td>
          <button class="edit-btn" data-id="${order.id}">Edit</button>
          <button class="delete-btn" data-id="${order.id}">Delete</button>
        </td>
      `;
      tableBody.appendChild(row);
    });

    attachEventListeners();
  }

  // ✅ Edit button logic
  function attachEventListeners() {
    document.querySelectorAll(".edit-btn").forEach(button => {
      button.addEventListener("click", async () => {
        const id = button.dataset.id;
        const newRemark = prompt("Enter updated remark:");
        if (newRemark) {
          const res = await fetch(`/update/${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ remark: newRemark })
          });
          if (res.ok) loadOrders();
        }
      });
    });

    // ✅ Delete button logic
    document.querySelectorAll(".delete-btn").forEach(button => {
      button.addEventListener("click", async () => {
        const id = button.dataset.id;
        if (confirm("Are you sure you want to delete this order?")) {
          const res = await fetch(`/delete/${id}`, { method: "DELETE" });
          if (res.ok) loadOrders();
        }
      });
    });
  }

  await loadOrders();
});

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Order Records v5</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f3f4f6;
      padding: 20px;
      color: #333;
    }
    h1 {
      text-align: center;
      color: #2c3e50;
    }
    form {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
      margin-bottom: 20px;
      max-width: 800px;
      margin-left: auto;
      margin-right: auto;
    }
    input, select, textarea, button {
      width: 100%;
      margin: 8px 0;
      padding: 10px;
      border: 1px solid #ccc;
      border-radius: 6px;
    }
    button {
      background-color: #2ecc71;
      color: white;
      font-weight: bold;
      cursor: pointer;
      transition: background 0.3s;
    }
    button:hover {
      background-color: #27ae60;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background-color: white;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    th, td {
      padding: 10px;
      border-bottom: 1px solid #ddd;
      text-align: center;
    }
    th {
      background-color: #3498db;
      color: white;
    }
    .delete-btn {
      background-color: #e74c3c;
      color: white;
      border: none;
      padding: 5px 10px;
      border-radius: 4px;
      cursor: pointer;
    }
    .delete-btn:hover {
      background-color: #c0392b;
    }
  </style>
</head>
<body>
  <h1>Order Records v5</h1>

  <form id="orderForm">
    <input type="text" id="order_number" placeholder="Order Number" required />
    <input type="date" id="order_date" required />
    <input type="text" id="company_name" placeholder="Company Name" required />
    <textarea id="order_remark" placeholder="Order Remark"></textarea>
    
    <select id="ready_status">
      <option value="Ready">Ready</option>
      <option value="Not Ready">Not Ready</option>
    </select>
    
    <select id="delivery_status">
      <option value="Pending">Pending</option>
      <option value="Dispatched">Dispatched</option>
      <option value="Delivered">Delivered</option>
    </select>
    
    <select id="payment_status">
      <option value="Pending">Pending</option>
      <option value="Received">Received</option>
    </select>

    <input type="text" id="delivered_items" placeholder="Delivered Items (comma separated)" />
    <input type="text" id="undelivered_items" placeholder="Undelivered Items (comma separated)" />

    <button type="submit">Add Order</button>
  </form>

  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Order No.</th>
        <th>Date</th>
        <th>Company</th>
        <th>Ready</th>
        <th>Delivery</th>
        <th>Payment</th>
        <th>Delivered Items</th>
        <th>Undelivered Items</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody id="orderTable"></tbody>
  </table>

  <script>
    async function fetchOrders() {
      const res = await fetch("/orders");
      const orders = await res.json();
      const table = document.getElementById("orderTable");
      table.innerHTML = "";

      orders.forEach((order) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${order.id}</td>
          <td>${order.order_number}</td>
          <td>${order.order_date}</td>
          <td>${order.company_name}</td>
          <td>${order.ready_status}</td>
          <td>${order.delivery_status}</td>
          <td>${order.payment_status}</td>
          <td>${order.delivered_items || "-"}</td>
          <td>${order.undelivered_items || "-"}</td>
          <td><button class="delete-btn" onclick="deleteOrder(${order.id})">Delete</button></td>
        `;
        table.appendChild(row);
      });
    }

    async function deleteOrder(id) {
      await fetch(`/delete/${id}`, { method: "DELETE" });
      fetchOrders();
    }

    document.getElementById("orderForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = {
        order_number: document.getElementById("order_number").value,
        order_date: document.getElementById("order_date").value,
        company_name: document.getElementById("company_name").value,
        order_remark: document.getElementById("order_remark").value,
        ready_status: document.getElementById("ready_status").value,
        delivery_status: document.getElementById("delivery_status").value,
        payment_status: document.getElementById("payment_status").value,
        delivered_items: document.getElementById("delivered_items").value,
        undelivered_items: document.getElementById("undelivered_items").value,
      };

      await fetch("/add-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      e.target.reset();
      fetchOrders();
    });

    fetchOrders();
  </script>
</body>
</html>

// server.js — backend for Order Records v5
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Database setup
const db = new sqlite3.Database("orders.db");
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE,
      order_date TEXT,
      company_name TEXT,
      order_remark TEXT,
      ready_status TEXT,
      delivery_status TEXT,
      payment_status TEXT,
      delivered_items TEXT,
      undelivered_items TEXT
    )
  `);
});

// Get all orders
app.get("/orders", (req, res) => {
  db.all("SELECT * FROM orders ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Add new order
app.post("/add-order", (req, res) => {
  const {
    order_number,
    order_date,
    company_name,
    order_remark,
    ready_status,
    delivery_status,
    payment_status,
    delivered_items,
    undelivered_items,
  } = req.body;

  const query = `
    INSERT INTO orders (
      order_number, order_date, company_name, order_remark,
      ready_status, delivery_status, payment_status,
      delivered_items, undelivered_items
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  db.run(
    query,
    [
      order_number,
      order_date,
      company_name,
      order_remark,
      ready_status,
      delivery_status,
      payment_status,
      delivered_items,
      undelivered_items,
    ],
    function (err) {
      if (err) {
        if (err.message.includes("UNIQUE constraint failed")) {
          return res.status(400).json({ error: "Order number already exists" });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: this.lastID });
    }
  );
});

// Delete order
app.delete("/delete/:id", (req, res) => {
  db.run("DELETE FROM orders WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Order deleted", changes: this.changes });
  });
});

// Default route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

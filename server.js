// server.js — main backend logic

const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const multer = require("multer");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: true,
  })
);

// Database setup
const db = new sqlite3.Database("orders.db", (err) => {
  if (err) console.error("❌ Database error:", err);
  else console.log("✅ Connected to SQLite database");
});

// Create table if it doesn't exist
db.run(
  `CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT,
    order_date TEXT,
    company_name TEXT,
    order_remark TEXT,
    ready_status TEXT,
    delivery_status TEXT,
    payment_status TEXT,
    delivered_items TEXT,
    undelivered_items TEXT
  )`
);

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Get all orders
app.get("/orders", (req, res) => {
  db.all("SELECT * FROM orders", (err, rows) => {
    if (err) res.status(500).send("Error fetching orders");
    else res.json(rows);
  });
});

// Add a new order
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
    (err) => {
      if (err) res.status(500).send("Error adding order");
      else res.send("✅ Order added successfully!");
    }
  );
});

// Delete an order
app.delete("/delete/:id", (req, res) => {
  const id = req.params.id;
  db.run("DELETE FROM orders WHERE id = ?", id, (err) => {
    if (err) res.status(500).send("Error deleting order");
    else res.send("🗑️ Order deleted");
  });
});

// Server start
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

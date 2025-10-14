
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

const dbFile = path.join(__dirname, "orders.db");
const db = new sqlite3.Database(dbFile, (err)=> { if(err) console.error(err); });

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE,
    order_date TEXT,
    company_name TEXT,
    product_details TEXT,
    qty INTEGER,
    dispatch_status TEXT,
    invoice_no TEXT,
    invoice_date TEXT,
    invoice_amount REAL,
    payment_status TEXT,
    delivered_items TEXT,
    undelivered_items TEXT,
    created_at TEXT
  )`);
});

app.get("/orders", (req, res) => {
  db.all("SELECT * FROM orders ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/add-order", (req, res) => {
  const b = req.body;
  const q = `INSERT INTO orders (order_number, order_date, company_name, product_details, qty, dispatch_status, invoice_no, invoice_date, invoice_amount, payment_status, delivered_items, undelivered_items, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`;
  db.run(q, [
    b.order_number, b.order_date, b.company_name, b.product_details || '', b.qty || 0, b.dispatch_status || 'Pending',
    b.invoice_no || '', b.invoice_date || '', b.invoice_amount || 0, b.payment_status || 'Pending',
    b.delivered_items || '', b.undelivered_items || ''
  ], function(err){
    if (err) {
      if (err.message.includes("UNIQUE constraint failed")) return res.status(400).json({ error: "Order number already exists" });
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: this.lastID });
  });
});

app.delete("/delete/:id", (req, res) => {
  db.run("DELETE FROM orders WHERE id = ?", [req.params.id], function(err){
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, ()=> console.log("Server running on port", PORT));

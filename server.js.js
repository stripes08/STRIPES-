// server.js — main backend logic for Order Record App PRO
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// ===== Database Setup =====
const db = new sqlite3.Database("./orders.db", (err) => {
  if (err) console.error("Database connection failed:", err);
  else console.log("✅ Connected to SQLite database.");
});

db.run(`CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_no TEXT UNIQUE,
  po_date TEXT,
  client_name TEXT,
  product_details TEXT,
  qty TEXT,
  dispatch_status TEXT,
  invoice_no TEXT,
  invoice_date TEXT,
  invoice_amount TEXT,
  payment_status TEXT
)`);

// ===== CSV Upload (Dummy or Bulk Import) =====
const upload = multer({ dest: "uploads/" });
app.post("/upload", upload.single("file"), (req, res) => {
  const fileRows = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (row) => {
      db.run(
        `INSERT OR IGNORE INTO orders 
        (po_no, po_date, client_name, product_details, qty, dispatch_status, invoice_no, invoice_date, invoice_amount, payment_status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row["PO No"],
          row["PO Date"],
          row["Client Name"],
          row["Product Details"],
          row["Qty"],
          row["Dispatch/Delivered"],
          row["Invoice No"],
          row["Invoice Date"],
          row["Invoice Amount"],
          row["Payment Status"],
        ]
      );
    })
    .on("end", () => {
      fs.unlinkSync(req.file.path);
      res.json({ message: "✅ CSV uploaded successfully!" });
    });
});

// ===== API Routes =====
app.get("/orders", (req, res) => {
  db.all("SELECT * FROM orders ORDER BY id DESC", [], (err, rows) => {
    if (err) res.status(500).send(err.message);
    else res.json(rows);
  });
});

app.post("/orders", (req, res) => {
  const o = req.body;
  db.run(
    `INSERT OR IGNORE INTO orders 
    (po_no, po_date, client_name, product_details, qty, dispatch_status, invoice_no, invoice_date, invoice_amount, payment_status) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      o.po_no,
      o.po_date,
      o.client_name,
      o.product_details,
      o.qty,
      o.dispatch_status,
      o.invoice_no,
      o.invoice_date,
      o.invoice_amount,
      o.payment_status,
    ],
    (err) => {
      if (err) res.status(500).send(err.message);
      else res.json({ message: "✅ Order added successfully!" });
    }
  );
});

app.put("/orders/:id", (req, res) => {
  const id = req.params.id;
  const o = req.body;
  db.run(
    `UPDATE orders SET po_no=?, po_date=?, client_name=?, product_details=?, qty=?, dispatch_status=?, invoice_no=?, invoice_date=?, invoice_amount=?, payment_status=? WHERE id=?`,
    [
      o.po_no,
      o.po_date,
      o.client_name,
      o.product_details,
      o.qty,
      o.dispatch_status,
      o.invoice_no,
      o.invoice_date,
      o.invoice_amount,
      o.payment_status,
      id,
    ],
    (err) => {
      if (err) res.status(500).send(err.message);
      else res.json({ message: "✅ Order updated successfully!" });
    }
  );
});

app.delete("/orders/:id", (req, res) => {
  db.run(`DELETE FROM orders WHERE id=?`, [req.params.id], (err) => {
    if (err) res.status(500).send(err.message);
    else res.json({ message: "🗑️ Order deleted." });
  });
});

// ===== Start Server =====
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

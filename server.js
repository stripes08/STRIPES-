// --- Import Modules ---
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const fs = require("fs");

// --- App Setup ---
const app = express();
const PORT = process.env.PORT || 3000;
const APP_PASSWORD = process.env.APP_PASSWORD || "stripes";
const SESSION_SECRET = process.env.SESSION_SECRET || "my_secret_key";

// --- Middleware ---
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

// --- Static Files ---
app.use(express.static(path.join(__dirname, "public")));

// --- SQLite Setup ---
const dbFile = path.join(__dirname, "orders.db");
const db = new sqlite3.Database(dbFile);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_no TEXT UNIQUE,
    po_date TEXT,
    client_name TEXT,
    product_details TEXT,
    qty INTEGER,
    dispatch_status TEXT,
    invoice_no TEXT,
    invoice_date TEXT,
    invoice_amount REAL,
    payment_status TEXT
  )`);
});

// --- Authentication Middleware ---
function checkAuth(req, res, next) {
  if (req.session.loggedIn) next();
  else res.redirect("/login.html");
}

// --- Routes ---
// Login
app.post("/login", (req, res) => {
  const { password } = req.body;
  if (password === APP_PASSWORD) {
    req.session.loggedIn = true;
    res.redirect("/");
  } else {
    res.send("<script>alert('Incorrect Password'); window.location='/login.html';</script>");
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});

// --- API Routes ---
app.get("/api/orders", checkAuth, (req, res) => {
  db.all("SELECT * FROM orders ORDER BY id DESC", [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.post("/api/orders", checkAuth, (req, res) => {
  const o = req.body;
  const stmt = db.prepare(`INSERT INTO orders 
    (po_no, po_date, client_name, product_details, qty, dispatch_status, invoice_no, invoice_date, invoice_amount, payment_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  stmt.run(
    o.po_no, o.po_date, o.client_name, o.product_details, o.qty,
    o.dispatch_status, o.invoice_no, o.invoice_date, o.invoice_amount, o.payment_status,
    function (err) {
      if (err) return res.status(400).json({ error: "Duplicate PO Number!" });
      res.json({ id: this.lastID });
    }
  );
});

app.put("/api/orders/:id", checkAuth, (req, res) => {
  const o = req.body;
  const id = req.params.id;

  db.run(
    `UPDATE orders SET 
    po_no=?, po_date=?, client_name=?, product_details=?, qty=?, 
    dispatch_status=?, invoice_no=?, invoice_date=?, invoice_amount=?, payment_status=? 
    WHERE id=?`,
    [o.po_no, o.po_date, o.client_name, o.product_details, o.qty, o.dispatch_status,
      o.invoice_no, o.invoice_date, o.invoice_amount, o.payment_status, id],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });
      res.json({ updated: this.changes });
    }
  );
});

app.delete("/api/orders/:id", checkAuth, (req, res) => {
  const id = req.params.id;
  db.run("DELETE FROM orders WHERE id=?", [id], function (err) {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

// --- Dashboard ---
app.get("/", checkAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --- Start Server ---
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

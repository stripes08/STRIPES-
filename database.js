// database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'orders.db');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_no TEXT UNIQUE,
      po_date TEXT,
      client_name TEXT,
      product_details TEXT,
      qty INTEGER,
      dispatch_status TEXT,
      invoice_no TEXT,
      invoice_date TEXT,
      invoice_amount TEXT,
      payment_status TEXT,
      payment_date TEXT
    )
  `);
});

module.exports = db;

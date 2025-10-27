
const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const multer = require('multer');
const csvParser = require('csv-parser');
const { Parser } = require('json2csv');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const DB = path.join(__dirname, 'orders.db');
const db = new sqlite3.Database(DB, (err) => {
  if (err) console.error('DB open error', err);
  else console.log('Connected to orders.db');
});

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
    payment_status TEXT,
    delivered_items TEXT,
    undelivered_items TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
});

function runAsync(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err){
      if (err) reject(err); else resolve(this);
    });
  });
}
function allAsync(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows); });
  });
}
function getAsync(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row); });
  });
}

// Routes
app.get('/api/orders', async (req, res) => {
  try {
    const q = req.query.q;
    if (q) {
      const like = '%' + q.toLowerCase() + '%';
      const rows = await allAsync('SELECT * FROM orders WHERE LOWER(po_no) LIKE ? OR LOWER(client_name) LIKE ? OR LOWER(product_details) LIKE ? ORDER BY id DESC', [like, like, like]);
      return res.json(rows);
    }
    const rows = await allAsync('SELECT * FROM orders ORDER BY id DESC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const row = await getAsync('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/orders', async (req, res) => {
  try {
    const b = req.body;
    if (!b.po_no) return res.status(400).json({ error: 'PO required' });
    const existing = await getAsync('SELECT id FROM orders WHERE LOWER(po_no)=LOWER(?)', [b.po_no]);
    if (existing) return res.status(409).json({ error: 'PO exists' });
    const info = await runAsync(`INSERT INTO orders (po_no,po_date,client_name,product_details,qty,dispatch_status,invoice_no,invoice_date,invoice_amount,payment_status,delivered_items,undelivered_items) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [
      b.po_no, b.po_date||'', b.client_name||'', b.product_details||'', Number(b.qty)||0, b.dispatch_status||'Pending', b.invoice_no||'', b.invoice_date||'', Number(b.invoice_amount)||0, b.payment_status||'', b.delivered_items||'', b.undelivered_items||''
    ]);
    const newRow = await getAsync('SELECT * FROM orders WHERE id = ?', [info.lastID]);
    res.json(newRow);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/orders/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const b = req.body;
    await runAsync('UPDATE orders SET po_no=?,po_date=?,client_name=?,product_details=?,qty=?,dispatch_status=?,invoice_no=?,invoice_date=?,invoice_amount=?,payment_status=?,delivered_items=?,undelivered_items=?,updated_at=datetime(\'now\',\'localtime\') WHERE id=?', [
      b.po_no, b.po_date||'', b.client_name||'', b.product_details||'', Number(b.qty)||0, b.dispatch_status||'Pending', b.invoice_no||'', b.invoice_date||'', Number(b.invoice_amount)||0, b.payment_status||'', b.delivered_items||'', b.undelivered_items||'', id
    ]);
    const updated = await getAsync('SELECT * FROM orders WHERE id = ?', [id]);
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/orders/:id', async (req, res) => {
  try {
    const info = await runAsync('DELETE FROM orders WHERE id = ?', [req.params.id]);
    res.json({ deleted: info.changes });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// export
app.get('/api/export', async (req, res) => {
  try {
    const rows = await allAsync('SELECT * FROM orders ORDER BY id DESC');
    const fields = ['id','po_no','po_date','client_name','product_details','qty','dispatch_status','invoice_no','invoice_date','invoice_amount','payment_status','delivered_items','undelivered_items','created_at','updated_at'];
    const parser = new Parser({ fields });
    const csv = parser.parse(rows);
    res.setHeader('Content-Disposition','attachment; filename=orders.csv');
    res.setHeader('Content-Type','text/csv');
    res.send(csv);
  } catch (e) { res.status(500).send(e.message); }
});

// import
const upload = multer({ dest: 'uploads/' });
app.post('/api/import', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const filePath = req.file.path;
  const rows = [];
  fs.createReadStream(filePath)
    .pipe(csvParser())
    .on('data', (data) => rows.push(data))
    .on('end', async () => {
      try {
        const stmt = db.prepare(`INSERT OR IGNORE INTO orders (po_no,po_date,client_name,product_details,qty,dispatch_status,invoice_no,invoice_date,invoice_amount,payment_status,delivered_items,undelivered_items) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
        for (const r of rows) {
          const po_no = r.po_no || r.order_number || r['PO No'] || r['PO No.'] || r['Order Number'] || r['PO'];
          if (!po_no) continue;
          const qty = Number(r.qty || r.Qty || r.quantity || 0);
          stmt.run(po_no, r.po_date || r.order_date || '', r.client_name || r.company_name || '', r.product_details || r.order_remark || r['Product details'] || '', qty, r.dispatch_status || r.delivery_status || 'Pending', r.invoice_no || '', r.invoice_date || r.invoiceDate || '', Number(r.invoice_amount || 0), r.payment_status || '', r.delivered_items || '', r.undelivered_items || '');
        }
        stmt.finalize();
        fs.unlinkSync(filePath);
        res.json({ imported: rows.length });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname,'public','index.html'));
});

app.listen(PORT, () => console.log('Server running on port', PORT));

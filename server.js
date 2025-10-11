
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { Parser } = require('json2csv');
const multer = require('multer');
const csvParser = require('csv-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const APP_PASSWORD = process.env.APP_PASSWORD || 'stripes';
const SESSION_SECRET = process.env.SESSION_SECRET || 'a1b2c3d4e5f6g7h8';

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: SESSION_SECRET, resave: false, saveUninitialized: true }));
app.use(express.static(path.join(__dirname, 'public')));

const dbFile = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbFile);

// helpers
function toIsoDate(s) {
  if (!s) return null;
  s = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let d = m[1].padStart(2,'0');
    let mo = m[2].padStart(2,'0');
    let y = m[3];
    if (y.length===2) y = '20'+y;
    return `${y}-${mo}-${d}`;
  }
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    const y = dt.getFullYear();
    const mo = String(dt.getMonth()+1).padStart(2,'0');
    const d = String(dt.getDate()).padStart(2,'0');
    return `${y}-${mo}-${d}`;
  }
  return null;
}

// auth
app.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === APP_PASSWORD) {
    req.session.loggedIn = true;
    return res.json({ success: true });
  }
  return res.json({ success: false });
});
function apiAuth(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  return res.status(401).json({ error: 'unauthenticated' });
}

// API: list orders with items
app.get('/api/orders', apiAuth, (req, res) => {
  const sortBy = req.query.sortBy || 'id';
  const order = (req.query.order && req.query.order.toUpperCase()==='DESC') ? 'DESC' : 'ASC';
  db.all(`SELECT * FROM orders ORDER BY ${sortBy} ${order}`, [], (err, orders) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!orders.length) return res.json([]);
    const placeholders = orders.map(()=>'?').join(',');
    const orderIds = orders.map(o=>o.id);
    db.all(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`, orderIds, (err2, items) => {
      if (err2) return res.status(500).json({ error: err2.message });
      const byOrder = {};
      items.forEach(it => {
        byOrder[it.order_id] = byOrder[it.order_id] || [];
        byOrder[it.order_id].push(it);
      });
      const out = orders.map(o => {
        return Object.assign({}, o, { items: byOrder[o.id] || [] });
      });
      res.json(out);
    });
  });
});

// API: create order with items
app.post('/api/orders', apiAuth, (req, res) => {
  const body = req.body || {};
  const po_date = toIsoDate(body.po_date);
  const invoice_date = toIsoDate(body.invoice_date);
  const payment_date = toIsoDate(body.payment_date);
  const qty_total = body.items ? body.items.reduce((s,i)=>s + Number(i.qty||0),0) : (body.qty_total||0);
  const stmt = db.prepare(`INSERT INTO orders (sr_no,po_no,po_date,client_name,qty_total,dispatch_status,invoice_no,invoice_date,invoice_amount,payment_status,payment_date) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  stmt.run(body.sr_no||null, body.po_no||null, po_date, body.client_name||null, qty_total, body.dispatch_status||null, body.invoice_no||null, invoice_date, body.invoice_amount||null, body.payment_status||null, payment_date, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    const orderId = this.lastID;
    if (Array.isArray(body.items) && body.items.length) {
      const insertItem = db.prepare(`INSERT INTO order_items (order_id,product_name,qty,unit_price,total_price,remarks) VALUES (?,?,?,?,?,?)`);
      body.items.forEach(it => {
        insertItem.run(orderId, it.product_name||null, it.qty||0, it.unit_price||null, it.total_price||null, it.remarks||null);
      });
      insertItem.finalize(() => res.json({ id: orderId }));
    } else {
      res.json({ id: orderId });
    }
  });
});

// API: update order (replace items)
app.put('/api/orders/:id', apiAuth, (req, res) => {
  const id = req.params.id;
  const body = req.body || {};
  const po_date = toIsoDate(body.po_date);
  const invoice_date = toIsoDate(body.invoice_date);
  const payment_date = toIsoDate(body.payment_date);
  const qty_total = Array.isArray(body.items) ? body.items.reduce((s,i)=>s + Number(i.qty||0),0) : (body.qty_total||0);
  db.run(`UPDATE orders SET sr_no=?, po_no=?, po_date=?, client_name=?, qty_total=?, dispatch_status=?, invoice_no=?, invoice_date=?, invoice_amount=?, payment_status=?, payment_date=? WHERE id=?`,
    [body.sr_no||null, body.po_no||null, po_date, body.client_name||null, qty_total, body.dispatch_status||null, body.invoice_no||null, invoice_date, body.invoice_amount||null, body.payment_status||null, payment_date, id],
    function(err){
      if (err) return res.status(500).json({ error: err.message });
      db.run(`DELETE FROM order_items WHERE order_id=?`, [id], function(err2){
        if (err2) return res.status(500).json({ error: err2.message });
        if (Array.isArray(body.items) && body.items.length) {
          const insertItem = db.prepare(`INSERT INTO order_items (order_id,product_name,qty,unit_price,total_price,remarks) VALUES (?,?,?,?,?,?)`);
          body.items.forEach(it => {
            insertItem.run(id, it.product_name||null, it.qty||0, it.unit_price||null, it.total_price||null, it.remarks||null);
          });
          insertItem.finalize(() => res.json({ updated: true }));
        } else res.json({ updated: true });
      });
    });
});

// API: delete order
app.delete('/api/orders/:id', apiAuth, (req, res) => {
  const id = req.params.id;
  db.run(`DELETE FROM order_items WHERE order_id=?`, [id], function(err){
    if (err) return res.status(500).json({ error: err.message });
    db.run(`DELETE FROM orders WHERE id=?`, [id], function(err2){
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ deleted: true });
    });
  });
});

// Export CSV (flatten items into product_details column)
app.get('/api/export-csv', apiAuth, (req, res) => {
  db.all(`SELECT o.*, GROUP_CONCAT(oi.product_name || ' x' || oi.qty, '; ') as product_details
    FROM orders o LEFT JOIN order_items oi ON o.id = oi.order_id
    GROUP BY o.id ORDER BY o.sr_no ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const fields = ['sr_no','po_no','po_date','client_name','product_details','qty_total','dispatch_status','invoice_no','invoice_date','invoice_amount','payment_status','payment_date'];
    const parser = new Parser({ fields });
    const csv = parser.parse(rows);
    res.setHeader('Content-Disposition', 'attachment; filename="orders-export.csv"');
    res.setHeader('Content-Type', 'text/csv');
    res.send(csv);
  });
});

# continue file

const upload = multer({ dest: 'uploads/' });
app.post('/api/import-csv', apiAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csvParser())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      fs.unlinkSync(req.file.path);
      db.serialize(() => {
        const insertOrder = db.prepare(`INSERT INTO orders (sr_no,po_no,po_date,client_name,qty_total,dispatch_status,invoice_no,invoice_date,invoice_amount,payment_status,payment_date) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
        const insertItem = db.prepare(`INSERT INTO order_items (order_id,product_name,qty) VALUES (?,?,?)`);
        results.forEach(r => {
          const po_date = toIsoDate(r.po_date);
          const invoice_date = toIsoDate(r.invoice_date);
          const payment_date = toIsoDate(r.payment_date);
          const qty_total = r.qty_total || r.qty || null;
          insertOrder.run(r.sr_no||null, r.po_no||null, po_date, r.client_name||null, qty_total, r.dispatch_status||null, r.invoice_no||null, invoice_date, r.invoice_amount||null, r.payment_status||null, payment_date, function(err){
            const orderId = this.lastID;
            const pd = r.product_details || '';
            const parts = pd.split(';').map(s=>s.trim()).filter(Boolean);
            parts.forEach(p => {
              const m = p.match(/^(.*) x(\d+)$/);
              if (m) insertItem.run(orderId, m[1].trim(), Number(m[2]));
              else insertItem.run(orderId, p, null);
            });
          });
        });
        insertItem.finalize();
        insertOrder.finalize();
        res.json({ imported: results.length });
      });
    });
});

app.get('/api/summary', apiAuth, (req, res) => {
  db.get(`SELECT COUNT(*) as total, SUM(CASE WHEN payment_status LIKE '%Received%' THEN 1 ELSE 0 END) as received, SUM(CASE WHEN payment_status LIKE '%Pending%' THEN 1 ELSE 0 END) as pending FROM orders`, [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row);
  });
});

app.post('/logout', (req, res) => {
  req.session.destroy(()=>res.json({ok:true}));
});

app.listen(PORT, ()=>console.log('Server listening on', PORT));

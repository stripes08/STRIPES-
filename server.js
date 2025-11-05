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
const UPLOAD_DIR = path.join(__dirname, 'uploads','pdfs');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// DB
const DB = path.join(__dirname, 'orders.db');
const db = new sqlite3.Database(DB, (err) => {
  if (err) console.error('DB open error', err);
  else console.log('Connected to orders.db');
});

// create table and add sample if empty
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
    bill_path TEXT,
    po_path TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )`, [], function(err){
    if(err) console.error('create table error', err);
    else {
      db.get('SELECT COUNT(*) as c FROM orders', (err, row) => {
        if(!err && row && row.c === 0) {
          const sample = [
            ['MK-A01','2025-09-01','Taj Hotels, New Delhi','LEATHERITE I POD CASE x30',30,'Delivered','INV-2001','2025-09-05',25500,'Received','LEATHERITE I POD CASE x30','','uploads/pdfs/stripes_MK-A01_bill.pdf',''],
            ['MK-A02','2025-09-03','The Oberoi, New Delhi','Glass Jar x3; Mirror x1',4,'Pending','INV-2002','2025-09-07',8900,'Pending','','','',''],
            ['MK-A03','2025-09-05','ITC Maurya','Bone Tray x5',5,'Delivered','INV-2003','2025-09-09',7200,'Received','Bone Tray x5','','',''],
            ['MK-A04','2025-09-07','Leela Palace','Soap Set x2; Tissue Box x1',3,'Pending','INV-2004','2025-09-12',6800,'Pending','','','',''],
            ['MK-A05','2025-09-10','Trident','Candle Stand x3',3,'Partial','INV-2005','2025-09-13',9200,'Pending','Candle Stand x1','Candle Stand x2','','uploads/pdfs/stripes_MK-A05_po.pdf']
          ];
          const stmt = db.prepare(`INSERT OR IGNORE INTO orders (po_no,po_date,client_name,product_details,qty,dispatch_status,invoice_no,invoice_date,invoice_amount,payment_status,delivered_items,undelivered_items,bill_path,po_path) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
          sample.forEach(s => stmt.run(s));
          stmt.finalize();
          console.log('Inserted sample rows');
        }
      });
    }
  });
});

// helpers
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

// multer for pdfs
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const type = file.fieldname;
    const po = (req.body.po_no || req.params.po_no || 'unknown').replace(/\s+/g,'_');
    const ts = new Date().toISOString().replace(/[:.]/g,'-');
    const safe = `stripes_${po}_${type}_${ts}${ext}`;
    cb(null, safe);
  }
});
const upload = multer({ storage: storage, fileFilter: (req,file,cb)=>{
  if(file.mimetype !== 'application/pdf') return cb(new Error('Only PDF allowed'));
  cb(null,true);
}, limits: { fileSize: 10 * 1024 * 1024 } });

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

app.post('/api/orders', upload.fields([{name:'billFile'},{name:'poFile'}]), async (req, res) => {
  try {
    const b = req.body;
    if (!b.po_no) return res.status(400).json({ error: 'PO required' });
    const existing = await getAsync('SELECT id FROM orders WHERE LOWER(po_no)=LOWER(?)', [b.po_no]);
    if (existing) return res.status(409).json({ error: 'PO exists' });
    const billPath = req.files && req.files.billFile ? path.join('uploads','pdfs', req.files.billFile[0].filename) : '';
    const poPath = req.files && req.files.poFile ? path.join('uploads','pdfs', req.files.poFile[0].filename) : '';
    const info = await runAsync(`INSERT INTO orders (po_no,po_date,client_name,product_details,qty,dispatch_status,invoice_no,invoice_date,invoice_amount,payment_status,delivered_items,undelivered_items,bill_path,po_path) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      b.po_no, b.po_date||'', b.client_name||'', b.product_details||'', Number(b.qty)||0, b.dispatch_status||'Pending', b.invoice_no||'', b.invoice_date||'', Number(b.invoice_amount)||0, b.payment_status||'', b.delivered_items||'', b.undelivered_items||'', billPath, poPath
    ]);
    const newRow = await getAsync('SELECT * FROM orders WHERE id = ?', [info.lastID]);
    res.json(newRow);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/orders/:id', upload.fields([{name:'billFile'},{name:'poFile'}]), async (req, res) => {
  try {
    const id = req.params.id;
    const b = req.body;
    const row = await getAsync('SELECT * FROM orders WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    let billPath = row.bill_path || '';
    let poPath = row.po_path || '';
    if (req.files && req.files.billFile) {
      if (billPath) { try { fs.unlinkSync(path.join(__dirname,billPath)); } catch(e){} }
      billPath = path.join('uploads','pdfs', req.files.billFile[0].filename);
    }
    if (req.files && req.files.poFile) {
      if (poPath) { try { fs.unlinkSync(path.join(__dirname,poPath)); } catch(e){} }
      poPath = path.join('uploads','pdfs', req.files.poFile[0].filename);
    }
    await runAsync('UPDATE orders SET po_no=?,po_date=?,client_name=?,product_details=?,qty=?,dispatch_status=?,invoice_no=?,invoice_date=?,invoice_amount=?,payment_status=?,delivered_items=?,undelivered_items=?,bill_path=?,po_path=?,updated_at=datetime(\'now\',\'localtime\') WHERE id=?', [
      b.po_no, b.po_date||'', b.client_name||'', b.product_details||'', Number(b.qty)||0, b.dispatch_status||'Pending', b.invoice_no||'', b.invoice_date||'', Number(b.invoice_amount)||0, b.payment_status||'', b.delivered_items||'', b.undelivered_items||'', billPath, poPath, id
    ]);
    const updated = await getAsync('SELECT * FROM orders WHERE id = ?', [id]);
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/orders/:id', async (req, res) => {
  try {
    const row = await getAsync('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (row.bill_path) { try { fs.unlinkSync(path.join(__dirname,row.bill_path)); } catch(e){} }
    if (row.po_path) { try { fs.unlinkSync(path.join(__dirname,row.po_path)); } catch(e){} }
    const info = await runAsync('DELETE FROM orders WHERE id = ?', [req.params.id]);
    res.json({ deleted: info.changes });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/export', async (req, res) => {
  try {
    const rows = await allAsync('SELECT * FROM orders ORDER BY id DESC');
    const fields = ['id','po_no','po_date','client_name','product_details','qty','dispatch_status','invoice_no','invoice_date','invoice_amount','payment_status','delivered_items','undelivered_items','bill_path','po_path','created_at','updated_at'];
    const parser = new Parser({ fields });
    const csv = parser.parse(rows);
    res.setHeader('Content-Disposition','attachment; filename=orders.csv');
    res.setHeader('Content-Type','text/csv');
    res.send(csv);
  } catch (e) { res.status(500).send(e.message); }
});

app.post('/api/import', (req, res) => {
  const uploadSingle = multer({ dest: 'uploads/tmp' }).single('file');
  uploadSingle(req, res, function(err) {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const rows = [];
    fs.createReadStream(req.file.path)
      .pipe(csvParser())
      .on('data', (data) => rows.push(data))
      .on('end', async () => {
        try {
          const stmt = db.prepare(`INSERT OR IGNORE INTO orders (po_no,po_date,client_name,product_details,qty,dispatch_status,invoice_no,invoice_date,invoice_amount,payment_status,delivered_items,undelivered_items) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
          for (const r of rows) {
            const po_no = r.po_no || r.Order || r['PO No'] || r['PO No.'] || r['Order Number'] || r['PO'];
            if (!po_no) continue;
            const qty = Number(r.qty || r.Qty || r.quantity || 0);
            stmt.run(po_no, r.po_date || r.order_date || '', r.client_name || r.company_name || '', r.product_details || r.order_remark || r['Product details'] || '', qty, r.dispatch_status || r.delivery_status || 'Pending', r.invoice_no || '', r.invoice_date || r.invoiceDate || '', Number(r.invoice_amount || 0), r.payment_status || '', r.delivered_items || '', r.undelivered_items || '');
          }
          stmt.finalize();
          try{ fs.unlinkSync(req.file.path); } catch(e){}
          res.json({ imported: rows.length });
        } catch (e) {
          res.status(500).json({ error: e.message });
        }
      });
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname,'public','index.html'));
});
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('Server running on port', PORT));

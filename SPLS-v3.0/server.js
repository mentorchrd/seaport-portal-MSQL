const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const bcrypt = require("bcrypt");
const db = require("./db");

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
// Serve db folder so client-side scripts can fetch CSV files under /db
app.use('/db', express.static(path.join(__dirname, 'db')));

// API endpoints to read tables from MySQL (fallback to CSV removed on server-side)
const allowedTables = new Set([
  'VM_berth_master',
  'VM_berth_hire',
  'VM_port_dues',
  'VM_Pilotage_Master_with_Category',
  'CM_CargoMaster',
  'VM_currency_lookup'
]);


// Dedicated endpoint for CM_CargoMaster from MySQL
app.get('/api/mysql/cargomaster', (req, res) => {
  db.query('SELECT * FROM cm_cargomaster', (err, results) => {
    if (err) {
      console.error('DB error', err);
      return res.status(500).json({ error: 'db error' });
    }
    res.json(results);
  });
});

// Endpoint to get cargo descriptions for dropdown
app.get('/api/mysql/cargo-descriptions', (req, res) => {
  db.query('SELECT DISTINCT CargoDescription, CargoCategoryName FROM cm_cargomaster WHERE CargoDescription IS NOT NULL ORDER BY CargoDescription', (err, results) => {
    if (err) {
      console.error('DB error', err);
      return res.status(500).json({ error: 'db error' });
    }
    res.json(results);
  });
});

// Endpoint to get cargo details by description
app.get('/api/mysql/cargo-details/:description', (req, res) => {
  const desc = req.params.description;
  db.query('SELECT * FROM cm_cargomaster WHERE CargoDescription = ? LIMIT 1', [desc], (err, results) => {
    if (err) {
      console.error('DB error', err);
      return res.status(500).json({ error: 'db error' });
    }
    res.json(results.length > 0 ? results[0] : null);
  });
});

// Endpoint to get wharfage rates by SoRNoCode
app.get('/api/mysql/wharfage', (req, res) => {
  const sorCode = req.query.sor;
  if (!sorCode) {
    return res.status(400).json({ error: 'missing sor query parameter' });
  }
  db.query('SELECT * FROM cm_wharfage_master WHERE sor_item = ? LIMIT 1', [sorCode], (err, results) => {
    if (err) {
      console.error('DB error', err);
      return res.status(500).json({ error: 'db error' });
    }
    res.json(results.length > 0 ? results[0] : null);
  });
});

app.get('/api/:table', (req, res) => {
  const table = req.params.table;
  if (!allowedTables.has(table)) return res.status(404).json({ error: 'table not allowed' });
  // Simple select all — the client expects all rows (same columns as CSV)
  db.query(`SELECT * FROM ??`, [table], (err, results) => {
    if (err) {
      console.error('DB error', err);
      return res.status(500).json({ error: 'db error' });
    }
    res.json(results);
  });
});

app.post("/signup", async (req, res) => {
  const { firstName, lastName, mobile, email, company, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  const sql = `INSERT INTO users (first_name, last_name, mobile, email, company, password) VALUES (?, ?, ?, ?, ?, ?)`;

  db.query(sql, [firstName, lastName, mobile, email, company, hashed], (err) => {
    if (err) return res.status(500).json({ success: false, message: "Signup failed!" });
    res.json({ success: true });
  });
});

app.post("/login", (req, res) => {
  const { mobile, password } = req.body;
  db.query("SELECT * FROM users WHERE mobile = ?", [mobile], async (err, results) => {
    if (err || results.length === 0) return res.json({ success: false, message: "User not found" });
    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (match) {
      res.json({ success: true });
    } else {
      res.json({ success: false, message: "Incorrect password" });
    }
  });
});
// Logout Route
app.get('/logout', (req, res) => {
  // If you're using session, you can destroy it here:
  // req.session.destroy();

  res.redirect('/'); // Redirects back to index.html
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

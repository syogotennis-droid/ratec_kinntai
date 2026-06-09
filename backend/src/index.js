const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { db, initDb } = require('./database');
const { hashPassword } = require('./auth');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.join(__dirname, '..', 'data', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/work-records', require('./routes/workRecords'));
app.use('/api/payroll', require('./routes/payroll'));
app.use('/api/closing', require('./routes/closing'));
app.use('/api/export', require('./routes/export'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/bonuses', require('./routes/bonuses'));

const distDir = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  app.get('/', (req, res) => res.json({ message: '勤怠・給与計算システム API', status: 'running' }));
}

async function main() {
  await initDb();

  // Create default admin
  const existing = db.prepare("SELECT id FROM users WHERE employee_id='admin'").get();
  if (!existing) {
    db.prepare(`INSERT INTO users (employee_id,name,name_kana,email,hashed_password,department,employment_type,is_admin) VALUES ('admin','管理者','カンリシャ','admin@example.com',?,'管理部','monthly',1)`)
      .run(hashPassword('admin1234'));
    console.log('デフォルト管理者を作成しました (admin / admin1234)');
  }

  app.listen(PORT, () => {
    console.log(`サーバー起動: http://localhost:${PORT}`);
  });
}

main().catch(err => { console.error('起動エラー:', err); process.exit(1); });

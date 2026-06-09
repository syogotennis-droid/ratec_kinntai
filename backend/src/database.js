'use strict';

const initSqlJs = require('sql.js/dist/sql-asm.js');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'attendance.db');

let rawDb = null;

function save() {
  if (rawDb) fs.writeFileSync(dbPath, Buffer.from(rawDb.export()));
}

function toObjects(result) {
  if (!result || !result.length) return [];
  const { columns, values } = result[0];
  return values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
}

function resolveParams(sql, args) {
  if (args.length === 1 && args[0] !== null && typeof args[0] === 'object' && !Array.isArray(args[0])) {
    const obj = args[0];
    const values = [];
    const resolved = sql.replace(/@(\w+)/g, (_, k) => { values.push(obj[k] ?? null); return '?'; });
    return { sql: resolved, values };
  }
  return { sql, values: args.flat() };
}

const db = {
  prepare(sql) {
    return {
      run(...args) {
        const { sql: s, values } = resolveParams(sql, args);
        rawDb.run(s, values);
        const changes = toObjects(rawDb.exec('SELECT changes()'))[0]?.['changes()'] ?? 0;
        const lastInsertRowid = toObjects(rawDb.exec('SELECT last_insert_rowid()'))[0]?.['last_insert_rowid()'] ?? 0;
        save();
        return { changes, lastInsertRowid };
      },
      get(...args) {
        const { sql: s, values } = resolveParams(sql, args);
        return toObjects(rawDb.exec(s, values))[0] ?? undefined;
      },
      all(...args) {
        const { sql: s, values } = resolveParams(sql, args);
        return toObjects(rawDb.exec(s, values));
      },
    };
  },

  exec(sql) {
    rawDb.exec(sql);
    save();
  },

  transaction(fn) {
    return (...args) => {
      rawDb.run('BEGIN');
      try {
        const result = fn(...args);
        rawDb.run('COMMIT');
        save();
        return result;
      } catch (e) {
        rawDb.run('ROLLBACK');
        throw e;
      }
    };
  },
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_kana TEXT,
  email TEXT UNIQUE NOT NULL,
  hashed_password TEXT NOT NULL,
  department TEXT,
  employment_type TEXT DEFAULT 'hourly',
  hourly_wage REAL DEFAULT 0,
  daily_wage REAL DEFAULT 0,
  transportation REAL DEFAULT 0,
  fixed_allowance REAL DEFAULT 0,
  overtime_rate REAL DEFAULT 1.25,
  late_night_rate REAL DEFAULT 1.25,
  holiday_rate REAL DEFAULT 1.35,
  is_admin INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS work_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  work_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  break_minutes INTEGER DEFAULT 0,
  actual_minutes INTEGER,
  work_type TEXT DEFAULT 'normal',
  notes TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS monthly_closings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year_month TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  status TEXT DEFAULT 'open',
  closed_at TEXT,
  closed_by INTEGER,
  UNIQUE(year_month, user_id)
);
CREATE TABLE IF NOT EXISTS payroll_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year_month TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  regular_hours REAL DEFAULT 0,
  overtime_hours REAL DEFAULT 0,
  late_night_hours REAL DEFAULT 0,
  holiday_hours REAL DEFAULT 0,
  total_hours REAL DEFAULT 0,
  base_salary REAL DEFAULT 0,
  overtime_pay REAL DEFAULT 0,
  late_night_pay REAL DEFAULT 0,
  holiday_pay REAL DEFAULT 0,
  transportation REAL DEFAULT 0,
  allowances REAL DEFAULT 0,
  deductions REAL DEFAULT 0,
  gross_pay REAL DEFAULT 0,
  additional_notes TEXT,
  status TEXT DEFAULT 'calculated',
  confirmed_at TEXT,
  confirmed_by INTEGER,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime')),
  UNIQUE(year_month, user_id)
);
CREATE TABLE IF NOT EXISTS sales_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  record_date TEXT NOT NULL,
  sales_amount REAL DEFAULT 0,
  material_cost REAL DEFAULT 0,
  notes TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS sales_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sales_record_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  original_name TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS bonuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  year_month TEXT NOT NULL,
  bonus_amount REAL DEFAULT 0,
  notes TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime')),
  UNIQUE(user_id, year_month)
);
`;

async function initDb() {
  const SQL = await initSqlJs();
  rawDb = fs.existsSync(dbPath)
    ? new SQL.Database(fs.readFileSync(dbPath))
    : new SQL.Database();
  rawDb.exec(SCHEMA);
  save();

  // Migration: remove UNIQUE(user_id, record_date) from sales_records
  try {
    const res = rawDb.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='sales_records'");
    if (res.length > 0 && res[0].values.length > 0) {
      const tableSql = res[0].values[0][0] || '';
      if (tableSql.includes('UNIQUE(user_id, record_date)')) {
        rawDb.run('ALTER TABLE sales_records RENAME TO _sales_records_bak');
        rawDb.run(`CREATE TABLE sales_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          record_date TEXT NOT NULL,
          sales_amount REAL DEFAULT 0,
          material_cost REAL DEFAULT 0,
          notes TEXT,
          created_by INTEGER,
          created_at TEXT DEFAULT (datetime('now','localtime')),
          updated_at TEXT DEFAULT (datetime('now','localtime'))
        )`);
        rawDb.run('INSERT INTO sales_records SELECT id,user_id,record_date,sales_amount,material_cost,notes,created_by,created_at,updated_at FROM _sales_records_bak');
        rawDb.run('DROP TABLE _sales_records_bak');
        save();
        console.log('DB migration: sales_records の UNIQUE制約を削除しました');
      }
    }
  } catch (e) {
    console.error('DB migration エラー:', e.message);
  }

  return db;
}

module.exports = { db, initDb };

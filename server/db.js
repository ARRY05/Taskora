// ============================================================
// db.js – Database setup using sql.js (pure JavaScript SQLite)
// No native compilation required — works on all platforms.
// The DB is stored in memory and persisted to disk via fs.
// ============================================================

const fs      = require('fs');
const path    = require('path');
const bcrypt  = require('bcryptjs');
const initSqlJs = require('sql.js');

const DB_PATH = path.join(__dirname, '..', 'taskora.db');

// We export a promise that resolves to the db wrapper object.
// All route files will await this before using the db.
let dbInstance = null;

// ── Thin wrapper to mimic synchronous-style API ───────────
// sql.js is synchronous internally, so we just wrap it neatly.
function makeDb(SQL) {
  // Load existing DB file from disk, or create a new one
  let db;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Save DB to disk after every write
  function persist() {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }

  // Execute a SQL string (DDL / multi-statement)
  function exec(sql) {
    db.run(sql);
    persist();
  }

  // Run a single statement (INSERT / UPDATE / DELETE)
  // Returns { lastInsertRowid, changes }
  function run(sql, params = []) {
    db.run(sql, params);
    const rowid = db.exec('SELECT last_insert_rowid() as id')[0]?.values[0][0] || 0;
    persist();
    return { lastInsertRowid: rowid };
  }

  // Get a single row as a plain object (SELECT ... LIMIT 1)
  function get(sql, params = []) {
    const result = db.exec(sql, params);
    if (!result.length || !result[0].values.length) return undefined;
    const cols = result[0].columns;
    const vals = result[0].values[0];
    return Object.fromEntries(cols.map((c, i) => [c, vals[i]]));
  }

  // Get all rows as an array of plain objects
  function all(sql, params = []) {
    const result = db.exec(sql, params);
    if (!result.length) return [];
    const cols = result[0].columns;
    return result[0].values.map(row =>
      Object.fromEntries(cols.map((c, i) => [c, row[i]]))
    );
  }

  // Prepare returns an object with run/get/all bound to a sql string
  function prepare(sql) {
    return {
      run:  (...args) => run(sql, args.flat()),
      get:  (...args) => get(sql, args.flat()),
      all:  (...args) => all(sql, args.flat()),
    };
  }

  return { exec, run, prepare, get, all, persist };
}

// ── Initialise and seed ───────────────────────────────────
async function initDb() {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();
  const db  = makeDb(SQL);

  // ── Create Tables ───────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      email      TEXT    NOT NULL UNIQUE,
      password   TEXT    NOT NULL,
      created_at TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      description TEXT,
      created_by  INTEGER NOT NULL,
      created_at  TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      user_id    INTEGER NOT NULL,
      role       TEXT    DEFAULT 'Member',
      joined_at  TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      UNIQUE(project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id  INTEGER NOT NULL,
      title       TEXT    NOT NULL,
      description TEXT,
      priority    TEXT    DEFAULT 'MEDIUM' CHECK(priority IN ('LOW', 'MEDIUM', 'HIGH')),
      status      TEXT    DEFAULT 'TODO' CHECK(status IN ('TODO', 'IN_PROGRESS', 'DONE')),
      due_date    TEXT,
      assigned_to INTEGER,
      created_by  INTEGER NOT NULL,
      created_at  TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );
  `);

  const taskColumns = db.all('PRAGMA table_info(tasks)').map(col => col.name);
  if (!taskColumns.includes('created_by')) {
    db.exec('ALTER TABLE tasks ADD COLUMN created_by INTEGER');
    db.run('UPDATE tasks SET created_by = COALESCE(assigned_to, 1) WHERE created_by IS NULL');
  }

  db.exec(`
    UPDATE users
    SET email = REPLACE(email, '@' || 'task' || 'flow.in', '@taskora.app')
    WHERE email LIKE '%@' || 'task' || 'flow.in';

    UPDATE tasks SET status = CASE status
      WHEN 'To Do' THEN 'TODO'
      WHEN 'In Progress' THEN 'IN_PROGRESS'
      WHEN 'Done' THEN 'DONE'
      ELSE status
    END;

    UPDATE tasks SET priority = CASE priority
      WHEN 'Low' THEN 'LOW'
      WHEN 'Medium' THEN 'MEDIUM'
      WHEN 'High' THEN 'HIGH'
      ELSE priority
    END;
  `);

  // ── Seed Dummy Data (only if empty) ────────────────────
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;

  if (userCount === 0) {
    console.log('Seeding database with dummy Indian data...');
    const hash = (p) => bcrypt.hashSync(p, 10);
    const PWD  = 'Password@123';

    const u1 = db.prepare('INSERT INTO users (name,email,password) VALUES (?,?,?)').run('Arjun Sharma', 'arjun@taskora.app', hash(PWD)).lastInsertRowid;
    const u2 = db.prepare('INSERT INTO users (name,email,password) VALUES (?,?,?)').run('Priya Patel',  'priya@taskora.app', hash(PWD)).lastInsertRowid;
    const u3 = db.prepare('INSERT INTO users (name,email,password) VALUES (?,?,?)').run('Rahul Verma',  'rahul@taskora.app', hash(PWD)).lastInsertRowid;
    const u4 = db.prepare('INSERT INTO users (name,email,password) VALUES (?,?,?)').run('Sneha Iyer',   'sneha@taskora.app', hash(PWD)).lastInsertRowid;
    const u5 = db.prepare('INSERT INTO users (name,email,password) VALUES (?,?,?)').run('Kiran Mehta',  'kiran@taskora.app', hash(PWD)).lastInsertRowid;

    const p1 = db.prepare('INSERT INTO projects (name,description,created_by) VALUES (?,?,?)').run('E-Commerce Platform Redesign','Revamping the online shopping portal for better UX and performance.',u1).lastInsertRowid;
    const p2 = db.prepare('INSERT INTO projects (name,description,created_by) VALUES (?,?,?)').run('HR Management System','Internal portal for employee records, payroll, and leave management.',u2).lastInsertRowid;

    const am = db.prepare('INSERT INTO project_members (project_id,user_id,role) VALUES (?,?,?)');
    am.run(p1, u1, 'Admin');  am.run(p1, u2, 'Member'); am.run(p1, u3, 'Member');
    am.run(p2, u2, 'Admin');  am.run(p2, u4, 'Member'); am.run(p2, u5, 'Member');

    const it = db.prepare('INSERT INTO tasks (project_id,title,description,priority,status,due_date,assigned_to,created_by) VALUES (?,?,?,?,?,?,?,?)');
    it.run(p1,'Design new homepage wireframes',    'Create low-fi and hi-fi wireframes for the homepage.',    'HIGH',  'DONE',        '2026-04-30',u2,u1);
    it.run(p1,'Implement product listing page',    'Build responsive product grid with filters and sorting.', 'HIGH',  'IN_PROGRESS', '2026-05-20',u3,u1);
    it.run(p1,'Integrate Razorpay payment gateway','Set up Razorpay SDK for checkout flow.',                  'HIGH',  'TODO',        '2026-05-25',u2,u1);
    it.run(p1,'SEO optimisation for product pages','Add meta tags, structured data, and sitemap.',            'MEDIUM','TODO',        '2026-06-01',u3,u1);
    it.run(p1,'Performance audit and fixes',       'Analyse Lighthouse scores and fix critical issues.',      'LOW',   'TODO',        '2026-06-10',u2,u1);
    it.run(p2,'Employee onboarding module',        'Build form for new joiner details and document upload.',  'HIGH',  'IN_PROGRESS', '2026-05-18',u4,u2);
    it.run(p2,'Leave management workflow',         'Implement leave apply, approve, reject flow.',            'MEDIUM','TODO',        '2026-05-28',u5,u2);
    it.run(p2,'Generate monthly payslip PDF',      'Auto-generate payslip PDF and email to employees.',       'HIGH',  'TODO',        '2026-05-10',u4,u2);

    console.log('Seeded! Login: arjun@taskora.app / Password@123');
  }

  dbInstance = db;
  return db;
}

module.exports = { initDb };

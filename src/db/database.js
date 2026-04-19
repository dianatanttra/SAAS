const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../../saas.db'));

// Performance settings
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

// Store timestamps in IST (UTC+5:30)
process.env.TZ = 'Asia/Kolkata';

// Create all tables
db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    student_id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_sub TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    roll_number TEXT,
    uid TEXT,
    year TEXT,
    stream TEXT,
    division TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS requests (
    request_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    sport_name TEXT NOT NULL,
    event_name TEXT NOT NULL,
    reason TEXT NOT NULL,
    status_overall TEXT DEFAULT 'pending',
    status_token TEXT UNIQUE NOT NULL,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    FOREIGN KEY (student_id) REFERENCES students(student_id)
  );

  CREATE TABLE IF NOT EXISTS lecture_entries (
    entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    subject TEXT NOT NULL,
    course_code TEXT NOT NULL,
    lectures INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    remarks TEXT,
    reviewed_by INTEGER,
    reviewed_at DATETIME,
    FOREIGN KEY (request_id) REFERENCES requests(request_id),
    FOREIGN KEY (reviewed_by) REFERENCES admin_users(admin_id)
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    admin_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER NOT NULL,
    actor_name TEXT NOT NULL,
    action TEXT NOT NULL,
    entry_id INTEGER NOT NULL,
    previous_status TEXT,
    new_status TEXT,
    remarks TEXT,
    performed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT
  );
`);

console.log('Database ready');

module.exports = db;
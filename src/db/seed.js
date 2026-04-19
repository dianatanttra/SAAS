require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcrypt');
const db = require('./database');

const username = 'director';
const password = 'Admin@1234';
const fullName = 'Sports Director';

const existing = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);

if (existing) {
  console.log('Admin already exists, skipping.');
} else {
  const hash = bcrypt.hashSync(password, 12);
  db.prepare(`
    INSERT INTO admin_users (username, password_hash, full_name, email)
    VALUES (?, ?, ?, ?)
  `).run(username, hash, fullName, 'director@xaviers.edu.in');
  console.log('Admin created — username: director, password: Admin@1234');
  console.log('Change this password after first login!');
}
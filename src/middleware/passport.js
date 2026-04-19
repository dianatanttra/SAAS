const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../db/database');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
}, (accessToken, refreshToken, profile, done) => {
  const email = profile.emails[0].value;
  const allowedDomain = process.env.ALLOWED_DOMAIN;

  // Enforce @xaviers.edu.in
  if (!email.endsWith('@' + allowedDomain)) {
    return done(null, false, { message: 'Only @' + allowedDomain + ' accounts are allowed.' });
  }

  // Find or create student
  let student = db.prepare('SELECT * FROM students WHERE google_sub = ?').get(profile.id);

  if (!student) {
    db.prepare(`
      INSERT INTO students (google_sub, email, full_name)
      VALUES (?, ?, ?)
    `).run(profile.id, email, profile.displayName);
    student = db.prepare('SELECT * FROM students WHERE google_sub = ?').get(profile.id);
  } else {
    db.prepare('UPDATE students SET last_login_at = CURRENT_TIMESTAMP WHERE student_id = ?')
      .run(student.student_id);
  }

  return done(null, { type: 'student', ...student });
}));

passport.serializeUser((user, done) => {
  done(null, { type: user.type, id: user.type === 'student' ? user.student_id : user.admin_id });
});

passport.deserializeUser((obj, done) => {
  if (obj.type === 'student') {
    const student = db.prepare('SELECT * FROM students WHERE student_id = ?').get(obj.id);
    return done(null, student ? { type: 'student', ...student } : null);
  }
  if (obj.type === 'admin') {
    const admin = db.prepare('SELECT * FROM admin_users WHERE admin_id = ?').get(obj.id);
    return done(null, admin ? { type: 'admin', ...admin } : null);
  }
  done(null, null);
});

module.exports = passport;
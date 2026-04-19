const express = require('express');
const router = express.Router();
const passport = require('../middleware/passport');
const bcrypt = require('bcrypt');
const db = require('../db/database');
const { authLimiter } = require('../middleware/rateLimiter');

// ─── Google OAuth ─────────────────────────────────────────
router.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback',
  (req, res, next) => {
    passport.authenticate('google', (err, user, info) => {
      if (err) { console.error('OAuth error:', err); return next(err); }
      if (!user) { console.log('No user:', info); return res.redirect('/login?error=domain'); }
      req.login(user, (err) => {
        if (err) { console.error('Login error:', err); return next(err); }
        res.redirect('/submit');
      });
    })(req, res, next);
  }
);

router.get('/auth/check', (req, res) => {
  if (req.isAuthenticated()) return res.json({ ok: true });
  res.status(401).json({ ok: false });
});

// ─── Student login page ───────────────────────────────────
router.get('/login', (req, res) => {
  const error = req.query.error === 'domain'
    ? 'Only @xaviers.edu.in accounts are allowed.'
    : null;
  res.render('student/login', { error });
});

router.get('/logout', (req, res) => {
  req.logout(() => res.redirect('/login'));
});

// ─── Admin login ──────────────────────────────────────────
router.get('/admin/login', (req, res) => {
  if (req.isAuthenticated() && req.user.type === 'admin') return res.redirect('/admin');
  res.render('admin/login', { error: null });
});

router.post('/admin/login', authLimiter, (req, res) => {
  const { username, password } = req.body;
  const admin = db.prepare('SELECT * FROM admin_users WHERE username = ? AND is_active = 1').get(username);

  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.render('admin/login', { error: 'Invalid username or password.' });
  }

  db.prepare('UPDATE admin_users SET last_login_at = CURRENT_TIMESTAMP WHERE admin_id = ?')
    .run(admin.admin_id);

  req.login({ type: 'admin', ...admin }, (err) => {
    if (err) return res.render('admin/login', { error: 'Login failed. Try again.' });
    res.redirect('/admin');
  });
});

router.get('/admin/logout', (req, res) => {
  req.logout(() => res.redirect('/admin/login'));
});

module.exports = router;
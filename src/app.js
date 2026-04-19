process.env.TZ = 'Asia/Kolkata';

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const ConnectSQLite = require('connect-sqlite3')(session);
const helmet = require('helmet');
const path = require('path');
const logger = require('./middleware/logger');
const app = express();
/**
//temporary to fix unorthorized error
console.log('CLIENT ID:', process.env.GOOGLE_CLIENT_ID);
console.log('CLIENT SECRET length:', process.env.GOOGLE_CLIENT_SECRET?.length);

app.use((req, res, next) => {
  console.log(req.method, req.path, req.isAuthenticated ? req.isAuthenticated() : 'no auth');
  next();
});


**/

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

// Parse form data and JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static files (CSS, JS)
app.use(express.static(path.join(__dirname, '../public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Sessions
app.use(session({
  store: new ConnectSQLite({ db: 'sessions.db', dir: '.' }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000 // 8 hours
  }
}));

const passport = require('./middleware/passport');
app.use(passport.initialize());
app.use(passport.session());

// Routes (we'll fill these in next)
app.use('/', require('./routes/auth'));
app.use('/admin', require('./routes/admin'));
app.use('/', require('./routes/student'));

// Health check
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

// 404 handler
app.use((req, res) => {
  res.status(404).send('Page not found');
});

// Error handler
/**
app.use((err, req, res, next) => {
  console.error('ERROR:', err.message);
  console.error(err.stack);
  res.status(500).send('Something went wrong: ' + err.message);
});
*/

app.use((err, req, res, next) => {
  logger.error(`${err.message} — ${req.method} ${req.path}`);
  res.status(500).send('Something went wrong');
});
 


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
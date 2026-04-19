const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

exports.submitLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.student_id?.toString() || ipKeyGenerator(req),
  message: 'You have reached the maximum submissions for today. Please try again tomorrow.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET',
});

exports.authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});
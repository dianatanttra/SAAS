exports.requireStudent = (req, res, next) => {
  if (req.isAuthenticated() && req.user.type === 'student') return next();
  res.redirect('/login');
};

exports.requireAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.type === 'admin') return next();
  res.redirect('/admin/login');
};
const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const db = require('../db/database');

const getNow = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ');


// ─── Dashboard redirect ───────────────────────────────────
router.get('/', requireAdmin, (req, res) => {
  res.redirect('/admin/pending');
});

// ─── Pending approvals ────────────────────────────────────
router.get('/pending', requireAdmin, (req, res) => {
  const entries = db.prepare(`
    SELECT
      le.*,
      r.sport_name, r.event_name, r.reason,
      s.full_name, s.roll_number, s.year, s.stream, s.division
    FROM lecture_entries le
    JOIN requests r ON le.request_id = r.request_id
    JOIN students s ON r.student_id = s.student_id
    WHERE le.status = 'pending'
    ORDER BY le.date ASC
  `).all();

  const pendingCount = entries.length;
  res.render('admin/pending', { entries, pendingCount, admin: req.user });
});

// ─── Approve single entry ─────────────────────────────────
router.post('/approve/:id', requireAdmin, (req, res) => {
  const { remarks } = req.body;
  const entry = db.prepare('SELECT * FROM lecture_entries WHERE entry_id = ?').get(req.params.id);
  if (!entry) return res.redirect('/admin/pending');

  db.prepare(`
    UPDATE lecture_entries
    SET status = 'approved', remarks = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
    WHERE entry_id = ?
  `).run(remarks || null, req.user.admin_id, req.params.id);

  db.prepare(`
    INSERT INTO audit_log (actor_id, actor_name, action, entry_id, previous_status, new_status, remarks, ip_address)
    VALUES (?, ?, 'approve', ?, ?, 'approved', ?, ?)
  `).run(req.user.admin_id, req.user.full_name, req.params.id, entry.status, remarks || null, req.ip);

  res.redirect('/admin/pending');
});

// ─── Reject single entry ──────────────────────────────────
router.post('/reject/:id', requireAdmin, (req, res) => {
  const { remarks } = req.body;
  if (!remarks || remarks.trim().length < 5) {
    return res.redirect('/admin/pending?error=Rejection+reason+is+required');
  }

  const entry = db.prepare('SELECT * FROM lecture_entries WHERE entry_id = ?').get(req.params.id);
  if (!entry) return res.redirect('/admin/pending');

  db.prepare(`
    UPDATE lecture_entries
    SET status = 'rejected', remarks = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
    WHERE entry_id = ?
  `).run(remarks, req.user.admin_id, req.params.id);

  db.prepare(`
    INSERT INTO audit_log (actor_id, actor_name, action, entry_id, previous_status, new_status, remarks, ip_address)
    VALUES (?, ?, 'reject', ?, ?, 'rejected', ?, ?)
  `).run(req.user.admin_id, req.user.full_name, req.params.id, entry.status, remarks, req.ip);

  res.redirect('/admin/pending');
});

// ─── Bulk actions ─────────────────────────────────────────
router.post('/bulk-action', requireAdmin, (req, res) => {
  let { action, entry_ids, remarks } = req.body;

  if (!entry_ids) return res.redirect('/admin/pending?error=No+entries+selected');
  if (!Array.isArray(entry_ids)) entry_ids = [entry_ids];
  if (action === 'reject' && (!remarks || remarks.trim().length < 5)) {
    return res.redirect('/admin/pending?error=Rejection+reason+is+required+for+bulk+reject');
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';

  for (const id of entry_ids) {
    const entry = db.prepare('SELECT * FROM lecture_entries WHERE entry_id = ?').get(id);
    if (!entry) continue;

    db.prepare(`
      UPDATE lecture_entries
      SET status = ?, remarks = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE entry_id = ?
    `).run(newStatus, remarks || null, req.user.admin_id, id);

    db.prepare(`
      INSERT INTO audit_log (actor_id, actor_name, action, entry_id, previous_status, new_status, remarks, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.admin_id, req.user.full_name, 'bulk_' + action, id, entry.status, newStatus, remarks || null, req.ip);
  }

  res.redirect('/admin/pending');
});

// ─── Approved summary ─────────────────────────────────────
router.get('/summary', requireAdmin, (req, res) => {
  const pendingCount = db.prepare(`SELECT COUNT(*) as count FROM lecture_entries WHERE status = 'pending'`).get().count;

  const students = db.prepare(`
    SELECT DISTINCT s.student_id, s.full_name, s.roll_number, s.uid, s.year, s.stream, s.division, s.email,
      r.sport_name, r.event_name, r.reason, r.request_id, r.status_token, r.submitted_at
    FROM requests r
    JOIN students s ON r.student_id = s.student_id
    JOIN lecture_entries le ON le.request_id = r.request_id
    WHERE le.status = 'approved'
    ORDER BY s.full_name
  `).all();

  const summaries = students.map(student => {
    const totals = db.prepare(`
      SELECT course_code, subject, SUM(lectures) as total_lectures
      FROM lecture_entries
      WHERE request_id = ? AND status = 'approved'
      GROUP BY course_code
    `).all(student.request_id);
    return { ...student, totals };
  });

  res.render('admin/summary', { summaries, pendingCount, admin: req.user });
});

// ─── Print report ─────────────────────────────────────────
router.get('/report/:requestId', requireAdmin, (req, res) => {
  const request = db.prepare(`
    SELECT r.*, s.full_name, s.roll_number, s.uid, s.year, s.stream, s.division, s.email
    FROM requests r
    JOIN students s ON r.student_id = s.student_id
    WHERE r.request_id = ?
  `).get(req.params.requestId);

  if (!request) return res.redirect('/admin/summary');

  const totals = db.prepare(`
    SELECT course_code, subject, SUM(lectures) as total_lectures
    FROM lecture_entries
    WHERE request_id = ? AND status = 'approved'
    GROUP BY course_code
  `).all(req.params.requestId);

  const entries = db.prepare(`
    SELECT * FROM lecture_entries WHERE request_id = ? ORDER BY date ASC
  `).all(req.params.requestId);

  res.render('admin/report', { request, totals, entries, admin: req.user });
});

// ─── Excel Export ─────────────────────────────────────────
router.get('/export', requireAdmin, async (req, res) => {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();

  // ── Sheet 1: All approved entries ──
  const sheet1 = workbook.addWorksheet('Approved Entries');
  sheet1.columns = [
    { header: 'Student Name',   key: 'full_name',       width: 20 },
    { header: 'Roll Number',    key: 'roll_number',      width: 15 },
    { header: 'UID',            key: 'uid',              width: 15 },
    { header: 'Class',          key: 'class',            width: 15 },
    { header: 'Email',          key: 'email',            width: 28 },
    { header: 'Sport',          key: 'sport_name',       width: 15 },
    { header: 'Event',          key: 'event_name',       width: 25 },
    { header: 'Course Code',    key: 'course_code',      width: 18 },
    { header: 'Subject',        key: 'subject',          width: 20 },
    { header: 'Date',           key: 'date',             width: 12 },
    { header: 'Start Time',     key: 'start_time',       width: 10 },
    { header: 'End Time',       key: 'end_time',         width: 10 },
    { header: 'Lectures',       key: 'lectures',         width: 10 },
    { header: 'Approved By',    key: 'reviewed_by_name', width: 20 },
    { header: 'Approved At (IST)', key: 'reviewed_at', width: 22 },
  ];

  // Style header row
  sheet1.getRow(1).font = { bold: true };
  sheet1.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B3A6B' } };
  sheet1.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  const entries = db.prepare(`
    SELECT le.*, r.sport_name, r.event_name,
           s.full_name, s.roll_number, s.uid, s.year, s.stream, s.division, s.email,
           a.full_name as reviewed_by_name
    FROM lecture_entries le
    JOIN requests r ON le.request_id = r.request_id
    JOIN students s ON r.student_id = s.student_id
    LEFT JOIN admin_users a ON le.reviewed_by = a.admin_id
    WHERE le.status = 'approved'
    ORDER BY s.full_name, le.date
  `).all();
  
  const fmtIST = (dt) => {
    if (!dt) return '';
    // SQLite stores as local time string already
    const d = new Date(dt.replace(' ', 'T'));
    return d.toLocaleString('en-IN', { 
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true 
    });
  };
  entries.forEach(e => {
    sheet1.addRow({
      ...e,
      class: `${e.year} ${e.stream} Div ${e.division}`,
      reviewed_at: fmtIST(e.reviewed_at)
    });
  });

  // ── Sheet 2: Aggregated totals ──
  const sheet2 = workbook.addWorksheet('Course Totals');
  sheet2.columns = [
    { header: 'Student Name',  key: 'full_name',    width: 20 },
    { header: 'Roll Number',   key: 'roll_number',  width: 15 },
    { header: 'Class',         key: 'class',        width: 15 },
    { header: 'Course Code',   key: 'course_code',  width: 18 },
    { header: 'Subject',       key: 'subject',      width: 20 },
    { header: 'Total Lectures',key: 'total',        width: 15 },
  ];

  sheet2.getRow(1).font = { bold: true };
  sheet2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B3A6B' } };
  sheet2.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  const totals = db.prepare(`
    SELECT s.full_name, s.roll_number, s.year, s.stream, s.division,
           le.course_code, le.subject, SUM(le.lectures) as total
    FROM lecture_entries le
    JOIN requests r ON le.request_id = r.request_id
    JOIN students s ON r.student_id = s.student_id
    WHERE le.status = 'approved'
    GROUP BY r.student_id, le.course_code
    ORDER BY s.full_name, le.course_code
  `).all();

  totals.forEach(t => {
    sheet2.addRow({
      ...t,
      class: `${t.year} ${t.stream} Div ${t.division}`
    });
  });

  // Send file
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=saas-approved-' + new Date().toISOString().split('T')[0] + '.xlsx');
  await workbook.xlsx.write(res);
  res.end();
});
module.exports = router;
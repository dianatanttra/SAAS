const express = require('express');
const router = express.Router();
const { requireStudent } = require('../middleware/auth');
const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');
const { submitLimiter } = require('../middleware/rateLimiter');
const { body, validationResult } = require('express-validator');
const getNow = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ');

// ─── Submit form ──────────────────────────────────────────
router.get('/submit', requireStudent, submitLimiter, (req, res) => {
  const student = req.user;
  const codes = db.prepare(`
    SELECT DISTINCT le.course_code, le.subject
    FROM lecture_entries le
    JOIN requests r ON le.request_id = r.request_id
    WHERE r.student_id = ?
  `).all(student.student_id);

  const pastRequests = db.prepare(`
    SELECT request_id, sport_name, event_name, status_token, submitted_at
    FROM requests WHERE student_id = ?
    ORDER BY submitted_at DESC LIMIT 5
  `).all(student.student_id);

  res.render('student/submit', {
    student, courseCodes: codes,
    pastRequests, error: null, success: null,
    prefill: { sport_name: '', event_name: '', reason: '', entries: [] }
  });
});

router.post('/submit', requireStudent, submitLimiter, (req, res) => {
  const student = req.user;

  // Destructure FIRST
  const { roll_number, uid, year, stream, division, sport_name, event_name, reason, entries } = req.body;

  // Debug log AFTER destructuring — remove this once confirmed working
  console.log('POST body fields:', { roll_number, uid, year, stream, division, sport_name, event_name, reason });

  const codes = db.prepare(`
    SELECT DISTINCT le.course_code, le.subject
    FROM lecture_entries le
    JOIN requests r ON le.request_id = r.request_id
    WHERE r.student_id = ?
  `).all(student.student_id);

  const pastRequests = db.prepare(`
    SELECT request_id, sport_name, event_name, status_token, submitted_at
    FROM requests WHERE student_id = ?
    ORDER BY submitted_at DESC LIMIT 5
  `).all(student.student_id);

  const renderError = (msg) => {
    res.render('student/submit', {
      student: {
        ...student,
        roll_number: roll_number || student.roll_number,
        uid: uid || student.uid,
        year: year || student.year,
        stream: stream || student.stream,
        division: division || student.division,
      },
      courseCodes: codes,
      pastRequests,
      error: msg,
      prefill: {
        sport_name: sport_name || '',
        event_name: event_name || '',
        reason: reason || '',
        entries: Array.isArray(entries) ? entries.map(e => ({
          date: e.date || '',
          start_time: e.start_time || '',
          end_time: e.end_time || '',
          subject: e.subject || '',
          course_code: e.course_code || '',
          lectures: e.lectures || ''
        })) : []
      }
    });
  };

  // Basic validation
  if (!roll_number || !uid || !year || !stream || !division || !sport_name || !event_name || !reason) {
    return renderError('All student detail fields are required.');
  }
  if (reason.trim().length < 10) {
    return renderError('Reason must be at least 10 characters.');
  }
  if (!entries || entries.length === 0) {
    return renderError('Add at least one lecture entry.');
  }

// Max 14 rows
  if (entries.length > 14) {
    return renderError('Maximum 14 lecture entries allowed per submission.');
  }

  // Validate each entry
  for (const e of entries) {
    if (!e.date || !e.start_time || !e.end_time || !e.subject || !e.course_code || !e.lectures) {
      return renderError('All fields in every lecture row are required.');
    }

    if (isNaN(e.lectures) || e.lectures < 1 || e.lectures > 10) {
      return renderError('Lectures must be a number between 1 and 10.');
    }

    // 60 day limit
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const entryDate = new Date(e.date);
    if (entryDate < sixtyDaysAgo) {
      return renderError(`Date ${e.date} is more than 60 days in the past. Please contact the Sports Department for older requests.`);
    }

    // No Sunday
    const day = new Date(e.date + 'T00:00:00').getDay();
    if (day === 0) {
      return renderError(`Date ${e.date} is a Sunday. Sundays are not allowed.`);
    }

    // Time validation
    const [sh, sm] = e.start_time.split(':').map(Number);
    const [eh, em] = e.end_time.split(':').map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;

    if (startMins < 360 || startMins > 1260) {
      return renderError(`Start time must be between 6:00 AM and 9:00 PM (row: ${e.date} ${e.subject}).`);
    }
    if (endMins < 360 || endMins > 1260) {
      return renderError(`End time must be between 6:00 AM and 9:00 PM (row: ${e.date} ${e.subject}).`);
    }
    if (endMins <= startMins) {
      return renderError(`End time must be after start time (row: ${e.date} ${e.subject}).`);
    }
    if (endMins - startMins > 300) {
      return renderError(`Lecture duration cannot exceed 5 hours (row: ${e.date} ${e.subject}).`);
    }
  }

  // Check for overlapping times within the same submission
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (entries[i].date !== entries[j].date) continue;
      const [sh1, sm1] = entries[i].start_time.split(':').map(Number);
      const [eh1, em1] = entries[i].end_time.split(':').map(Number);
      const [sh2, sm2] = entries[j].start_time.split(':').map(Number);
      const [eh2, em2] = entries[j].end_time.split(':').map(Number);
      const s1 = sh1 * 60 + sm1, e1 = eh1 * 60 + em1;
      const s2 = sh2 * 60 + sm2, e2 = eh2 * 60 + em2;
      if (s1 < e2 && s2 < e1) {
        return renderError(`Two entries on ${entries[i].date} have overlapping times.`);
      }
    }
  }

  // Duplicate detection
  const duplicates = [];
  for (const e of entries) {
    const existing = db.prepare(`
      SELECT le.* FROM lecture_entries le
      JOIN requests r ON le.request_id = r.request_id
      WHERE r.student_id = ? AND le.course_code = ? AND le.date = ?
      AND le.status != 'rejected'
    `).get(student.student_id, e.course_code, e.date);
    if (existing) duplicates.push(`${e.course_code} on ${e.date}`);
  }
  if (duplicates.length > 0) {
    return renderError(`Possible duplicate entries detected: ${duplicates.join(', ')}. If this is intentional, contact the Sports Department.`);
  }

  // Update student profile
  db.prepare(`
    UPDATE students SET roll_number=?, uid=?, year=?, stream=?, division=?
    WHERE student_id=?
  `).run(roll_number, uid, year, stream, division, student.student_id);

  // Create request
  const token = uuidv4();
  const requestResult = db.prepare(`
    INSERT INTO requests (student_id, sport_name, event_name, reason, status_token, ip_address, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(student.student_id, sport_name, event_name, reason, token, req.ip, getNow());

  const requestId = requestResult.lastInsertRowid;

  const insertEntry = db.prepare(`
    INSERT INTO lecture_entries (request_id, date, start_time, end_time, subject, course_code, lectures)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const e of entries) {
    insertEntry.run(requestId, e.date, e.start_time, e.end_time, e.subject, e.course_code, parseInt(e.lectures));
  }

  res.redirect('/status/' + token + '?new=1');
});

// ─── Status page ──────────────────────────────────────────
router.get('/status/:token', (req, res) => {
  const request = db.prepare(`
    SELECT r.*, s.full_name, s.roll_number, s.uid, s.year, s.stream, s.division, s.email
    FROM requests r
    JOIN students s ON r.student_id = s.student_id
    WHERE r.status_token = ?
  `).get(req.params.token);

  if (!request) return res.status(404).render('404', { message: 'Request not found.' });

  const entries = db.prepare(`
    SELECT * FROM lecture_entries WHERE request_id = ? ORDER BY date ASC
  `).all(request.request_id);

  const isNew = req.query.new === '1';
  res.render('student/status', { request, entries, isNew });
});

module.exports = router;
# Contributing to SAAS

This document is for the developer(s) taking over active development of this project. Read it fully before writing any code.

---

## Before You Start

- Read the full **Handoff Document** first. It has all the context, architecture, security rules, and deployment steps you need.
- Make sure your local setup is working end-to-end (student form → admin dashboard → export) before making any changes.
- When in doubt, ask before you change something. It is faster than fixing a broken deployment.

---

## Google Cloud Access

The Google OAuth project belongs to the sports department and is managed by the original developer (Diana). You will be given access once approved by the Sports Director.

**Until then:** Create your own temporary OAuth credentials on a personal Google Cloud project for local development. See Section 3 Step 5 of the Handoff Document. Do not use the production credentials for local testing.

---

## Branching Rules

**Never push directly to `main`.** The `main` branch is what gets deployed. Breaking `main` breaks the live app for students.

Always work on a separate branch:

```bat
REM Create a new branch for your feature or fix
git checkout -b your-name/short-description

REM Examples:
git checkout -b priya/add-email-notification
git checkout -b raj/fix-duplicate-detection
```

When your work is ready, open a Pull Request on GitHub so it can be reviewed before merging.

---

## Commit Messages

Write commit messages that describe *what changed and why*, not just *what you did*:

```
REM Good
git commit -m "Add course code validation to student form — was accepting empty strings"
git commit -m "Fix duplicate detection not catching same-day same-subject resubmits"

REM Bad
git commit -m "fix"
git commit -m "changes"
git commit -m "updated stuff"
```

---

## Things You Must Never Do

These are not suggestions. Breaking any of these can expose student data or break the live app.

| Rule | Why |
|------|-----|
| Never commit `.env` to GitHub | It contains secrets. The `.gitignore` already blocks it — do not override this. |
| Never disable `helmet` or `csurf` | These provide security headers and CSRF protection. Removing them for "convenience" opens real attack vectors. |
| Never skip server-side input validation | Always validate with `express-validator` in the route, even if you also validate on the frontend. |
| Never use string concatenation in SQL queries | Use parameterised queries (`?` placeholders). String concatenation enables SQL injection. |
| Never log `req.body` in production | It will write student names and form data to log files in plain text. |
| Never remove the `@xaviers.edu.in` domain restriction | This is what prevents outsiders from logging into the admin dashboard. |
| Never store plain-text PINs or passwords | Always use `bcrypt`. |

---

## Adding New Features

Follow this checklist for any new feature:

- [ ] New form fields → add `express-validator` validation in the route file
- [ ] New admin actions → log them using Winston (audit trail is required)
- [ ] New protected pages → add the session auth middleware
- [ ] Database schema changes → back up `saas.db` first (`copy saas.db saas.backup.db`), then write a migration
- [ ] New npm packages → run `npm audit` after installing and fix any high/critical issues
- [ ] Any change → test the full student + admin flow locally before pushing

---

## Testing Your Changes Locally

There are no automated tests yet. Test manually by running through these scenarios every time:

1. Submit the student form with valid data → should save and show success
2. Submit the same form again (duplicate) → should show a warning, not save
3. Submit with missing/invalid fields → should show validation errors
4. Log into admin dashboard with correct PIN → should work
5. Log into admin dashboard with wrong PIN → should be rejected
6. Approve a submission → should update status and appear in audit log
7. Export to Excel → file should download with correct data
8. Log out → session should be cleared, dashboard should redirect to login

---

## File to Never Edit Without Talking to Diana First

- `src/db.js` — changing the schema without a migration plan will break the existing database
- `src/middleware/auth.js` — this is the session guard; getting it wrong unlocks protected pages
- `src/routes/auth.js` — this controls the Google OAuth domain restriction

---

## Deployment

Do not deploy to production without confirming with Diana first. The live URL will be used by real students and the Sports Director. See Section 7 of the Handoff Document for full deployment steps.

The critical thing before any production deployment: **set up persistent disk/volume storage** for `saas.db` on Railway or Render. Without this, all student data is wiped on every redeploy.

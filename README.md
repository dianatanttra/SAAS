# SAAS — Sports Attendance Approval System

A web app for the Sports Department at **St. Xavier's College (Autonomous), Mumbai** that replaces the paper-based lecture attendance excuse process for student athletes.

**Students** submit a digital form listing the lectures they missed due to a sports event. The **Sports Director** reviews and approves submissions via a PIN-protected dashboard. SAAS then auto-generates a weekly Excel summary for the Admin Department — replacing the manual paper compilation.

---

## Quick Start (Windows)

> **Prerequisites:** [Node.js v18+](https://nodejs.org) and [Git](https://git-scm.com) must be installed.
> Verify in Command Prompt: `node --version` and `git --version`

```bat
REM 1. Clone the repo
git clone https://github.com/dianatanttra/SAAS.git
cd SAAS

REM 2. Install dependencies
npm install

REM 3. Set up your environment file
copy .env.example .env
REM  → Open .env in Notepad and fill in all the values (see below)

REM 4. Start the development server
npm run dev
```

Then open your browser and go to:
- **Student form:** http://localhost:3000
- **Admin dashboard:** http://localhost:3000/admin

---

## Filling in .env

After running `copy .env.example .env`, open the `.env` file in Notepad and fill in:

| Key | What to put |
|-----|-------------|
| `SESSION_SECRET` | Run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste the output |
| `ADMIN_PIN` | Any 4–8 digit number you choose |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console (see Handoff Doc Section 3 Step 5) |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `BASE_URL` | Leave as `http://localhost:3000` for local dev |
| `DB_PATH` | Leave as `./saas.db` |

> ⚠️ **Google OAuth note:** The official sports department Google Cloud project is managed separately. Until you are given access, create your own temporary OAuth credentials for local development. See the Handoff Document for step-by-step instructions.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server | Node.js + Express v5 |
| Database | SQLite (via better-sqlite3) |
| Templates | EJS |
| Auth | Passport.js + Google OAuth 2.0 |
| Export | ExcelJS (.xlsx) |
| Logging | Winston |
| Security | helmet, csurf, bcrypt, express-rate-limit, express-validator |

---

## Project Structure

```
SAAS/
├── src/
│   ├── app.js              ← Entry point
│   ├── db.js               ← Database setup
│   ├── routes/
│   │   ├── auth.js         ← Google OAuth login/logout
│   │   ├── student.js      ← Student form submission
│   │   └── admin.js        ← Admin dashboard, approve/reject, export
│   └── middleware/
│       ├── auth.js         ← Session guard
│       └── rateLimit.js    ← Form spam prevention
├── views/
│   ├── student-form.ejs    ← Student submission page
│   ├── admin.ejs           ← Admin dashboard
│   └── login.ejs           ← Google login page
├── .env.example            ← Template for your .env file
├── .gitignore
└── package.json
```

---

## Useful Commands

```bat
npm run dev       :: Start server with auto-restart on file changes (development)
npm start         :: Start server without auto-restart (production)
npm audit         :: Check for security vulnerabilities in dependencies
```

---

## Documentation

Full onboarding guide, architecture, security rules, deployment steps, and troubleshooting:
📄 **[SAAS Handoff Document](./SAAS_Handoff_Document.docx)**

---

## Deployment

The app is planned for deployment on **Railway** or **Render** (TBD). Both connect directly to GitHub and support Node.js. See Section 7 of the Handoff Document for full deployment steps including the critical database persistence setup.

---

## Contact

Original developer: **Diana Tanttra** — Sports Secretary, St. Xavier's College Mumbai

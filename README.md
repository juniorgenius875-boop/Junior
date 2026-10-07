# Study Tracker + Junior

One merged application that uses the **Study Tracker UI**, a single **Node.js / Express backend**, and a single **MongoDB database**.

The original Study Tracker Firebase dependency has been removed. Junior's Python/FastAPI backend has been replaced by Node.js while preserving the existing Junior MongoDB collection names and authentication data shape so an existing Junior database can be reused.

## Architecture

```text
Next.js 16 / React 19 (Study Tracker UI)
                 |
                 | REST + JWT
                 v
Node.js / Express API (server/)
                 |
                 v
MongoDB (one database: junior_genius by default)
```

### Included Study Tracker features

- Dashboard and progress overview
- Subjects / chapter tracking
- Skills tracking
- Mock tests
- Timetable / planner
- Vocabulary
- Admin overview, planner, and student drill-down

### Included Junior features

- MongoDB/JWT authentication
- Existing Junior user/password compatibility
- Performance prediction
- Converted Random Forest + Ridge model running directly in Node.js
- Progress history
- Adaptive assessments and result history
- AI tutor with local curriculum retrieval and optional Groq/Gemini/OpenRouter
- Study-plan and answer-evaluation APIs
- Student profile and learning statistics
- Student PDF report
- Admin learning overview, activity, student drill-down, and PDF exports

## MongoDB compatibility

The Node API intentionally preserves the original Junior collections:

- `users`
- `student_progress`
- `test_results`
- `chat_history`
- `activity_log`

Study Tracker data is stored in the same database using:

- `chapter_progress`
- `skill_progress`
- `mock_tests`
- `study_activities`
- `vocabulary`
- `app_config`

Use the **same `MONGODB_URI`, `MONGODB_DB`, and `JWT_SECRET`** as the old Junior Python backend. Existing Junior users keep their bcrypt password hashes and do not need password resets.

## Setup

Requirements: Node.js 20+ and MongoDB.

1. Create frontend env:

```bash
cp .env.example .env.local
```

2. Create backend env:

```bash
cp server/.env.example server/.env
```

Set `MONGODB_URI`, `MONGODB_DB`, and `JWT_SECRET`. For an existing Junior deployment, copy the values from the old backend `.env`.

3. Install dependencies:

```bash
npm run install:all
```

4. Run frontend and backend together:

```bash
npm run dev:all
```

Frontend: `http://localhost:3000`  
Backend: `http://localhost:9010`

You can also run them separately with `npm run dev` and `npm run dev:server`.

## Create an admin

```bash
npm --prefix server run seed:admin -- admin@example.com StrongPassword123 "Admin"
```

If the admin already exists, the script updates that account to the admin role.

## AI tutor

The app works without an external AI key using the included local Junior curriculum material. For richer answers, add one or more provider keys in `server/.env`:

- `GROQ_API_KEY`
- `GEMINI_API_KEY`
- `OPENROUTER_API_KEY`

The backend attempts configured providers and falls back to local curriculum retrieval.

## ML model

Junior's original scikit-learn pickle cannot be executed natively by Node. The trained model has therefore been exported to `server/model/student_performance_model.json` and its preprocessing, Ridge regression, and Random Forest inference have been implemented in JavaScript. The Node inference output was verified against the original trained model internals.

The original training notebooks are retained under `server/ml-source/` for retraining/reference.

## Existing Junior deployment migration

No MongoDB data migration is required when you use the existing Junior database and the same database name. Deploy this Node API, point the frontend to it with `NEXT_PUBLIC_API_URL`, verify login/predictions/tests/tutor/reporting, then retire the old Python API.

## Existing Study Tracker Firebase data

The merged application no longer calls Firebase. The uploaded Study Tracker source did not include your live Firestore records or Firebase Auth passwords, so live production Study Tracker data is not automatically copied by this repository. If you have production Firebase data, export the records and map each Firebase user to the corresponding MongoDB account before switching production traffic.

## Important folders

```text
app/                         Study Tracker UI + merged Junior pages
components/                  Shared Study Tracker shell/components
lib/api.js                   REST/JWT client
lib/firestore.js             Compatibility layer now backed by Node REST APIs
server/src/                  Node.js backend
server/model/                Converted Junior ML model
server/knowledge/            Local tutor knowledge
server/knowledge/source-pdfs Original Junior knowledge source files
server/ml-source/            Original Junior model notebooks
```

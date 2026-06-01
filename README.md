# Task Manager

Task Manager is a full-stack to-do application for creating and managing tasks with a title, description, status, and due date.

## Features

- Create tasks with title, description, status, and due date
- Edit existing tasks
- Delete tasks
- Filter tasks by status
- View summary counts for all, pending, in-progress, and completed tasks
- Persist task data in SQLite
- Register, login, logout, and session introspection endpoints
- HttpOnly cookie session auth with CSRF protection on mutating routes
- Owner-scoped task access so users can only manage their own tasks
- Login brute-force baseline protection with deterministic 429 responses

## Tech Stack

- Frontend: React with Vite
- Backend: Express REST API
- Database: SQLite

## Project Structure

```text
.
|-- server/
|   |-- database.js
|   `-- index.js
|-- src/
|   |-- App.jsx
|   |-- main.jsx
|   `-- styles.css
|-- data/
|-- index.html
|-- package.json
`-- vite.config.js
```

## Local Development

### Install dependencies

```bash
npm install
```

### Run frontend and backend in development mode

```bash
npm run dev
```

- React dev server: http://localhost:5173
- Express API: http://localhost:4000

### Build the frontend

```bash
npm run build
```

### Run tests

```bash
npm run test:unit
npm run test:api
npm run test:security
```

### Run the deployed app locally

```bash
npm start
```

The production app is served from:

```text
http://localhost:4000
```

## API Endpoints

- `GET /api/health` - health check
- `GET /api/auth/csrf-token` - issue CSRF token cookie and body token
- `POST /api/auth/register` - register user account
- `POST /api/auth/login` - login and issue session cookie
- `GET /api/auth/session` - fetch current session state
- `POST /api/auth/logout` - revoke current session
- `GET /api/tasks` - list tasks for authenticated owner
- `POST /api/tasks` - create a task for authenticated owner
- `PUT /api/tasks/:id` - update an owned task
- `DELETE /api/tasks/:id` - delete an owned task

## Task Model

Each task includes:

- `title`
- `description`
- `status`
- `dueDate`

## Notes

- SQLite database file is stored under `data/tasks.db`
- `node_modules`, `dist`, and local database files are excluded from git
- Legacy ownership reassignment runbook: `docs/legacy-task-reassignment-playbook.md`
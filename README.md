# Task Manager

Task Manager is a full-stack to-do application for creating and managing tasks with a title, description, status, and due date.

## Features

- Create tasks with title, description, status, and due date
- Edit existing tasks
- Delete tasks
- Filter tasks by status
- View summary counts for all, pending, in-progress, and completed tasks
- Persist task data in SQLite

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

### Run unit tests

```bash
npm test
npm run test:coverage
```

Jest runs server tests in Node and React tests in jsdom. The ESM runner uses Node's
experimental VM modules flag. Database tests initialize a separate in-memory SQLite
database when `NODE_ENV=test`; they do not use `data/tasks.db`.
The coverage command reports coverage; it does not waive the pipeline's changed-file
coverage requirement.

Search callbacks run only when the debounced query changes, not on initial render
or when the parent supplies a new callback. Result ranges reflect the number of
tasks displayed, including partial pages.

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
- `GET /api/tasks` - list tasks
- `POST /api/tasks` - create a task
- `PUT /api/tasks/:id` - update a task
- `DELETE /api/tasks/:id` - delete a task

## Task Model

Each task includes:

- `title`
- `description`
- `status`
- `dueDate`

## Notes

- SQLite database file is stored under `data/tasks.db`
- `node_modules`, `dist`, and local database files are excluded from git
import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultDatabasePath = path.join(__dirname, '..', 'data', 'tasks.db');
const databasePath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : defaultDatabasePath;

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new sqlite3.Database(databasePath);
const migrationUserEmail = 'system+migration@local';

function run(statement, params = []) {
  return new Promise((resolve, reject) => {
    db.run(statement, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(statement, params = []) {
  return new Promise((resolve, reject) => {
    db.get(statement, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row ?? null);
    });
  });
}

function all(statement, params = []) {
  return new Promise((resolve, reject) => {
    db.all(statement, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });
}

async function withTransaction(work) {
  await run('BEGIN TRANSACTION');

  try {
    await work();
    await run('COMMIT');
  } catch (error) {
    await run('ROLLBACK');
    throw error;
  }
}

async function ensureTasksTable() {
  await run(
    `CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'in-progress', 'completed')),
      dueDate TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );
}

async function ensureUsersTable() {
  await run(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );

  await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_normalized ON users(LOWER(email))');
}

async function ensureSessionsTable() {
  await run(
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      userId INTEGER NOT NULL,
      expiresAt TEXT NOT NULL,
      idleExpiresAt TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      revokedAt TEXT,
      userAgent TEXT,
      ipHash TEXT,
      FOREIGN KEY (userId) REFERENCES users(id)
    )`
  );

  await run('CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(userId)');
  await run('CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expiresAt)');
}

async function ensureTaskOwnerColumn() {
  const columns = await all('PRAGMA table_info(tasks)');
  const ownerColumnExists = columns.some((column) => column.name === 'ownerId');

  if (!ownerColumnExists) {
    await run('ALTER TABLE tasks ADD COLUMN ownerId INTEGER');
  }
}

async function getOrCreateMigrationUser() {
  const existingUser = await get(
    `SELECT id FROM users WHERE LOWER(email) = LOWER(?)`,
    [migrationUserEmail]
  );

  if (existingUser) {
    return existingUser.id;
  }

  const result = await run(
    `INSERT INTO users (email, passwordHash, updatedAt)
     VALUES (?, ?, CURRENT_TIMESTAMP)`,
    [migrationUserEmail, '!migration-account!']
  );

  return result.lastID;
}

async function backfillTaskOwners(migrationUserId) {
  await run('UPDATE tasks SET ownerId = ? WHERE ownerId IS NULL', [migrationUserId]);
  await run('CREATE INDEX IF NOT EXISTS idx_tasks_owner_status_due ON tasks(ownerId, status, dueDate)');
}

export async function initializeDatabase() {
  await withTransaction(async () => {
    await ensureTasksTable();
    await ensureUsersTable();
    await ensureSessionsTable();
    await ensureTaskOwnerColumn();

    const migrationUserId = await getOrCreateMigrationUser();
    await backfillTaskOwners(migrationUserId);
  });
}

export async function createUser({ email, passwordHash }) {
  const result = await run(
    `INSERT INTO users (email, passwordHash, updatedAt)
     VALUES (?, ?, CURRENT_TIMESTAMP)`,
    [email, passwordHash]
  );

  return getUserById(result.lastID);
}

export function getUserByEmail(email) {
  return get(
    `SELECT id, email, passwordHash, createdAt
     FROM users
     WHERE LOWER(email) = LOWER(?)`,
    [email]
  );
}

export function getUserById(id) {
  return get(
    `SELECT id, email, createdAt
     FROM users
     WHERE id = ?`,
    [id]
  );
}

export function createSession(session) {
  return run(
    `INSERT INTO sessions (id, userId, expiresAt, idleExpiresAt, userAgent, ipHash)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [session.id, session.userId, session.expiresAt, session.idleExpiresAt, session.userAgent, session.ipHash]
  );
}

export function getSessionById(id) {
  return get(
    `SELECT s.id, s.userId, s.expiresAt, s.idleExpiresAt, s.revokedAt,
            u.email, u.createdAt as userCreatedAt
     FROM sessions s
     JOIN users u ON u.id = s.userId
     WHERE s.id = ?`,
    [id]
  );
}

export function touchSession(id, idleExpiresAt) {
  return run(
    `UPDATE sessions
     SET idleExpiresAt = ?
     WHERE id = ?`,
    [idleExpiresAt, id]
  );
}

export function revokeSession(id) {
  return run(
    `UPDATE sessions
     SET revokedAt = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [id]
  );
}

export function revokeUserSessions(userId) {
  return run(
    `UPDATE sessions
     SET revokedAt = CURRENT_TIMESTAMP
     WHERE userId = ? AND revokedAt IS NULL`,
    [userId]
  );
}

export function deleteExpiredSessions(currentTimeIso) {
  return run(
    `DELETE FROM sessions
     WHERE expiresAt <= ? OR idleExpiresAt <= ? OR revokedAt IS NOT NULL`,
    [currentTimeIso, currentTimeIso]
  );
}

export async function getTasks(ownerId) {
  return all(
    `SELECT id, ownerId, title, description, status, dueDate, createdAt, updatedAt
     FROM tasks
     WHERE ownerId = ?
     ORDER BY CASE status
       WHEN 'in-progress' THEN 1
       WHEN 'pending' THEN 2
       ELSE 3
     END, dueDate ASC, createdAt DESC`,
    [ownerId]
  );
}

export async function createTask(ownerId, task) {
  const result = await run(
    `INSERT INTO tasks (ownerId, title, description, status, dueDate, updatedAt)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [ownerId, task.title, task.description, task.status, task.dueDate]
  );

  return getTaskByIdForOwner(ownerId, result.lastID);
}

export async function updateTask(ownerId, id, task) {
  const result = await run(
    `UPDATE tasks
     SET title = ?, description = ?, status = ?, dueDate = ?, updatedAt = CURRENT_TIMESTAMP
     WHERE id = ? AND ownerId = ?`,
    [task.title, task.description, task.status, task.dueDate, id, ownerId]
  );

  if (!result.changes) {
    return null;
  }

  return getTaskByIdForOwner(ownerId, id);
}

export async function deleteTask(ownerId, id) {
  const result = await run(
    `DELETE FROM tasks
     WHERE id = ? AND ownerId = ?`,
    [id, ownerId]
  );

  return result.changes > 0;
}

export function getDatabasePath() {
  return databasePath;
}

function getTaskByIdForOwner(ownerId, id) {
  return get(
    `SELECT id, ownerId, title, description, status, dueDate, createdAt, updatedAt
     FROM tasks
     WHERE ownerId = ? AND id = ?`,
    [ownerId, id]
  );
}

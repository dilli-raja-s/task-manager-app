import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const databasePath = path.join(__dirname, '..', 'data', 'tasks.db');

const db = new sqlite3.Database(databasePath);

export function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'in-progress', 'completed')),
        dueDate TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        // Create indexes for search optimization
        db.run(
          `CREATE INDEX IF NOT EXISTS idx_title_description ON tasks(title, description)`,
          (indexError1) => {
            if (indexError1) {
              reject(indexError1);
              return;
            }
            db.run(
              `CREATE INDEX IF NOT EXISTS idx_status_dueDate ON tasks(status, dueDate)`,
              (indexError2) => {
                if (indexError2) {
                  reject(indexError2);
                  return;
                }
                resolve();
              }
            );
          }
        );
      }
    );
  });
}

export function getTasks() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT id, title, description, status, dueDate, createdAt, updatedAt
       FROM tasks
       ORDER BY CASE status
         WHEN 'in-progress' THEN 1
         WHEN 'pending' THEN 2
         ELSE 3
       END, dueDate ASC, createdAt DESC`,
      [],
      (error, rows) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(rows);
      }
    );
  });
}

export function createTask(task) {
  return new Promise((resolve, reject) => {
    const statement = `
      INSERT INTO tasks (title, description, status, dueDate, updatedAt)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    db.run(statement, [task.title, task.description, task.status, task.dueDate], function onInsert(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve(getTaskById(this.lastID));
    });
  });
}

export function updateTask(id, task) {
  return new Promise((resolve, reject) => {
    const statement = `
      UPDATE tasks
      SET title = ?, description = ?, status = ?, dueDate = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    db.run(statement, [task.title, task.description, task.status, task.dueDate, id], function onUpdate(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve(this.changes);
    });
  }).then((changes) => {
    if (!changes) {
      return null;
    }
    return getTaskById(id);
  });
}

export function deleteTask(id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM tasks WHERE id = ?', [id], function onDelete(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve(this.changes > 0);
    });
  });
}

function getTaskById(id) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT id, title, description, status, dueDate, createdAt, updatedAt
       FROM tasks
       WHERE id = ?`,
      [id],
      (error, row) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(row ?? null);
      }
    );
  });
}
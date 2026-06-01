import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv) {
  const args = {
    dryRun: false,
    mappingPath: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    if (value === '--mapping') {
      args.mappingPath = argv[index + 1] ?? '';
      index += 1;
    }
  }

  return args;
}

function openDatabase(databasePath) {
  return new sqlite3.Database(databasePath);
}

function get(db, statement, params = []) {
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

function run(db, statement, params = []) {
  return new Promise((resolve, reject) => {
    db.run(statement, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve({ changes: this.changes });
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.mappingPath) {
    throw new Error('Missing required argument: --mapping <path-to-json>');
  }

  const resolvedMappingPath = path.resolve(process.cwd(), args.mappingPath);
  const databasePath = process.env.DATABASE_PATH
    ? path.resolve(process.env.DATABASE_PATH)
    : path.join(__dirname, '..', '..', 'data', 'tasks.db');

  const mappingContent = fs.readFileSync(resolvedMappingPath, 'utf8');
  const mappingEntries = JSON.parse(mappingContent);

  if (!Array.isArray(mappingEntries)) {
    throw new Error('Mapping file must be an array of objects: [{ "taskId": 1, "ownerEmail": "user@example.com" }]');
  }

  const db = openDatabase(databasePath);

  let updated = 0;
  let skipped = 0;

  try {
    for (const entry of mappingEntries) {
      const taskId = Number(entry.taskId);
      const ownerEmail = String(entry.ownerEmail ?? '').trim().toLowerCase();

      if (!Number.isInteger(taskId) || !ownerEmail) {
        skipped += 1;
        continue;
      }

      const user = await get(db, 'SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [ownerEmail]);

      if (!user) {
        skipped += 1;
        continue;
      }

      if (!args.dryRun) {
        const result = await run(
          db,
          'UPDATE tasks SET ownerId = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
          [user.id, taskId]
        );

        if (result.changes > 0) {
          updated += 1;
        } else {
          skipped += 1;
        }
      } else {
        const row = await get(db, 'SELECT id FROM tasks WHERE id = ?', [taskId]);

        if (row) {
          updated += 1;
        } else {
          skipped += 1;
        }
      }
    }

    console.log(
      JSON.stringify(
        {
          dryRun: args.dryRun,
          updated,
          skipped,
          total: mappingEntries.length,
          mappingPath: resolvedMappingPath,
          databasePath,
        },
        null,
        2
      )
    );
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

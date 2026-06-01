import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDirectory = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(rootDirectory, relativePath), 'utf8');
}

const readme = read('README.md');
const legacyPlaybook = read('docs/legacy-task-reassignment-playbook.md');

const checks = [
  {
    name: 'readme-auth-endpoints',
    pass:
      readme.includes('POST /api/auth/register') &&
      readme.includes('POST /api/auth/login') &&
      readme.includes('GET /api/auth/session'),
  },
  {
    name: 'readme-task-endpoints',
    pass:
      readme.includes('GET /api/tasks') &&
      readme.includes('POST /api/tasks') &&
      readme.includes('DELETE /api/tasks/:id'),
  },
  {
    name: 'readme-test-commands',
    pass:
      readme.includes('npm run test:unit') &&
      readme.includes('npm run test:api') &&
      readme.includes('npm run test:security'),
  },
  {
    name: 'legacy-ownership-playbook',
    pass: legacyPlaybook.toLowerCase().includes('owner') && legacyPlaybook.toLowerCase().includes('reassign'),
  },
];

const failures = checks.filter((check) => !check.pass);

console.log(JSON.stringify({ checks }, null, 2));

if (failures.length > 0) {
  throw new Error(`Documentation coverage failed for: ${failures.map((failure) => failure.name).join(', ')}`);
}
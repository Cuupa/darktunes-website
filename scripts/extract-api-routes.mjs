import fs from 'fs';
import path from 'path';

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full));
    else if (entry.name === 'route.ts') results.push(full);
  }
  return results;
}

const apiDir = path.join(process.cwd(), 'app', 'api');
const files = walk(apiDir).sort();

const routes = [];
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const methods = [];
  for (const m of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
    const re1 = new RegExp(`export async function ${m}\\b`);
    const re2 = new RegExp(`export const ${m}\\s*=`);
    if (re1.test(content) || re2.test(content)) methods.push(m);
  }

  // Extract JSDoc summary from file header
  const docMatch = content.match(/\/\*\*[\s\S]*?\*\//);
  let summary = '';
  if (docMatch) {
    const lines = docMatch[0]
      .split('\n')
      .map((l) => l.replace(/^\s*\*?\s?/, '').trim())
      .filter((l) => l && !l.startsWith('/') && !l.startsWith('app/api'));
    summary = lines.slice(0, 2).join(' ').replace(/\s+/g, ' ').trim();
  }

  // Detect auth patterns
  const auth = {
    bearerAdmin: /verifyAdmin\b|verifyAdminOrEditor|verifyPermission/.test(content),
    bearerAdminOnly: /verifyAdmin\(/.test(content),
    bearerCron: /CRON_SECRET|verifyCronSecret/.test(content),
    bearerSession: /createServerSupabaseClient|getUser\(\)|getSession/.test(content) && !/verifyAdmin/.test(content),
    public: !/verifyAdmin|verifyAdminOrEditor|verifyPermission|CRON_SECRET|verifyCronSecret|createServerSupabaseClient|getUser\(\)/.test(content),
  };

  const rel = file.replace(apiDir, '').replace(/\\/g, '/').replace(/\/route\.ts$/, '');
  const openapiPath = '/api' + rel.replace(/\[([^\]]+)\]/g, '{$1}');

  routes.push({ path: openapiPath, methods, summary, auth, file: file.replace(process.cwd() + path.sep, '').replace(/\\/g, '/') });
}

console.log(JSON.stringify(routes, null, 2));
console.error('Total routes:', routes.length);
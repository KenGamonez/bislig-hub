// Bislig Hub guardrails smoke check (read-only, no deps).
// Verifies stable structural contracts only — never application behavior.
// Exit 0 = pass (warnings allowed). Exit 1 = hard failure.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
let failures = 0;
const warnings = [];
const ok = (label) => console.log(`PASS   ${label}`);
const fail = (label, detail) => {
  failures += 1;
  console.log(`FAIL   ${label}${detail ? ': ' + detail : ''}`);
};
const warn = (label, detail) => {
  warnings.push(label);
  console.log(`WARN   ${label}${detail ? ': ' + detail : ''}`);
};
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

// 1. Required routes entry + critical source modules still exist.
const requiredFiles = [
  'src/App.tsx',
  'src/org/OrgShell.tsx',
  'src/org/OrgGuard.tsx',
  'src/org/useOrgAdmin.ts',
  'src/org/orgData.ts',
  'src/org/pages/OrgLogin.tsx',
  'src/org/pages/OrgDashboard.tsx',
  'src/org/pages/OrgDrivers.tsx',
  'src/org/pages/OrgActivity.tsx',
  'src/org/pages/OrgAnnouncements.tsx',
  'src/org/pages/OrgForum.tsx',
  'src/org/pages/OrgTopic.tsx',
  'src/org/pages/OrgSettings.tsx',
  'src/driver/DriverShell.tsx',
  'src/driver/components/DriverBottomNav.tsx',
  'src/driver/hooks/useDriverSession.ts',
  'src/driver/pages/JobsPage.tsx',
  'src/driver/pages/ActiveJobPage.tsx',
  'src/driver/pages/YouPage.tsx',
  'src/driver/pages/DriverHistoryPage.tsx',
  'src/legacy/lib/driverAuth.ts',
  'src/legacy/lib/supabase.ts',
  'src/lib/supabase.ts',
  'src/pages/Driver.tsx',
  'vercel.json',
];
for (const f of requiredFiles) {
  if (exists(f)) ok(`exists ${f}`);
  else fail(`exists ${f}`, 'missing');
}

// 2. Critical package scripts exist.
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  for (const s of ['build', 'lint']) {
    if (pkg.scripts && pkg.scripts[s]) ok(`script ${s}`);
    else fail(`script ${s}`, 'missing from package.json');
  }
  if (pkg.name === 'bislig-hub') ok('project identity (package.json name)');
  else fail('project identity', `unexpected name ${pkg.name}`);
} catch (e) {
  fail('package.json readable', String(e));
}

// 3. Vercel SPA rewrite intact (required for client routing in production).
try {
  const vercel = fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8');
  if (vercel.includes('/index.html')) ok('vercel.json SPA rewrite');
  else fail('vercel.json SPA rewrite', 'missing /index.html destination');
} catch (e) {
  fail('vercel.json readable', String(e));
}

// 4. No absolute local paths or cross-repo imports leaked into source.
try {
  const hits = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        walk(p);
      } else if (/\.(ts|tsx|css|json)$/.test(entry.name)) {
        const c = fs.readFileSync(p, 'utf8');
        if (/[A-Za-z]:\\Users\\/.test(c) || /\.\.\/bislig-ride/.test(c)) {
          hits.push(path.relative(ROOT, p));
        }
      }
    }
  };
  walk(path.join(ROOT, 'src'));
  if (hits.length === 0) ok('no absolute-path / cross-repo leaks in src');
  else fail('no absolute-path / cross-repo leaks in src', hits.join(', '));
} catch (e) {
  fail('source scan', String(e));
}

// 5. Protected-area touch warning: shared/high-risk files changed in the
//    working tree trigger expanded regression checks (warning only).
const PROTECTED = [
  'src/App.tsx',
  'src/org/orgData.ts',
  'src/legacy/lib/driverAuth.ts',
  'src/legacy/lib/supabase.ts',
  'src/lib/supabase.ts',
  'src/driver/hooks/useDriverSession.ts',
  'src/driver/DriverShell.tsx',
  'src/org/OrgShell.tsx',
  'src/org/OrgGuard.tsx',
  'src/org/useOrgAdmin.ts',
  'package.json',
  'vercel.json',
];
try {
  const status = execSync('git status --short', { cwd: ROOT, encoding: 'utf8' });
  const touched = [];
  for (const line of status.split('\n')) {
    const m = line.match(/^ ?M.?\s+(.+)$/);
    if (m && PROTECTED.includes(m[1].trim().replace(/"/g, ''))) touched.push(m[1].trim());
  }
  // Modified (not new) migration files are never allowed.
  const modifiedMigrations = [];
  for (const line of status.split('\n')) {
    const m = line.match(/^ ?M.?\s+(supabase\/migrations\/.+)$/);
    if (m) modifiedMigrations.push(m[1].trim());
  }
  if (modifiedMigrations.length > 0) {
    fail('applied migrations untouched', modifiedMigrations.join(', '));
  } else {
    ok('applied migrations untouched');
  }
  if (touched.length > 0) {
    warn('protected files touched — run expanded regression checks', touched.join(', '));
  } else {
    ok('no protected files touched');
  }
} catch {
  warn('git unavailable — protected-file check skipped', null);
}

console.log('');
if (failures > 0) {
  console.log(`${failures} FAILURE(S)`);
  process.exitCode = 1;
} else if (warnings.length > 0) {
  console.log(`guardrails pass with ${warnings.length} warning(s)`);
} else {
  console.log('guardrails pass');
}

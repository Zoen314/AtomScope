import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Check tracked content, not ignored dependencies, builds or local datasets.
// Print locations only: never echo suspected credentials into CI logs.
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
if (!files.length) throw new Error('No tracked files to inspect. Stage the source distribution first.');
const rules = [
  ['absolute home path', /(?:[A-Z]:[\\/]+Users[\\/]+|\/(?:Users|home)\/)[^\s"'<>/\\]+/i],
  ['hosted project identifier', /appgprj_[a-f0-9]{16,}/i],
  ['private deployment URL', /[\w.-]{1,100}\.chatgpt\.site\b/i],
  ['encoded structure link', /#s=[A-Za-z0-9_-]{80}/],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['token-like value', /(?:gh[pousr]_[A-Za-z0-9]{20,255}|github_pat_[A-Za-z0-9_]{20,255}|sk-(?:proj-)?[A-Za-z0-9_-]{20,255}|AKIA[A-Z0-9]{16})/],
];
const findings = [];
for (const file of files) {
  if (/^(?:node_modules|dist|outputs|work|release-checks|\.wrangler|\.next|\.vinext|public\/matterviz)\//.test(file)) {
    findings.push({ file, rule: 'generated or private artifact is tracked' });
  }
  const bytes = readFileSync(file);
  if (bytes.includes(0)) continue;
  const text = bytes.toString('utf8');
  for (const [rule, pattern] of rules) {
    const match = pattern.exec(text);
    if (match) findings.push({ file, rule, line: text.slice(0, match.index).split('\n').length });
  }
}
console.log(JSON.stringify({ checkedFiles: files.length, findings }, null, 2));
if (findings.length) process.exitCode = 1;

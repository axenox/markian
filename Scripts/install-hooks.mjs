import { chmod } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
await chmod('.githooks/pre-commit', 0o755);
execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'inherit' });
console.log('Build-and-verify commit hook installed. It never stages source or generated assets.');
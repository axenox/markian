import { execFileSync } from 'node:child_process';
const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--', 'dist', 'includes.json'], { encoding: 'utf8' });
if (status.trim()) throw new Error(`Distribution differs from the committed build:\n${status}`);
console.log('Distribution matches the committed build.');
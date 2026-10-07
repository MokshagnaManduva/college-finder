import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function deploymentApiURL(env) {
  if ((env.VITE_DATA_MODE ?? 'api') !== 'api') throw new Error('Deploy with VITE_DATA_MODE=api.');
  let url;
  try { url = new URL(env.VITE_API_URL); }
  catch { throw new Error('Set VITE_API_URL to the backend HTTPS URL ending in /api.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
    || url.pathname.replace(/\/$/, '') !== '/api') {
    throw new Error('VITE_API_URL must be an HTTPS backend URL ending in /api without credentials or query parameters.');
  }
  return url.href.replace(/\/$/, '');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  deploymentApiURL(process.env);
  execFileSync('npm', ['run', 'build'], {stdio: 'inherit'});
}

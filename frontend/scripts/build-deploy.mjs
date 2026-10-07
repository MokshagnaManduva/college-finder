import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function deploymentApiURL(env) {
  if ((env.VITE_DATA_MODE ?? 'api') !== 'api') throw new Error('Deploy with VITE_DATA_MODE=api.');
  let url;
  try { url = new URL(env.VITE_API_URL?.trim()); }
  catch { throw new Error('VITE_API_URL is missing or invalid. Copy the HTTPS URL from Render’s college-finder-demo-api web service.'); }
  if (url.protocol === 'postgres:' || url.protocol === 'postgresql:') {
    throw new Error('VITE_API_URL contains a database address. Copy the public HTTPS URL from the Render API web service; keep database credentials only on Render.');
  }
  if (url.protocol !== 'https:') throw new Error('VITE_API_URL must begin with https://.');
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('VITE_API_URL must contain only the public web-service URL, without credentials, query parameters or fragments.');
  }
  if (['dashboard.render.com', 'render.com', 'www.render.com', 'vercel.com', 'www.vercel.com',
    'localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('Copy the deployed API web service’s public HTTPS URL from its Render service page.');
  }
  const path = url.pathname.replace(/\/$/, '');
  if (path !== '' && path !== '/api') {
    throw new Error('VITE_API_URL must be the API service’s base URL or its /api URL. Remove other page paths.');
  }
  url.pathname = '/api';
  url.search = '';
  url.hash = '';
  return url.href;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const apiURL = deploymentApiURL(process.env);
    execFileSync('npm', ['run', 'build'], {stdio: 'inherit', env: {...process.env, VITE_API_URL: apiURL}});
  } catch (error) {
    console.error(`Deployment build failed: ${error.message}`);
    process.exitCode = 1;
  }
}

import assert from 'node:assert/strict';
import test from 'node:test';
import { deploymentApiURL } from '../scripts/build-deploy.mjs';

test('deployment builds normalize API origins and reject database, dashboard and unsafe URLs', () => {
  for (const url of ['https://api.example.com', 'https://api.example.com/', 'https://api.example.com/api',
    'https://api.example.com/api/', 'https://api.example.com/?#', '  https://api.example.com  ']) {
    assert.equal(deploymentApiURL({VITE_API_URL: url}), 'https://api.example.com/api');
  }
  for (const url of [undefined, '/api', 'http://localhost:8000/api', 'https://localhost/api',
    'https://dashboard.render.com', 'https://dashboard.render.com/web/srv-example',
    'https://api.example.com/admin', 'https://user:password@api.example.com/api',
    'https://api.example.com/api?token=secret', 'https://api.example.com/api#sources']) {
    assert.throws(() => deploymentApiURL({VITE_API_URL: url}));
  }
  assert.throws(() => deploymentApiURL({VITE_API_URL: 'postgresql://user:private@db.example.com/database'}), /database address/);
  assert.throws(() => deploymentApiURL({VITE_API_URL: 'https://api.example.com/api', VITE_DATA_MODE: 'demo'}));
});

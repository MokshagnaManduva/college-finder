import assert from 'node:assert/strict';
import test from 'node:test';
import { deploymentApiURL } from '../scripts/build-deploy.mjs';

test('deployment builds require a connected HTTPS API, not local defaults or demo fixtures', () => {
  assert.equal(deploymentApiURL({VITE_API_URL: 'https://api.example.com/api/'}), 'https://api.example.com/api');
  for (const url of [undefined, '/api', 'http://localhost:8000/api', 'https://api.example.com',
    'https://user:password@api.example.com/api', 'https://api.example.com/api?token=secret']) {
    assert.throws(() => deploymentApiURL({VITE_API_URL: url}));
  }
  assert.throws(() => deploymentApiURL({VITE_API_URL: 'https://api.example.com/api', VITE_DATA_MODE: 'demo'}));
});

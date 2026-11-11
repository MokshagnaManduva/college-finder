import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { campusPhoto } from '../src/domain/photos.ts';
import colleges from '../src/data/colleges.json' with { type: 'json' };

test('every public institution has a retained photo with complete attribution', () => {
  for (const college of colleges) {
    const photo = campusPhoto(college.slug);
    assert.ok(photo, college.slug);
    assert.match(photo.src, /^\/images\/campuses\/[a-z0-9-]+\.jpg$/);
    const bytes = readFileSync(new URL('../public' + photo.src, import.meta.url));
    assert.equal(bytes[0], 0xff);
    assert.equal(bytes[1], 0xd8);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), photo.sha256);
    assert.ok(photo.author && photo.caption && photo.changes);
    assert.match(photo.sourceUrl, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    assert.match(photo.license, /^(CC BY(?:-SA)? [34]\.0|Public domain)$/);
    assert.match(photo.licenseUrl, /^https:\/\//);
  }
  assert.equal(campusPhoto('unknown-campus'), undefined);
});

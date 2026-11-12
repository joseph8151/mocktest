import test from 'node:test';
import assert from 'node:assert/strict';
import { stripeVerify, portoneVerifyWebhook } from '../src/lib/payments.js';
import { scoreAttempt, levelFromPct, adaptDifficulty } from '../src/lib/exam.js';
import { hmacSha256, hex, b64 } from '../src/lib/util.js';

test('stripe signature: valid, tampered, stale', async () => {
  const secret = 'whsec_abc', raw = '{"id":"evt_1"}', t = Math.floor(Date.now() / 1000);
  const sig = hex(await hmacSha256(new TextEncoder().encode(secret), `${t}.${raw}`));
  assert.equal(await stripeVerify(secret, raw, `t=${t},v1=${sig}`), true);
  assert.equal(await stripeVerify(secret, raw + 'x', `t=${t},v1=${sig}`), false);
  assert.equal(await stripeVerify(secret, raw, `t=${t - 1000},v1=${sig}`), false);
  assert.equal(await stripeVerify(secret, raw, null), false);
});

test('portone (standard webhooks) signature', async () => {
  const keyBytes = crypto.getRandomValues(new Uint8Array(24)), secret = 'whsec_' + b64(keyBytes);
  const raw = '{"type":"Transaction.Paid"}', id = 'msg_1', ts = String(Math.floor(Date.now() / 1000));
  const sig = 'v1,' + b64(await hmacSha256(keyBytes, `${id}.${ts}.${raw}`));
  const mk = (s) => new Headers({ 'webhook-id': id, 'webhook-timestamp': ts, 'webhook-signature': s });
  assert.equal(await portoneVerifyWebhook(secret, raw, mk(sig)), true);
  assert.equal(await portoneVerifyWebhook(secret, raw + ' ', mk(sig)), false);
  assert.equal(await portoneVerifyWebhook(secret, raw, mk('v1,AAAA')), false);
});

test('adaptive difficulty is clamped', () => {
  assert.equal(adaptDifficulty(5, true), 5); assert.equal(adaptDifficulty(1, false), 1); assert.equal(adaptDifficulty(3, true), 4);
});

test('WIDA levels and composite weighting', () => {
  assert.equal(levelFromPct(0.95), 6); assert.equal(levelFromPct(0.1), 1);
  const a = (section, kind, correct, ms) => ({ section, kind, correct, manual_score: ms ?? null, difficulty: 3 });
  const rows = [a('listening', 'mcq', 1), a('reading', 'mcq', 1), a('writing', 'text', null, 4), a('speaking', 'audio', null, 2)];
  const s = scoreAttempt('WIDA', rows);
  assert.equal(s.sections.listening.level, 6);
  assert.equal(s.composites.overall, Math.round((0.15 * 6 + 0.15 * 2 + 0.35 * 6 + 0.35 * 4) * 10) / 10);
  assert.equal(scoreAttempt('WIDA', rows.slice(0, 3)).pendingManual, true);
});

test('CAT4 SAS / stanine', () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({ section: 'verbal', correct: i < 5 ? 1 : 0, difficulty: 3 }));
  const s = scoreAttempt('CAT4', rows).sections.verbal;
  assert.equal(s.sas, 100); assert.equal(s.stanine, 5);
});

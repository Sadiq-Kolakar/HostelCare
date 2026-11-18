import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const base = process.env.HCMS_TEST_BASE_URL || 'http://localhost:4000/api';
const request = async (path, { token, ...options } = {}) => {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers },
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
};

test('community board privacy, vote integrity, role access and ordering', async () => {
  const suffix = randomUUID();
  const emailA = `board-a-${suffix}@test.invalid`;
  const emailB = `board-b-${suffix}@test.invalid`;
  let studentA;
  let studentB;
  const complaintIds = [];
  try {
    const signupA = await request('/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Board Test A', email: emailA, password: 'test-password-123', room: 'TEST-ROOM' }) });
    const signupB = await request('/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Board Test B', email: emailB, password: 'test-password-123', room: 'TEST-ROOM' }) });
    assert.equal(signupA.status, 201);
    assert.equal(signupB.status, 201);
    studentA = signupA.body.user.id;
    studentB = signupB.body.user.id;
    const tokenA = signupA.body.token;
    const tokenB = signupB.body.token;

    const created = await request('/complaints', { token: tokenA, method: 'POST', body: JSON.stringify({ category: 'Plumbing', title: `Board fixture ${suffix}`, description: 'Shared washroom tap is leaking.', attachmentUrl: 'https://example.invalid/private-photo' }) });
    assert.equal(created.status, 201);
    complaintIds.push(created.body.id);
    const tracked = await request(`/complaints/${created.body.id}`, { token: tokenA });
    assert.equal(tracked.status, 200);
    assert.equal(tracked.body.title, created.body.title);

    const board = await request('/complaints/board?sort=popular', { token: tokenB });
    assert.equal(board.status, 200);
    const card = board.body.find(row => row.id === created.body.id);
    assert.ok(card, 'newly submitted complaint appears on the board');
    assert.equal(card.vote_count, 0);
    assert.equal(card.has_voted, false);
    for (const privateField of ['student_id','student_name','student_room','attachment_url','email','room']) assert.equal(Object.hasOwn(card, privateField), false, `${privateField} is not exposed`);

    const firstVote = await request(`/complaints/${created.body.id}/upvote`, { token: tokenA, method: 'POST' });
    const duplicateVote = await request(`/complaints/${created.body.id}/upvote`, { token: tokenA, method: 'POST' });
    assert.equal(firstVote.status, 200);
    assert.equal(duplicateVote.body.vote_count, 1, 'repeated vote request remains unique');
    const secondStudentVote = await request(`/complaints/${created.body.id}/upvote`, { token: tokenB, method: 'POST' });
    assert.equal(secondStudentVote.body.vote_count, 2, 'another student can vote for the same complaint');
    const removed = await request(`/complaints/${created.body.id}/upvote`, { token: tokenA, method: 'DELETE' });
    assert.equal(removed.body.vote_count, 1);
    const afterRemoval = await request('/complaints/board?sort=popular', { token: tokenB });
    assert.equal(afterRemoval.body.find(row => row.id === created.body.id).has_voted, true);

    const otherStudentPrivateRead = await request(`/complaints/${created.body.id}`, { token: tokenB });
    assert.equal(otherStudentPrivateRead.status, 403, 'students cannot open another student’s private complaint detail');

    const popular = await request('/complaints/board?sort=popular', { token: tokenA });
    for (let index = 1; index < popular.body.length; index++) assert.ok(popular.body[index-1].vote_count >= popular.body[index].vote_count, 'popular sorting is descending by votes');

    const unauthenticatedRead = await request('/complaints/board');
    const unauthenticatedVote = await request(`/complaints/${created.body.id}/upvote`, { method: 'POST' });
    assert.equal(unauthenticatedRead.status, 401);
    assert.equal(unauthenticatedVote.status, 401);

    const newest = await request('/complaints/board?sort=newest', { token: tokenA });
    const oldest = await request('/complaints/board?sort=oldest', { token: tokenA });
    assert.equal(newest.status, 200);
    assert.equal(oldest.status, 200);
    for (let index = 1; index < newest.body.length; index++) assert.ok(new Date(newest.body[index-1].created_at) >= new Date(newest.body[index].created_at), 'newest sorting is descending');
    for (let index = 1; index < oldest.body.length; index++) assert.ok(new Date(oldest.body[index-1].created_at) <= new Date(oldest.body[index].created_at), 'oldest sorting is ascending');

    if (process.env.WARDEN_PASSWORD) {
      const warden = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'warden@hcms.local', password: process.env.WARDEN_PASSWORD }) });
      assert.equal(warden.status, 200, 'test can authenticate the configured warden');
      const denied = await request(`/complaints/${created.body.id}/upvote`, { token: warden.body.token, method: 'POST' });
      assert.equal(denied.status, 403, 'warden cannot use student-only voting endpoint');
    }
  } finally {
    try {
      if (complaintIds.length) await pool.query('DELETE FROM complaints WHERE id = ANY($1::uuid[])', [complaintIds]);
      if (studentA || studentB) await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [[studentA, studentB].filter(Boolean)]);
    } finally { await pool.end(); }
  }
});

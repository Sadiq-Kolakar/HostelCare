import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { randomBytes } from 'node:crypto';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const app = express();
const PORT = process.env.PORT || 4000;
const SECRET = process.env.JWT_SECRET || 'development-only-secret-change-me';
app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

const query = (text, values) => pool.query(text, values);
const tokenFor = user => jwt.sign({ sub: user.id, role: user.role, name: user.name, email: user.email }, SECRET, { expiresIn: '12h' });
const auth = (req, res, next) => {
  try {
    const value = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!value) return res.status(401).json({ error: 'Sign in required' });
    req.user = jwt.verify(value, SECRET);
    next();
  } catch { return res.status(401).json({ error: 'Session expired; sign in again' }); }
};
const allow = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'You do not have access to this action' });
const notify = async (userId, complaintId, message) => query('INSERT INTO notifications(user_id, complaint_id, message) VALUES($1,$2,$3)', [userId, complaintId, message]);
const addHistory = async (complaintId, actorId, status, remarks) => query('INSERT INTO complaint_history(complaint_id,actor_id,status,remarks) VALUES($1,$2,$3,$4)', [complaintId, actorId, status, remarks || null]);
const overdue = "created_at < now() - interval '48 hours' AND status NOT IN ('Closed')";

app.get('/api/health', async (_req, res) => {
  try { await query('SELECT 1'); res.json({ status: 'ok' }); }
  catch { res.status(503).json({ status: 'database unavailable' }); }
});

async function ensureWarden() {
  if (!process.env.WARDEN_PASSWORD || process.env.WARDEN_PASSWORD.length < 12) throw new Error('Set WARDEN_PASSWORD to at least 12 characters');
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('Set JWT_SECRET to at least 32 characters');
  const email = 'warden@hcms.local';
  const exists = await query('SELECT id FROM users WHERE email=$1', [email]);
  if (!exists.rowCount) {
    const hash = await bcrypt.hash(process.env.WARDEN_PASSWORD, 12);
    await query('INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4)', ['Hostel Warden', email, hash, 'warden']);
    console.log(`Created initial warden account: ${email}`);
  }
}

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { name, email, password, room } = req.body;
    if (!name?.trim() || !email?.trim() || !/^\S+@\S+\.\S+$/.test(email) || !password || password.length < 8) return res.status(400).json({ error: 'Enter a name, valid email, and password of at least 8 characters' });
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await query('INSERT INTO users(name,email,password_hash,role,room) VALUES($1,$2,$3,$4,$5) RETURNING id,name,email,role,room', [name.trim(), email.toLowerCase().trim(), hash, 'student', room?.trim() || null]);
    const user = rows[0]; res.status(201).json({ token: tokenFor(user), user });
  } catch (err) { if (err.code === '23505') return res.status(409).json({ error: 'An account with that email already exists' }); next(err); }
});
app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { rows } = await query('SELECT id,name,email,password_hash,role,room FROM users WHERE email=$1', [String(email || '').toLowerCase().trim()]);
    if (!rows[0] || !await bcrypt.compare(password || '', rows[0].password_hash)) return res.status(401).json({ error: 'Email or password is incorrect' });
    const { password_hash, ...user } = rows[0]; res.json({ token: tokenFor(user), user });
  } catch (err) { next(err); }
});
app.get('/api/me', auth, async (req, res, next) => {
  try { const { rows } = await query('SELECT id,name,email,role,room FROM users WHERE id=$1', [req.user.sub]); res.json(rows[0] || null); }
  catch (err) { next(err); }
});

app.get('/api/staff', auth, allow('warden'), async (_req, res, next) => {
  try { const { rows } = await query("SELECT id,name,email,created_at FROM users WHERE role='staff' ORDER BY name"); res.json(rows); }
  catch (err) { next(err); }
});
app.post('/api/staff', auth, allow('warden'), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '') || !password || password.length < 8) return res.status(400).json({ error: 'Name, valid email, and password of at least 8 characters are required' });
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await query("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'staff') RETURNING id,name,email,created_at", [name.trim(), email.toLowerCase().trim(), hash]); res.status(201).json(rows[0]);
  } catch (err) { if (err.code === '23505') return res.status(409).json({ error: 'That email is already in use' }); next(err); }
});

app.get('/api/complaints', auth, async (req, res, next) => {
  try {
    const { status, category, search } = req.query;
    const params = []; const where = [];
    if (req.user.role === 'student') { params.push(req.user.sub); where.push(`c.student_id=$${params.length}`); }
    if (req.user.role === 'staff') { params.push(req.user.sub); where.push(`c.assigned_to=$${params.length}`); }
    if (status && status !== 'All') { params.push(status); where.push(`c.status=$${params.length}`); }
    if (category && category !== 'All') { params.push(category); where.push(`c.category=$${params.length}`); }
    if (search) { params.push(`%${search}%`); where.push(`(c.complaint_code ILIKE $${params.length} OR c.title ILIKE $${params.length} OR u.name ILIKE $${params.length})`); }
    const sql = `SELECT c.*, u.name AS student_name, u.room AS student_room, s.name AS staff_name, (c.${overdue}) AS is_overdue, COALESCE(votes.vote_count,0)::int AS vote_count FROM complaints c JOIN users u ON u.id=c.student_id LEFT JOIN users s ON s.id=c.assigned_to LEFT JOIN (SELECT complaint_id,COUNT(*)::int AS vote_count FROM complaint_votes GROUP BY complaint_id) votes ON votes.complaint_id=c.id ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY (c.${overdue}) DESC,c.created_at DESC`;
    const { rows } = await query(sql, params); res.json(rows);
  } catch (err) { next(err); }
});
const activeBoardStatuses = ['Submitted','Under Review','Assigned','In Progress','Reopened'];
const voteSummarySql = `SELECT COUNT(*)::int AS vote_count FROM complaint_votes WHERE complaint_id=$1`;

app.get('/api/complaints/board', auth, allow('student'), async (req, res, next) => {
  try {
    const sort = req.query.sort || 'popular';
    const sortSql = { popular: 'vote_count DESC, c.created_at DESC', newest: 'c.created_at DESC', oldest: 'c.created_at ASC' }[sort];
    if (!sortSql) return res.status(400).json({ error: 'Choose popular, newest, or oldest sorting' });
    const categories = ['Electrical','Plumbing','Internet','Furniture','Cleaning','Other'];
    if (req.query.category && req.query.category !== 'All' && !categories.includes(req.query.category)) return res.status(400).json({ error: 'Choose a valid category' });
    if (req.query.status && req.query.status !== 'All' && !activeBoardStatuses.includes(req.query.status)) return res.status(400).json({ error: 'Choose a valid active status' });
    const values = [req.user.sub];
    const filters = ["c.status IN ('Submitted','Under Review','Assigned','In Progress','Reopened')"];
    if (req.query.category && req.query.category !== 'All') { values.push(req.query.category); filters.push(`c.category=$${values.length}`); }
    if (req.query.status && req.query.status !== 'All') { values.push(req.query.status); filters.push(`c.status=$${values.length}`); }
    const { rows } = await query(`
      SELECT c.id,c.complaint_code,c.category,c.title,c.description,c.status,c.created_at,
        COALESCE(v.vote_count,0)::int AS vote_count,
        EXISTS(SELECT 1 FROM complaint_votes mine WHERE mine.complaint_id=c.id AND mine.student_id=$1) AS has_voted
      FROM complaints c
      LEFT JOIN (SELECT complaint_id,COUNT(*)::int AS vote_count FROM complaint_votes GROUP BY complaint_id) v ON v.complaint_id=c.id
      WHERE ${filters.join(' AND ')} ORDER BY ${sortSql}`, values);
    res.json(rows);
  } catch (err) { next(err); }
});

app.post('/api/complaints/:id/upvote', auth, allow('student'), async (req, res, next) => {
  try {
    const inserted = await query(`INSERT INTO complaint_votes(complaint_id,student_id)
      SELECT id,$2 FROM complaints WHERE id=$1 AND status IN ('Submitted','Under Review','Assigned','In Progress','Reopened')
      ON CONFLICT (complaint_id,student_id) DO NOTHING RETURNING id`, [req.params.id, req.user.sub]);
    if (!inserted.rowCount) {
      const found = await query('SELECT status FROM complaints WHERE id=$1', [req.params.id]);
      if (!found.rowCount) return res.status(404).json({ error: 'Complaint not found' });
      if (!activeBoardStatuses.includes(found.rows[0].status)) return res.status(409).json({ error: 'Voting is closed for this complaint' });
    }
    const count = await query(voteSummarySql, [req.params.id]);
    res.json({ voted: true, vote_count: count.rows[0].vote_count });
  } catch (err) { next(err); }
});

app.delete('/api/complaints/:id/upvote', auth, allow('student'), async (req, res, next) => {
  try {
    const removed = await query('DELETE FROM complaint_votes WHERE complaint_id=$1 AND student_id=$2 RETURNING id', [req.params.id, req.user.sub]);
    if (!removed.rowCount) {
      const found = await query('SELECT id FROM complaints WHERE id=$1', [req.params.id]);
      if (!found.rowCount) return res.status(404).json({ error: 'Complaint not found' });
    }
    const count = await query(voteSummarySql, [req.params.id]);
    res.json({ voted: false, vote_count: count.rows[0].vote_count });
  } catch (err) { next(err); }
});

app.post('/api/complaints', auth, allow('student'), async (req, res, next) => {
  try {
    const { category, title, description, attachmentUrl } = req.body;
    const categories = ['Electrical','Plumbing','Internet','Furniture','Cleaning','Other'];
    if (!categories.includes(category) || !title?.trim() || title.length > 140 || !description?.trim() || description.length > 3000) return res.status(400).json({ error: 'Choose a category and provide a title (140 characters max) and description (3000 characters max)' });
    if (attachmentUrl && !/^https?:\/\//i.test(attachmentUrl)) return res.status(400).json({ error: 'Attachment must be a valid http or https URL' });
    const code = `HC-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
    const { rows } = await query('INSERT INTO complaints(complaint_code,student_id,category,title,description,attachment_url) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [code, req.user.sub, category, title.trim(), description.trim(), attachmentUrl || null]);
    await addHistory(rows[0].id, req.user.sub, 'Submitted', 'Complaint submitted');
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});
app.get('/api/complaints/:id', auth, async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT c.*,u.name AS student_name,u.room AS student_room,s.name AS staff_name,(c.${overdue}) AS is_overdue FROM complaints c JOIN users u ON u.id=c.student_id LEFT JOIN users s ON s.id=c.assigned_to WHERE c.id=$1`, [req.params.id]);
    const complaint = rows[0]; if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
    if (req.user.role === 'student' && complaint.student_id !== req.user.sub) return res.status(403).json({ error: 'You can only view your own complaints' });
    if (req.user.role === 'staff' && complaint.assigned_to !== req.user.sub) return res.status(403).json({ error: 'This complaint is not assigned to you' });
    const history = await query('SELECT h.*,u.name AS actor_name FROM complaint_history h LEFT JOIN users u ON u.id=h.actor_id WHERE complaint_id=$1 ORDER BY h.created_at', [req.params.id]);
    res.json({ ...complaint, history: history.rows });
  } catch (err) { next(err); }
});
app.patch('/api/complaints/:id', auth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query('SELECT * FROM complaints WHERE id=$1 FOR UPDATE', [req.params.id]);
    const complaint = found.rows[0]; if (!complaint) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Complaint not found' }); }
    if (req.user.role === 'student') {
      if (complaint.student_id !== req.user.sub) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'You can only change your own complaints' }); }
      if (req.body.action !== 'reopen' || !['Resolved','Closed'].includes(complaint.status)) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Only resolved complaints can be reopened' }); }
      await client.query("UPDATE complaints SET status='Reopened',resolved_at=NULL,updated_at=now() WHERE id=$1", [complaint.id]);
      await client.query("INSERT INTO complaint_history(complaint_id,actor_id,status,remarks) VALUES($1,$2,'Reopened',$3)", [complaint.id,req.user.sub,req.body.remarks || 'Student requested reopening']);
      const wards = await client.query("SELECT id FROM users WHERE role='warden'");
      for (const w of wards.rows) await client.query('INSERT INTO notifications(user_id,complaint_id,message) VALUES($1,$2,$3)', [w.id,complaint.id,`${complaint.complaint_code} was reopened by the student`]);
    } else if (req.user.role === 'warden') {
      const priority = req.body.priority ?? complaint.priority;
      if (!['Low','Medium','High'].includes(priority)) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Invalid priority' }); }
      let assigned = complaint.assigned_to;
      if (req.body.assignedTo !== undefined) {
        if (req.body.assignedTo === null || req.body.assignedTo === '') assigned = null;
        else {
          const staff = await client.query("SELECT id FROM users WHERE id=$1 AND role='staff'", [req.body.assignedTo]);
          if (!staff.rowCount) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Choose a valid staff account' }); }
          assigned = req.body.assignedTo;
        }
      }
      const status = req.body.status ?? (assigned && complaint.status === 'Submitted' ? 'Assigned' : complaint.status);
      if (!['Submitted','Under Review','Assigned','In Progress','Resolved','Closed','Reopened'].includes(status)) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Invalid status' }); }
      await client.query('UPDATE complaints SET priority=$1,assigned_to=$2,status=$3,resolved_at=CASE WHEN $3 IN (\'Resolved\',\'Closed\') THEN COALESCE(resolved_at,now()) ELSE NULL END,updated_at=now() WHERE id=$4', [priority,assigned,status,complaint.id]);
      if (assigned && assigned !== complaint.assigned_to) await client.query('INSERT INTO notifications(user_id,complaint_id,message) VALUES($1,$2,$3)', [assigned,complaint.id,`New assignment: ${complaint.complaint_code} — ${complaint.title}`]);
      if (status !== complaint.status) {
        await client.query('INSERT INTO complaint_history(complaint_id,actor_id,status,remarks) VALUES($1,$2,$3,$4)', [complaint.id,req.user.sub,status,req.body.remarks || 'Updated by warden']);
        await client.query('INSERT INTO notifications(user_id,complaint_id,message) VALUES($1,$2,$3)', [complaint.student_id,complaint.id,`${complaint.complaint_code} status changed to ${status}`]);
      }
    } else if (req.user.role === 'staff') {
      if (complaint.assigned_to !== req.user.sub) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'This complaint is not assigned to you' }); }
      const status = req.body.status;
      if (!['In Progress','Resolved'].includes(status)) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Staff can mark work In Progress or Resolved' }); }
      await client.query('UPDATE complaints SET status=$1,resolved_at=CASE WHEN $1=\'Resolved\' THEN now() ELSE NULL END,updated_at=now() WHERE id=$2', [status,complaint.id]);
      await client.query('INSERT INTO complaint_history(complaint_id,actor_id,status,remarks) VALUES($1,$2,$3,$4)', [complaint.id,req.user.sub,status,req.body.remarks || null]);
      await client.query('INSERT INTO notifications(user_id,complaint_id,message) VALUES($1,$2,$3)', [complaint.student_id,complaint.id,`${complaint.complaint_code} status changed to ${status}`]);
    }
    await client.query('COMMIT'); res.json({ ok: true });
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});
app.post('/api/complaints/:id/feedback', auth, allow('student'), async (req, res, next) => {
  try {
    const { rating, feedback } = req.body;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    const { rows } = await query("UPDATE complaints SET feedback=$1,feedback_rating=$2,updated_at=now() WHERE id=$3 AND student_id=$4 AND status IN ('Resolved','Closed') RETURNING id", [feedback?.trim() || null,rating,req.params.id,req.user.sub]);
    if (!rows[0]) return res.status(400).json({ error: 'Feedback is available only for your resolved complaints' }); res.json({ ok: true });
  } catch (err) { next(err); }
});

app.get('/api/notifications', auth, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100', [req.user.sub]);
    if (req.user.role === 'warden') {
      const overdueRows = await query(`SELECT id,complaint_code FROM complaints WHERE ${overdue} ORDER BY created_at`);
      const existing = new Set(rows.filter(n => n.message.startsWith('OVERDUE:')).map(n => n.complaint_id));
      for (const c of overdueRows.rows) if (!existing.has(c.id)) await notify(req.user.sub,c.id,`OVERDUE: ${c.complaint_code} has been open for more than 48 hours`);
      if (overdueRows.rowCount) {
        const refreshed = await query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100', [req.user.sub]);
        return res.json(refreshed.rows);
      }
    }
    res.json(rows);
  } catch (err) { next(err); }
});
app.patch('/api/notifications/:id/read', auth, async (req, res, next) => {
  try { await query('UPDATE notifications SET read_at=now() WHERE id=$1 AND user_id=$2', [req.params.id,req.user.sub]); res.json({ ok: true }); }
  catch (err) { next(err); }
});
app.get('/api/dashboard', auth, async (req, res, next) => {
  try {
    const filter = req.user.role === 'student' ? 'WHERE student_id=$1' : req.user.role === 'staff' ? 'WHERE assigned_to=$1' : '';
    const args = ['student','staff'].includes(req.user.role) ? [req.user.sub] : [];
    const totals = await query(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER (WHERE status NOT IN ('Closed','Resolved'))::int AS open,COUNT(*) FILTER (WHERE status='Resolved')::int AS resolved,COUNT(*) FILTER (WHERE ${overdue})::int AS overdue FROM complaints ${filter}`, args);
    const byCategory = await query(`SELECT category,COUNT(*)::int AS count FROM complaints ${filter} GROUP BY category ORDER BY count DESC`, args);
    res.json({ ...totals.rows[0], byCategory: byCategory.rows });
  } catch (err) { next(err); }
});

app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Something went wrong. Please try again.' }); });
await ensureWarden();
app.listen(PORT, () => console.log(`HCMS API listening on ${PORT}`));

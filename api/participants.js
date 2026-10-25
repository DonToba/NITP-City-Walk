const API = 'https://api.github.com';
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const headers = () => ({
  Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28'
});
const owner = () => process.env.GITHUB_OWNER;
const repo = () => process.env.GITHUB_REPO;
const branch = () => process.env.GITHUB_BRANCH || 'main';
const configuredPath = () => (process.env.GITHUB_DATA_PATH || 'data/participants.json').replace(/^\/+|\/+$/g, '');
const directory = () => configuredPath().split('/').slice(0, -1).join('/');
const baseName = () => configuredPath().split('/').pop().replace(/\.json$/i, '');
const filePath = name => [directory(), name].filter(Boolean).join('/');
const apiUrl = path => `${API}/repos/${owner()}/${repo()}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch())}`;

async function github(path) {
  const r = await fetch(apiUrl(path), { headers: headers() });
  if (r.status === 404) return null;
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || `GitHub read failed (${r.status})`);
  return data;
}
function isParticipantFile(name) {
  const escaped = baseName().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}(?:-\\d{3,})?\\.json$`, 'i').test(name);
}
function sortFiles(files) {
  const prefix = baseName().toLowerCase();
  return files.filter(f => isParticipantFile(f.name) && f.type === 'file')
    .sort((a, b) => {
      const index = name => {
        const stem = name.replace(/\.json$/i, '').toLowerCase();
        if (stem === prefix) return 0;
        const m = stem.match(/-(\d+)$/);
        return m ? Number(m[1]) : 0;
      };
      return index(a.name) - index(b.name);
    });
}
async function listParticipantFiles() {
  const dirPath = directory();
  const result = await github(dirPath || '');
  if (!result) return [];
  if (!Array.isArray(result)) throw new Error('Participant data path must point to a JSON file inside a folder.');
  return sortFiles(result);
}
function decodeFile(file) {
  const decoded = Buffer.from((file.content || '').replace(/\n/g, ''), 'base64').toString('utf8');
  const parsed = JSON.parse(decoded || '{"participants":[]}');
  return { name: file.name, path: file.path, sha: file.sha, participants: Array.isArray(parsed) ? parsed : (parsed.participants || []) };
}
async function loadAll() {
  let files = await listParticipantFiles();
  // Backwards-compatible initial file creation: an empty data directory is valid.
  const documents = [];
  for (const item of files) {
    const full = await github(item.path);
    if (full) documents.push(decodeFile(full));
  }
  if (!documents.length) {
    documents.push({ name: `${baseName()}.json`, path: configuredPath(), sha: null, participants: [] });
  }
  return documents;
}
function serialise(participants) {
  return JSON.stringify({ updatedAt: new Date().toISOString(), participants }, null, 2);
}
async function saveFile(path, participants, sha, message) {
  const content = serialise(participants);
  if (Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) {
    throw new Error('This participant data file exceeds the 20 MB safety limit.');
  }
  const body = {
    message,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch: branch()
  };
  if (sha) body.sha = sha;
  const r = await fetch(apiUrl(path).replace(/\?ref=.*$/, ''), {
    method: 'PUT',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || `GitHub write failed (${r.status})`);
  return data;
}
function nextFileName(files) {
  const base = `${baseName()}.json`;
  const indexes = files.map(f => {
    const m = f.name.match(/-(\d+)\.json$/i);
    return m ? Number(m[1]) : 0;
  });
  const next = Math.max(0, ...indexes) + 1;
  return `${baseName()}-${String(next).padStart(3, '0')}.json`;
}
function publicRecord(p) {
  return {
    id: p.id,
    gender: p.gender,
    chapter: p.chapter,
    membershipCadre: p.membershipCadre || '',
    status: p.status || 'registered',
    distanceKm: p.distanceKm || 0,
    durationSeconds: p.durationSeconds || 0,
    averageSpeedKmh: p.averageSpeedKmh || 0,
    registeredAt: p.registeredAt,
    completedAt: p.completedAt
  };
}
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!process.env.GITHUB_TOKEN || !owner() || !repo()) {
    return res.status(500).json({ error: 'Server storage is not configured. Add the GitHub environment variables in Vercel.' });
  }
  try {
    if (req.method === 'GET') {
      const docs = await loadAll();
      return res.status(200).json({ participants: docs.flatMap(d => d.participants).map(publicRecord) });
    }
    if (req.method === 'POST') {
      const p = req.body;
      if (!p || !p.id || !p.firstName || !p.gender || !p.chapter || !p.membershipCadre) {
        return res.status(400).json({ error: 'Please provide first name, gender, chapter and membership cadre.' });
      }
      if (!['Male', 'Female'].includes(p.gender)) return res.status(400).json({ error: 'Invalid gender value.' });
      if (!['Fellow', 'Full Member', 'Graduate Member', 'Student'].includes(p.membershipCadre)) {
        return res.status(400).json({ error: 'Invalid membership cadre.' });
      }
      const docs = await loadAll();
      if (docs.some(d => d.participants.some(x => x.id === p.id))) {
        return res.status(409).json({ error: 'This registration already exists.' });
      }
      const latest = docs[docs.length - 1];
      const updated = [...latest.participants, { ...p, track: [] }];
      if (Buffer.byteLength(serialise(updated), 'utf8') <= MAX_FILE_BYTES) {
        await saveFile(latest.path, updated, latest.sha, 'Add city walk participant registration');
      } else {
        const files = await listParticipantFiles();
        const name = nextFileName(files);
        await saveFile(filePath(name), [{ ...p, track: [] }], null, 'Create participant data segment');
      }
      return res.status(201).json({ ok: true, id: p.id });
    }
    if (req.method === 'PATCH') {
      const p = req.body;
      if (!p?.id) return res.status(400).json({ error: 'Participant ID is required.' });
      const docs = await loadAll();
      const doc = docs.find(d => d.participants.some(x => x.id === p.id));
      if (!doc) return res.status(404).json({ error: 'Registration not found.' });
      const participants = doc.participants.map(existing => {
        if (existing.id !== p.id) return existing;
        const updated = { ...existing };
        for (const key of ['status', 'completedAt', 'distanceKm', 'durationSeconds', 'averageSpeedKmh', 'track']) {
          if (p[key] !== undefined) updated[key] = p[key];
        }
        return updated;
      });
      if (Buffer.byteLength(serialise(participants), 'utf8') <= MAX_FILE_BYTES) {
        await saveFile(doc.path, participants, doc.sha, 'Update city walk tracking record');
      } else {
        // A large GPS track can push a segment over the limit. Move this record
        // to a new segment rather than allowing any file to exceed 20 MB.
        const movedRecord = participants.find(x => x.id === p.id);
        const remaining = participants.filter(x => x.id !== p.id);
        await saveFile(doc.path, remaining, doc.sha, 'Move large walk record to a new participant data segment');
        const files = await listParticipantFiles();
        await saveFile(filePath(nextFileName(files)), [movedRecord], null, 'Store large walk record in a new participant data segment');
      }
      // Return aggregate records from every segment so the dashboard stays in sync.
      const refreshed = await loadAll();
      return res.status(200).json({ ok: true, participants: refreshed.flatMap(d => d.participants).map(publicRecord) });
    }
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Unexpected server error.' });
  }
}

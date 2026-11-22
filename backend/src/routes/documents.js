import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import supabase from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { sendPushToUser } from '../utils/webpush.js';

const router = Router();
const BUCKET = 'documents';
const MAX_SIZE = 10 * 1024 * 1024; // 10 Mo
const CATEGORIES = ['administratif', 'competitions', 'stages', 'sante', 'autre'];

// Types de fichiers acceptés → extension utilisée dans le stockage
const ALLOWED = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/vnd.oasis.opendocument.spreadsheet': 'ods',
  'text/plain': 'txt',
  'text/csv': 'csv',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, Boolean(ALLOWED[file.mimetype])),
});

// Multer décode le nom en latin1 : on le remet en UTF-8 (accents)
function cleanName(name = '') {
  let n = name;
  try { n = Buffer.from(name, 'latin1').toString('utf8'); } catch { /* garde l'original */ }
  return n.replace(/[\\/\u0000-\u001f]/g, '').slice(0, 200) || 'document';
}

const canEdit = (user, doc) => user.role === 'coach' || doc.uploaded_by === user.id;

// GET /api/documents — tous les documents (épinglés d'abord, puis les plus récents)
router.get('/', requireAuth, async (_req, res) => {
  const { data, error } = await supabase
    .from('documents')
    .select('id, title, category, file_name, mime_type, size_bytes, uploaded_by, uploader_name, uploader_role, pinned, created_at')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/documents — ajouter un document (coach ou archer)
router.post('/', requireAuth, (req, res, next) => {
  upload.single('file')(req, res, err => {
    if (err?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Fichier trop lourd (10 Mo maximum)' });
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Fichier manquant ou format non accepté (PDF, Word, Excel, PowerPoint, image, texte)' });
  }
  const fileName = cleanName(req.file.originalname);
  const title    = (req.body.title || '').trim().slice(0, 150) || fileName.replace(/\.[^.]+$/, '');
  const category = CATEGORIES.includes(req.body.category) ? req.body.category : 'autre';
  const notify   = req.body.notify === 'true' || req.body.notify === true;

  const filePath = `pole/${randomUUID()}.${ALLOWED[req.file.mimetype]}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
  if (upErr) return res.status(500).json({ error: `Envoi du fichier impossible : ${upErr.message}` });

  const { data, error } = await supabase
    .from('documents')
    .insert({
      title,
      category,
      file_path: filePath,
      file_name: fileName,
      mime_type: req.file.mimetype,
      size_bytes: req.file.size,
      uploaded_by: req.user.id,
      uploader_name: req.user.name,
      uploader_role: req.user.role,
    })
    .select('id, title, category, file_name, mime_type, size_bytes, uploaded_by, uploader_name, uploader_role, pinned, created_at')
    .single();

  if (error) {
    await supabase.storage.from(BUCKET).remove([filePath]);
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json(data);

  // Notification au reste du groupe (sans bloquer la réponse)
  if (notify) {
    (async () => {
      const { data: others } = await supabase.from('users').select('id').neq('id', req.user.id);
      if (!others?.length) return;
      const payload = {
        title: `📁 Nouveau document`,
        body: `${req.user.name} a ajouté « ${title.length > 70 ? title.slice(0, 67) + '…' : title} »`,
        tag: `document-${data.id}`,
        url: '/',
      };
      await Promise.allSettled(others.map(u => sendPushToUser(u.id, payload)));
    })().catch(() => {});
  }
});

// GET /api/documents/:id/url — lien temporaire (5 min) pour ouvrir ou télécharger
router.get('/:id/url', requireAuth, async (req, res) => {
  const { data: doc } = await supabase
    .from('documents').select('file_path, file_name').eq('id', req.params.id).single();
  if (!doc) return res.status(404).json({ error: 'Document introuvable' });

  const download = req.query.download === '1' ? doc.file_name : undefined;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.file_path, 300, download ? { download } : undefined);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ url: data.signedUrl });
});

// PATCH /api/documents/:id — renommer / changer de rubrique (auteur ou coach), épingler (coach)
router.patch('/:id', requireAuth, async (req, res) => {
  const { data: doc } = await supabase
    .from('documents').select('id, uploaded_by').eq('id', req.params.id).single();
  if (!doc) return res.status(404).json({ error: 'Document introuvable' });
  if (!canEdit(req.user, doc)) return res.status(403).json({ error: 'Seul l\'auteur ou le coach peut modifier ce document' });

  const changes = {};
  if (typeof req.body.title === 'string' && req.body.title.trim()) changes.title = req.body.title.trim().slice(0, 150);
  if (CATEGORIES.includes(req.body.category)) changes.category = req.body.category;
  if (typeof req.body.pinned === 'boolean') {
    if (req.user.role !== 'coach') return res.status(403).json({ error: 'Seul le coach peut épingler un document' });
    changes.pinned = req.body.pinned;
  }
  if (!Object.keys(changes).length) return res.status(400).json({ error: 'Rien à modifier' });

  const { data, error } = await supabase
    .from('documents').update(changes).eq('id', doc.id)
    .select('id, title, category, file_name, mime_type, size_bytes, uploaded_by, uploader_name, uploader_role, pinned, created_at')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/documents/:id — l'auteur supprime le sien, le coach peut tout supprimer
router.delete('/:id', requireAuth, async (req, res) => {
  const { data: doc } = await supabase
    .from('documents').select('id, uploaded_by, file_path').eq('id', req.params.id).single();
  if (!doc) return res.status(404).json({ error: 'Document introuvable' });
  if (!canEdit(req.user, doc)) return res.status(403).json({ error: 'Seul l\'auteur ou le coach peut supprimer ce document' });

  const { error } = await supabase.from('documents').delete().eq('id', doc.id);
  if (error) return res.status(500).json({ error: error.message });
  await supabase.storage.from(BUCKET).remove([doc.file_path]);
  res.json({ ok: true });
});

export default router;

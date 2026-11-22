import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import supabase from '../supabase.js';
import { requireAuth, requireCoach } from '../middleware/auth.js';

// Vue « Année » : compétitions et stages de la saison, par archer.
const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = ['competition', 'stage'];

function clean(body) {
  const ev = {
    title: String(body.title || '').trim(),
    kind: KINDS.includes(body.kind) ? body.kind : 'competition',
    color: /^#[0-9a-fA-F]{6}$/.test(body.color || '') ? body.color : '#3b82f6',
    start_date: body.start_date,
    end_date: body.end_date || body.start_date,
    notes: body.notes?.trim() || null,
  };
  if (!ev.title) return { error: 'Nom requis' };
  if (!DATE_RE.test(ev.start_date || '') || !DATE_RE.test(ev.end_date || '')) return { error: 'Dates invalides' };
  if (ev.end_date < ev.start_date) return { error: 'La date de fin est avant la date de début' };
  return { ev };
}

async function allArcherIds() {
  const { data, error } = await supabase.from('users').select('id').eq('role', 'archer');
  if (error) throw error;
  return data.map(u => u.id);
}

// Évènements d'un archer (l'archer ne voit que les siens)
router.get('/:archerId', requireAuth, async (req, res) => {
  const { archerId } = req.params;
  if (req.user.role === 'archer' && req.user.id !== archerId) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const { data, error } = await supabase
    .from('season_events')
    .select('*')
    .eq('archer_id', archerId)
    .order('start_date');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Coach : ajoute un évènement à un archer, ou à tous (apply_to_all)
router.post('/', requireAuth, requireCoach, async (req, res) => {
  const { ev, error: invalid } = clean(req.body);
  if (invalid) return res.status(400).json({ error: invalid });
  try {
    const ids = req.body.apply_to_all ? await allArcherIds() : [req.body.archer_id];
    if (!ids.length || !ids[0]) return res.status(400).json({ error: 'Archer manquant' });
    const group_key = randomUUID();
    const { data, error } = await supabase
      .from('season_events')
      .insert(ids.map(archer_id => ({ ...ev, archer_id, group_key })))
      .select();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data.find(e => e.archer_id === req.body.archer_id) || data[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Coach : importe une liste d'évènements (fichier Excel lu par le navigateur)
router.post('/import', requireAuth, requireCoach, async (req, res) => {
  const { events = [], archer_ids, apply_to_all } = req.body;
  const cleaned = [];
  for (const raw of events) {
    const { ev, error: invalid } = clean(raw);
    if (invalid) return res.status(400).json({ error: `${raw.title || 'Évènement'} : ${invalid}` });
    cleaned.push({ ...ev, group_key: randomUUID() });
  }
  if (!cleaned.length) return res.status(400).json({ error: 'Aucun évènement à importer' });
  try {
    const ids = apply_to_all ? await allArcherIds() : (archer_ids || []);
    if (!ids.length) return res.status(400).json({ error: 'Aucun archer choisi' });
    const rows = ids.flatMap(archer_id => cleaned.map(ev => ({ ...ev, archer_id })));
    const { error } = await supabase.from('season_events').insert(rows);
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ imported: cleaned.length, archers: ids.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Coach : modifie un évènement, pour cet archer ou pour tous ceux qui l'ont (scope=group)
router.put('/:id', requireAuth, requireCoach, async (req, res) => {
  const { ev, error: invalid } = clean(req.body);
  if (invalid) return res.status(400).json({ error: invalid });
  const { data: current, error: findErr } = await supabase
    .from('season_events').select('id, group_key').eq('id', req.params.id).maybeSingle();
  if (findErr) return res.status(500).json({ error: findErr.message });
  if (!current) return res.status(404).json({ error: 'Évènement introuvable' });

  let query = supabase.from('season_events').update(ev);
  query = req.body.scope === 'group' ? query.eq('group_key', current.group_key) : query.eq('id', current.id);
  const { data, error } = await query.select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.find(e => e.id === current.id));
});

// Coach : supprime un évènement (scope=group : chez tous les archers qui l'ont)
router.delete('/:id', requireAuth, requireCoach, async (req, res) => {
  const { data: current, error: findErr } = await supabase
    .from('season_events').select('id, group_key').eq('id', req.params.id).maybeSingle();
  if (findErr) return res.status(500).json({ error: findErr.message });
  if (!current) return res.json({ ok: true });
  const query = supabase.from('season_events').delete();
  const { error } = req.query.scope === 'group'
    ? await query.eq('group_key', current.group_key)
    : await query.eq('id', current.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;

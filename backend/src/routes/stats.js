import { Router } from 'express';
import supabase from '../supabase.js';
import { requireAuth, requireCoach } from '../middleware/auth.js';

const router = Router();

function sessionDuration(s) {
  const [sh, sm] = s.start_time.split(':').map(Number);
  const [eh, em] = s.end_time.split(':').map(Number);
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
}

// GET /api/stats/:archerId?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/:archerId', requireAuth, requireCoach, async (req, res) => {
  const { archerId } = req.params;
  const { from, to } = req.query;

  let query = supabase
    .from('training_sessions')
    .select('*, training_type:training_type_id(title, color)')
    .eq('archer_id', archerId)
    .order('week_start');

  if (from) query = query.gte('week_start', from);
  if (to)   query = query.lte('week_start', to);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // ── Totaux ──────────────────────────────────────────────────
  const totalMinutes  = data.reduce((s, r) => s + sessionDuration(r), 0);
  const totalSessions = data.length;

  // ── Par type ────────────────────────────────────────────────
  const typeMap = {};
  data.forEach(r => {
    const key = r.training_type_id;
    if (!typeMap[key]) {
      typeMap[key] = {
        training_type_id: key,
        title:    r.training_type?.title || 'Inconnu',
        color:    r.training_type?.color || '#9ca3af',
        minutes:  0,
        sessions: 0,
      };
    }
    typeMap[key].minutes  += sessionDuration(r);
    typeMap[key].sessions += 1;
  });
  const byType = Object.values(typeMap).sort((a, b) => b.minutes - a.minutes);

  // ── Par semaine ──────────────────────────────────────────────
  const weekMap = {};
  data.forEach(r => {
    weekMap[r.week_start] = (weekMap[r.week_start] || 0) + sessionDuration(r);
  });
  const byWeek = Object.entries(weekMap)
    .map(([week_start, minutes]) => ({ week_start, minutes }))
    .sort((a, b) => a.week_start.localeCompare(b.week_start));

  // ── Par jour de semaine (1=Lun … 6=Sam) ─────────────────────
  const dayArr = Array(6).fill(0);
  data.forEach(r => {
    const idx = r.day_of_week - 1;
    if (idx >= 0 && idx < 6) dayArr[idx] += sessionDuration(r);
  });
  const byDay = dayArr.map((minutes, i) => ({ day: i + 1, minutes }));

  // ── Séances par semaine (pour "fréquence") ───────────────────
  const weekCount = Object.keys(weekMap).length || 1;
  const avgSessionsPerWeek = +(totalSessions / weekCount).toFixed(1);

  res.json({
    totalMinutes,
    totalSessions,
    avgSessionsPerWeek,
    byType,
    byWeek,
    byDay,
  });
});

export default router;

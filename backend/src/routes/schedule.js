import { Router } from 'express';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import supabase from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { sendPushToAllCoaches } from '../utils/webpush.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Upload d'une capture d'écran + extraction via Claude Vision
router.post('/upload', requireAuth, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Image manquante' });

  // Détermine l'archer_id : pour un archer on utilise son propre id (JWT),
  // pour un coach il envoie archer_id dans le body.
  // Le frontend envoie aussi archer_id en fallback de sécurité.
  let archerId;
  if (req.user.role === 'archer') {
    archerId = req.user.id || req.body.archer_id;
  } else {
    archerId = req.body.archer_id;
  }

  const weekStart = req.body.week_start; // format YYYY-MM-DD (lundi de la semaine)
  const comment   = (req.body.comment || '').trim();

  if (!archerId) return res.status(400).json({ error: 'archer_id introuvable — reconnectez-vous' });
  if (!weekStart) return res.status(400).json({ error: 'week_start manquant' });

  const base64 = req.file.buffer.toString('base64');
  const mediaType = req.file.mimetype;

  // Upload image vers Supabase Storage
  const filePath = `schedules/${archerId}/${weekStart}.${mediaType.split('/')[1]}`;
  const { error: uploadError } = await supabase.storage
    .from('schedule-images')
    .upload(filePath, req.file.buffer, { contentType: mediaType, upsert: true });

  if (uploadError) console.warn('Storage upload warning:', uploadError.message);

  // Extraction OCR avec Claude Vision
  let slots = [];
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 }
          },
          {
            type: 'text',
            text: `Analyse cet emploi du temps scolaire. Extrais tous les créneaux de cours et renvoie UNIQUEMENT un JSON valide (sans markdown, sans texte avant/après) avec ce format exact:
{
  "slots": [
    { "day": 1, "start": "08:00", "end": "09:00", "label": "Mathématiques" }
  ]
}
Les jours: 1=Lundi, 2=Mardi, 3=Mercredi, 4=Jeudi, 5=Vendredi, 6=Samedi.
Heures au format HH:MM. Si tu ne vois pas d'emploi du temps clair, renvoie {"slots": []}.`
          }
        ]
      }]
    });

    let text = response.content[0].text.trim();
    // Supprime les balises markdown ```json ... ``` si présentes
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Tentative d'extraction du JSON si du texte parasite entoure le JSON
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        console.error('Réponse Claude non parsable:', text);
        parsed = { slots: [] };
      }
    }
    slots = parsed.slots || [];
  } catch (e) {
    console.error('Claude Vision error:', e.message);
    return res.status(500).json({ error: 'Erreur lors de l\'analyse de l\'image', detail: e.message });
  }

  // Supprime les anciens créneaux scolaires de cette semaine pour cet archer
  await supabase
    .from('schedule_slots')
    .delete()
    .eq('archer_id', archerId)
    .eq('week_start', weekStart)
    .eq('type', 'cours');

  // Insère les nouveaux créneaux
  if (slots.length > 0) {
    const rows = slots.map(s => ({
      archer_id: archerId,
      week_start: weekStart,
      day_of_week: s.day,
      start_time: s.start,
      end_time: s.end,
      label: s.label || 'Cours',
      type: 'cours'
    }));

    const { error: insertError } = await supabase.from('schedule_slots').insert(rows);
    if (insertError) return res.status(500).json({ error: insertError.message });
  }

  // Récupère le nom de l'archer pour la notification
  const archerName = req.user.role === 'archer'
    ? req.user.name
    : (await supabase.from('users').select('name').eq('id', archerId).single()).data?.name ?? 'Un archer';

  // Sauvegarde le commentaire de l'archer (upsert : 1 commentaire par archer/semaine)
  if (comment) {
    await supabase.from('archer_comments').upsert(
      { archer_id: archerId, week_start: weekStart, comment },
      { onConflict: 'archer_id,week_start' }
    );
  }

  // Notifie tous les coachs (fire-and-forget — n'impacte pas la réponse)
  sendPushToAllCoaches({
    title: '📅 Emploi du temps mis à jour',
    body:  `${archerName} a uploadé son emploi du temps pour la semaine du ${weekStart}.`,
    tag:   `schedule-${archerId}-${weekStart}`,
    url:   '/',
  }).catch(() => {});

  res.json({ slots, image_path: filePath, comment: comment || null });
});

// Récupère le commentaire d'un archer pour une semaine (coach + archer)
router.get('/comment/:archerId/:weekStart', requireAuth, async (req, res) => {
  const { archerId, weekStart } = req.params;
  if (req.user.role === 'archer' && req.user.id !== archerId) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const { data } = await supabase
    .from('archer_comments')
    .select('comment, created_at')
    .eq('archer_id', archerId)
    .eq('week_start', weekStart)
    .single();
  res.json(data ?? { comment: null });
});

// Récupère les créneaux d'un archer pour une semaine précise
router.get('/:archerId/:weekStart', requireAuth, async (req, res) => {
  const { archerId, weekStart } = req.params;

  // Un archer ne peut voir que ses propres créneaux
  if (req.user.role === 'archer' && req.user.id !== archerId) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const { data, error } = await supabase
    .from('schedule_slots')
    .select('*')
    .eq('archer_id', archerId)
    .eq('week_start', weekStart)
    .order('day_of_week')
    .order('start_time');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Mise à jour manuelle d'un créneau
router.put('/:slotId', requireAuth, async (req, res) => {
  const { slotId } = req.params;
  const { label, start_time, end_time, day_of_week } = req.body;

  const { data, error } = await supabase
    .from('schedule_slots')
    .update({ label, start_time, end_time, day_of_week })
    .eq('id', slotId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Supprime un créneau
router.delete('/:slotId', requireAuth, async (req, res) => {
  const { slotId } = req.params;
  const { error } = await supabase.from('schedule_slots').delete().eq('id', slotId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;

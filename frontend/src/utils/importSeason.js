import JSZip from 'jszip';

// Lecture d'un calendrier de saison dans le navigateur.
// Deux formats acceptés :
//  1. le calendrier du coach : mois en colonnes, jours en lignes, évènements
//     dessinés en zones de texte colorées (Calendrier 2026-2027.xlsx) ;
//  2. un tableau simple (Excel ou CSV) avec les colonnes
//     Nom | Type | Début | Fin | Couleur | Notes.
// Renvoie [{ title, kind, color, start_date, end_date, notes }].

const MONTHS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
const THEME_ALIAS = { tx1: 'dk1', bg1: 'lt1', tx2: 'dk2', bg2: 'lt2' };

const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const pad = n => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const kindOf = title => (/^stage/i.test(norm(title)) ? 'stage' : 'competition');
const byTag = (node, name) => Array.from(node.getElementsByTagNameNS('*', name));
const firstTag = (node, name) => byTag(node, name)[0] || null;
const parseXml = text => new DOMParser().parseFromString(text, 'application/xml');

function colIndex(ref) {
  const letters = ref.match(/^[A-Z]+/)[0];
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function excelSerialToIso(n) {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
  return iso(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function parseDate(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return excelSerialToIso(v);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) return iso(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]);
  if (/^\d+(\.\d+)?$/.test(s)) return excelSerialToIso(Number(s));
  return null;
}

function normColor(v) {
  const s = String(v || '').trim().replace(/^#/, '');
  return /^[0-9a-fA-F]{6}$/.test(s) ? `#${s.toUpperCase()}` : null;
}

// ── Tableau simple ────────────────────────────────────────────────────────────
function fromTable(rows) {
  const headerIdx = rows.findIndex(r => r.some(c => /^(nom|titre|evenement)/.test(norm(c))) && r.some(c => /^(debut|du|date)/.test(norm(c))));
  if (headerIdx === -1) return null;
  const h = rows[headerIdx].map(norm);
  const find = re => h.findIndex(c => re.test(c));
  const col = {
    title: find(/^(nom|titre|evenement)/), kind: find(/^type/), start: find(/^(debut|du|date)/),
    end: find(/^(fin|au)/), color: find(/^couleur/), notes: find(/^(notes?|remarques?|lieu)/),
  };
  const events = [];
  for (const r of rows.slice(headerIdx + 1)) {
    const title = String(r[col.title] ?? '').trim();
    const start = parseDate(r[col.start]);
    if (!title || !start) continue;
    const end = (col.end >= 0 && parseDate(r[col.end])) || start;
    const kindRaw = norm(r[col.kind]);
    events.push({
      title,
      kind: kindRaw.startsWith('stage') ? 'stage' : kindRaw.startsWith('comp') ? 'competition' : kindOf(title),
      color: (col.color >= 0 && normColor(r[col.color])) || (kindOf(title) === 'stage' ? '#70AD47' : '#FF0000'),
      start_date: start,
      end_date: end < start ? start : end,
      notes: col.notes >= 0 ? String(r[col.notes] ?? '').trim() : '',
    });
  }
  return events;
}

function parseCsv(text) {
  const sep = (text.split('\n')[0].match(/;/g) || []).length >= (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  return text.split(/\r?\n/).filter(l => l.trim()).map(line => {
    const out = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (ch === sep && !q) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out.map(c => c.trim());
  });
}

// ── Classeur Excel ────────────────────────────────────────────────────────────
async function readWorkbook(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const read = async path => (zip.file(path) ? zip.file(path).async('string') : null);
  const resolve = (base, target) => {
    if (target.startsWith('/')) return target.slice(1);
    const parts = base.split('/').slice(0, -1);
    for (const p of target.split('/')) { if (p === '..') parts.pop(); else if (p !== '.') parts.push(p); }
    return parts.join('/');
  };

  // Première feuille du classeur
  const wb = parseXml(await read('xl/workbook.xml'));
  const wbRels = parseXml(await read('xl/_rels/workbook.xml.rels'));
  const sheetEl = firstTag(wb, 'sheet');
  const rid = sheetEl.getAttribute('r:id') || sheetEl.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
  const rel = byTag(wbRels, 'Relationship').find(r => r.getAttribute('Id') === rid);
  const sheetPath = resolve('xl/workbook.xml', rel.getAttribute('Target'));
  const sheet = parseXml(await read(sheetPath));

  const ssText = await read('xl/sharedStrings.xml');
  const shared = ssText ? byTag(parseXml(ssText), 'si').map(si => byTag(si, 't').map(t => t.textContent).join('')) : [];

  // Cellules : rows[r][c] (indices à partir de 0)
  const rows = [];
  const rowHeights = {};
  const fmt = firstTag(sheet, 'sheetFormatPr');
  const defaultHeight = Number(fmt?.getAttribute('defaultRowHeight')) || 15;
  for (const rowEl of byTag(sheet, 'row')) {
    const r = Number(rowEl.getAttribute('r')) - 1;
    if (rowEl.getAttribute('ht')) rowHeights[r] = Number(rowEl.getAttribute('ht'));
    for (const c of byTag(rowEl, 'c')) {
      const v = firstTag(c, 'v');
      const isEl = firstTag(c, 'is');
      if (!v && !isEl) continue;
      const type = c.getAttribute('t');
      let value;
      if (type === 's') value = shared[Number(v.textContent)];
      else if (type === 'inlineStr') value = byTag(isEl, 't').map(t => t.textContent).join('');
      else if (type === 'str' || type === 'b') value = v.textContent;
      else value = Number(v.textContent);
      (rows[r] ||= [])[colIndex(c.getAttribute('r'))] = value;
    }
  }

  // Dessin lié à la feuille (zones de texte)
  let drawing = null;
  const sheetRelsText = await read(sheetPath.replace(/([^/]+)$/, '_rels/$1.rels'));
  if (sheetRelsText) {
    const dRel = byTag(parseXml(sheetRelsText), 'Relationship').find(r => /drawing$/.test(r.getAttribute('Type')));
    if (dRel) {
      const dText = await read(resolve(sheetPath, dRel.getAttribute('Target')));
      if (dText) drawing = parseXml(dText);
    }
  }

  const themeText = await read('xl/theme/theme1.xml');
  const theme = {};
  if (themeText) {
    const scheme = firstTag(parseXml(themeText), 'clrScheme');
    for (const el of Array.from(scheme?.children || [])) {
      const clr = firstTag(el, 'srgbClr')?.getAttribute('val') || firstTag(el, 'sysClr')?.getAttribute('lastClr');
      if (clr) theme[el.localName] = `#${clr.toUpperCase()}`;
    }
  }

  return { rows: Array.from(rows, r => r || []), rowHeights, defaultHeight, drawing, theme };
}

function fromDrawing({ rows, rowHeights, defaultHeight, drawing, theme }, startYear) {
  // En-têtes de mois : colonne → mois ; l'année avance quand on repasse à janvier
  const header = [];
  rows.forEach((r, ri) => r.forEach((v, ci) => {
    const idx = MONTHS.indexOf(norm(v));
    if (idx >= 0) header.push({ ci, ri, m: idx });
  }));
  if (!header.length) return null;
  const headerRow = header[0].ri;
  const monthCols = header.filter(h => h.ri === headerRow).sort((a, b) => a.ci - b.ci);
  let year = startYear, prevM = null;
  for (const h of monthCols) {
    if (prevM !== null && h.m <= prevM) year++;
    h.y = year; prevM = h.m;
  }

  // Lignes → numéro du jour (les colonnes de chiffres 1 à 31)
  const rowDay = {};
  rows.forEach((r, ri) => {
    if (ri <= headerRow) return;
    const n = r.find(v => typeof v === 'number' && v >= 1 && v <= 31 && Number.isInteger(v));
    if (n) rowDay[ri] = n;
  });
  const dayOfRow = ri => {
    if (rowDay[ri]) return rowDay[ri];
    const known = Object.keys(rowDay).map(Number).sort((a, b) => a - b);
    if (!known.length) return null;
    if (ri < known[0]) return 1;
    const lastKnown = known[known.length - 1];
    return ri > lastKnown ? rowDay[lastKnown] + (ri - lastKnown) : null;
  };
  const rowEmu = ri => (rowHeights[ri] || defaultHeight) * 12700;

  const anchors = [...byTag(drawing, 'twoCellAnchor'), ...byTag(drawing, 'oneCellAnchor')];
  const raw = [];
  for (const a of anchors) {
    const title = byTag(a, 't').map(t => t.textContent).join(' ').replace(/\s+/g, ' ').trim();
    if (!title) continue; // traits sans texte (ex. vacances scolaires)
    const pos = el => el && {
      col: Number(firstTag(el, 'col').textContent), row: Number(firstTag(el, 'row').textContent),
      rowOff: Number(firstTag(el, 'rowOff')?.textContent || 0),
    };
    const from = pos(firstTag(a, 'from'));
    const to = pos(firstTag(a, 'to')) || from;
    const month = [...monthCols].reverse().find(h => h.ci <= from.col) || monthCols[0];
    const startRow = from.row + (from.rowOff > rowEmu(from.row) * 0.5 ? 1 : 0);
    const endRow = to.row - (to.rowOff < rowEmu(to.row) * 0.3 ? 1 : 0);
    const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
    const sd = Math.min(Math.max(dayOfRow(startRow) || 1, 1), daysInMonth);
    const ed = Math.min(Math.max(dayOfRow(endRow) || sd, sd), daysInMonth);

    // Couleur de remplissage de la forme (pas celle du contour)
    const spPr = firstTag(a, 'spPr');
    const solid = spPr && Array.from(spPr.children).find(el => el.localName === 'solidFill');
    let color = null;
    if (solid) {
      const s = firstTag(solid, 'srgbClr'), sc = firstTag(solid, 'schemeClr');
      if (s) color = `#${s.getAttribute('val').toUpperCase()}`;
      else if (sc) { const k = sc.getAttribute('val'); color = theme[THEME_ALIAS[k] || k] || null; }
    }
    raw.push({
      title, kind: kindOf(title), color: color || (kindOf(title) === 'stage' ? '#70AD47' : '#FF0000'),
      start_date: iso(month.y, month.m, sd), end_date: iso(month.y, month.m, ed), notes: '',
    });
  }

  // Un même stage coupé sur deux mois (ex. fin septembre + début octobre) → un seul évènement
  raw.sort((a, b) => a.start_date.localeCompare(b.start_date));
  const merged = [];
  for (const e of raw) {
    const prev = [...merged].reverse().find(p => norm(p.title) === norm(e.title));
    if (prev) {
      const next = new Date(prev.end_date); next.setDate(next.getDate() + 2);
      if (e.start_date <= iso(next.getFullYear(), next.getMonth(), next.getDate())) {
        if (e.end_date > prev.end_date) prev.end_date = e.end_date;
        continue;
      }
    }
    merged.push({ ...e });
  }
  return merged;
}

export async function parseSeasonFile(file, startYear) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    const events = fromTable(parseCsv(await file.text()));
    if (!events) throw new Error('Colonnes « Nom » et « Début » introuvables dans le fichier.');
    return events;
  }
  if (!name.endsWith('.xlsx') && !name.endsWith('.xlsm')) {
    throw new Error('Format non pris en charge : utilise un fichier Excel (.xlsx) ou CSV.');
  }
  const wb = await readWorkbook(await file.arrayBuffer());
  const table = fromTable(wb.rows);
  if (table && table.length) return table;
  if (wb.drawing) {
    const events = fromDrawing(wb, startYear);
    if (events && events.length) return events;
  }
  throw new Error("Aucun évènement trouvé. Utilise le calendrier du coach (mois en colonnes) ou un tableau Nom | Type | Début | Fin.");
}

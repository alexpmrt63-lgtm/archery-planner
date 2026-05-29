import { useState, useRef, useEffect } from 'react';
import { format, addDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const START_HOUR  = 7;
const END_HOUR    = 23;   // grille jusqu'à 23h, sessions limitées à 22h30
const END_MINUTES = 22 * 60 + 30; // 22:30 — borne max de placement
const HOURS       = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR);
const CELL_HEIGHT = 52; // px par heure
const MIN_DURATION = 5; // durée minimale en minutes

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToPx(minutes) {
  return ((minutes - START_HOUR * 60) / 60) * CELL_HEIGHT;
}

function minutesToTime(min) {
  const clamped = Math.max(START_HOUR * 60, Math.min(END_MINUTES, min));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

function pxToTime(px) {
  const totalMinutes = Math.round((px / CELL_HEIGHT) * 60 / 5) * 5 + START_HOUR * 60;
  return minutesToTime(totalMinutes);
}

// ── Bloc cours scolaire ───────────────────────────────────────────────────────
function SlotBlock({ slot, isTraining, onDelete, readOnly }) {
  const top    = minutesToPx(timeToMinutes(slot.start_time));
  const height = Math.max(minutesToPx(timeToMinutes(slot.end_time)) - top, 20);
  const color  = isTraining ? (slot.training_type?.color || '#3b82f6') : null;
  const label  = isTraining ? (slot.training_type?.title || 'Entraînement') : (slot.label || 'Cours');

  return (
    <div
      className={`absolute left-0.5 right-0.5 rounded overflow-hidden select-none z-10 ${
        isTraining ? 'text-white shadow-sm' : 'bg-gray-200 border border-gray-300 text-gray-600'
      }`}
      style={{ top: `${top}px`, height: `${height}px`, ...(color ? { backgroundColor: color } : {}) }}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-start justify-between h-full px-1 py-0.5 gap-0.5">
        <span className="text-[10px] leading-tight font-medium truncate">{label}</span>
        {!readOnly && isTraining && onDelete && height >= 24 && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(slot.id); }}
            className="text-[10px] leading-none opacity-70 hover:opacity-100 shrink-0"
          >✕</button>
        )}
      </div>
    </div>
  );
}

// ── Bloc entraînement draggable + poignées de redimensionnement ───────────────
function DraggableTraining({ session, readOnly, onDelete, onDragStart, onEdit, onViewSession, onResizeStart }) {
  const containerRef = useRef(null);
  const top    = minutesToPx(timeToMinutes(session.start_time));
  const height = Math.max(minutesToPx(timeToMinutes(session.end_time)) - top, 20);
  const color  = session.training_type?.color || '#3b82f6';
  const label  = session.training_type?.title || 'Entraînement';

  // Distingue un vrai clic d'un drag
  const dragMoved = { current: false };

  function startResize(edge, e) {
    e.preventDefault();
    e.stopPropagation();
    // Le parent direct est la colonne jour
    const colEl     = containerRef.current?.parentElement;
    const columnTop = colEl?.getBoundingClientRect().top ?? 0;
    onResizeStart?.(session, edge, columnTop);
  }

  return (
    <div
      ref={containerRef}
      className={`absolute left-0.5 right-0.5 rounded overflow-visible z-20 text-white shadow group ${
        readOnly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
      }`}
      style={{ top: `${top}px`, height: `${height}px`, backgroundColor: color }}
      draggable={!readOnly}
      onDragStart={e => {
        e.stopPropagation();
        dragMoved.current = false;
        const rect = e.currentTarget.getBoundingClientRect();
        onDragStart(session, e.clientY - rect.top);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', session.id);
      }}
      onDrag={() => { dragMoved.current = true; }}
      onClick={e => {
        e.stopPropagation();
        if (!dragMoved.current) {
          if (onViewSession) onViewSession(session);
          else if (!readOnly && onEdit) onEdit(session);
        }
      }}
    >
      {/* Contenu */}
      <div className="flex flex-col h-full px-1.5 py-1 gap-0.5 overflow-hidden rounded">
        {/* Ligne 1 : titre + bouton suppr */}
        <div className="flex items-start justify-between gap-0.5">
          <span className="text-[10px] font-bold leading-tight truncate">{label}</span>
          {!readOnly && onDelete && height >= 24 && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(session.id); }}
              className="text-[10px] leading-none opacity-0 group-hover:opacity-80 hover:!opacity-100 shrink-0"
            >✕</button>
          )}
        </div>
        {/* Ligne 2 : horaires */}
        {height >= 30 && (
          <div className="text-[9px] opacity-80 leading-tight font-medium">
            {session.start_time.slice(0, 5)} – {session.end_time.slice(0, 5)}
          </div>
        )}
        {/* Ligne 3 : notes coach */}
        {height >= 52 && session.notes && (
          <div className="text-[9px] opacity-70 leading-tight mt-0.5 line-clamp-2 break-words">
            {session.notes}
          </div>
        )}
        {/* Icône crayon au survol si éditable */}
        {!readOnly && height >= 24 && (
          <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-60 text-[9px]">✎</div>
        )}
      </div>

      {/* Pastille : l'archer a écrit un commentaire */}
      {session.archer_notes && (
        <div
          className="absolute bottom-1 left-1 w-2 h-2 rounded-full bg-yellow-300 shadow-sm ring-1 ring-yellow-400/60"
          title="L'archer a ajouté un commentaire"
        />
      )}

      {/* ── Poignées de redimensionnement (mode édition uniquement) ── */}
      {!readOnly && onResizeStart && (
        <>
          {/* Poignée haute — change l'heure de début */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 shadow-md
                       opacity-0 group-hover:opacity-100 transition-opacity cursor-ns-resize z-30
                       flex items-center justify-center"
            style={{ top: '-7px', borderColor: color }}
            onMouseDown={e => startResize('top', e)}
          >
            <div className="w-1.5 h-0.5 rounded-full bg-gray-400" />
          </div>

          {/* Poignée basse — change l'heure de fin */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 shadow-md
                       opacity-0 group-hover:opacity-100 transition-opacity cursor-ns-resize z-30
                       flex items-center justify-center"
            style={{ bottom: '-7px', borderColor: color }}
            onMouseDown={e => startResize('bottom', e)}
          >
            <div className="w-1.5 h-0.5 rounded-full bg-gray-400" />
          </div>
        </>
      )}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function WeeklyPlanner({
  weekStart,
  coursSlots       = [],
  trainingSessions = [],
  readOnly         = false,
  onAddTraining,
  onDeleteTraining,
  onMoveTraining,
  onDropFromLibrary,
  onEditTraining,
  onViewSession,
  libDrag          = null,
  dayColWidth      = null,
}) {
  const [dragging, setDragging]     = useState(null); // { session, offsetY }
  const [ghost, setGhost]           = useState(null); // ghost déplacement interne
  const [libGhost, setLibGhost]     = useState(null); // ghost dépôt bibliothèque
  const [resizeGhost, setResizeGhost] = useState(null); // ghost redimensionnement
  // { sessionId, day, startTime, endTime }

  const resizingRef = useRef(null);
  // { session, edge:'top'|'bottom', columnTop, currentStart, currentEnd }

  const weekDates  = DAYS.map((_, i) => addDays(parseISO(weekStart), i));
  const colTemplate = `48px repeat(${DAYS.length}, ${dayColWidth ? `${dayColWidth}px` : '1fr'})`;

  // ── Redimensionnement : écouteurs globaux ────────────────────────────────
  useEffect(() => {
    function onMouseMove(e) {
      const r = resizingRef.current;
      if (!r) return;

      const y           = e.clientY - r.columnTop;
      const snappedTime = pxToTime(Math.max(0, y));

      if (r.edge === 'top') {
        // L'heure de début recule ou avance, l'heure de fin reste fixe
        const endMin      = timeToMinutes(r.currentEnd);
        const newStartMin = Math.min(timeToMinutes(snappedTime), endMin - MIN_DURATION);
        r.currentStart    = minutesToTime(Math.max(START_HOUR * 60, newStartMin));
      } else {
        // L'heure de fin recule ou avance, l'heure de début reste fixe
        const startMin  = timeToMinutes(r.currentStart);
        const newEndMin = Math.max(timeToMinutes(snappedTime), startMin + MIN_DURATION);
        r.currentEnd    = minutesToTime(newEndMin);
      }

      setResizeGhost({
        sessionId: r.session.id,
        day:       r.session.day_of_week,
        startTime: r.currentStart,
        endTime:   r.currentEnd,
      });
    }

    function onMouseUp() {
      const r = resizingRef.current;
      if (r && (r.currentStart !== r.session.start_time || r.currentEnd !== r.session.end_time)) {
        onMoveTraining?.(r.session.id, {
          day_of_week: r.session.day_of_week,
          start_time:  r.currentStart,
          end_time:    r.currentEnd,
        });
      }
      resizingRef.current = null;
      setResizeGhost(null);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup',   onMouseUp);
    };
  }, [onMoveTraining]);

  function handleResizeStart(session, edge, columnTop) {
    resizingRef.current = {
      session,
      edge,
      columnTop,
      currentStart: session.start_time,
      currentEnd:   session.end_time,
    };
    setResizeGhost({
      sessionId: session.id,
      day:       session.day_of_week,
      startTime: session.start_time,
      endTime:   session.end_time,
    });
  }

  // ── Clic pour ajouter ────────────────────────────────────────────────────
  function handleColumnClick(e, dayIndex) {
    if (readOnly || !onAddTraining || libDrag || resizingRef.current) return;
    const rect      = e.currentTarget.getBoundingClientRect();
    const startTime = pxToTime(e.clientY - rect.top);
    onAddTraining({ day: dayIndex + 1, startTime });
  }

  // ── Drag interne ─────────────────────────────────────────────────────────
  function handleDragStart(session, offsetY) {
    setDragging({ session, offsetY });
  }

  function handleDragOver(e, dayIndex) {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();

    if (libDrag) {
      const startTime = pxToTime(e.clientY - rect.top);
      const startMin  = timeToMinutes(startTime);
      const endTime   = minutesToTime(startMin + (libDrag.duration_minutes || 120));
      setLibGhost({ day: dayIndex + 1, startTime, endTime });
      setGhost(null);
      return;
    }

    if (!dragging) return;
    const y           = e.clientY - rect.top - dragging.offsetY;
    const startTime   = pxToTime(Math.max(0, y));
    const durationMin = timeToMinutes(dragging.session.end_time) - timeToMinutes(dragging.session.start_time);
    const endTime     = minutesToTime(timeToMinutes(startTime) + durationMin);
    setGhost({ day: dayIndex + 1, startTime, endTime });
    setLibGhost(null);
  }

  function handleDrop(e, dayIndex) {
    e.preventDefault();

    const rawLib = e.dataTransfer.getData('application/x-library');
    if (rawLib) {
      const { training_type_id, duration_minutes } = JSON.parse(rawLib);
      const rect      = e.currentTarget.getBoundingClientRect();
      const startTime = pxToTime(e.clientY - rect.top);
      const startMin  = timeToMinutes(startTime);
      const endTime   = minutesToTime(startMin + duration_minutes);
      onDropFromLibrary?.({ day: dayIndex + 1, startTime, endTime, training_type_id });
      setLibGhost(null);
      return;
    }

    if (!dragging || !ghost) { setDragging(null); setGhost(null); return; }
    onMoveTraining?.(dragging.session.id, {
      day_of_week: ghost.day,
      start_time:  ghost.startTime,
      end_time:    ghost.endTime,
    });
    setDragging(null);
    setGhost(null);
  }

  function handleDragLeave() { setLibGhost(null); }
  function handleDragEnd()   { setDragging(null); setGhost(null); setLibGhost(null); }

  const totalHeight = CELL_HEIGHT * HOURS.length;

  return (
    <div
      className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm select-none"
      style={dayColWidth ? { WebkitOverflowScrolling: 'touch' } : undefined}
    >
      {/* En-tête jours */}
      <div className="grid border-b border-gray-200 bg-gray-50"
        style={{ gridTemplateColumns: colTemplate }}>
        <div />
        {DAYS.map((day, i) => (
          <div key={day} className="py-2 text-center border-l border-gray-200">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{day}</div>
            <div className="text-sm font-bold text-gray-800">{format(weekDates[i], 'd MMM', { locale: fr })}</div>
          </div>
        ))}
      </div>

      {/* Grille horaire */}
      <div className="grid" style={{ gridTemplateColumns: colTemplate }}>

        {/* Colonne heures */}
        <div className="border-r border-gray-100">
          {HOURS.map(h => (
            <div key={h} style={{ height: `${CELL_HEIGHT}px` }}
              className="flex items-start justify-end pr-2 pt-0.5 border-b border-gray-100">
              <span className="text-[11px] text-gray-400 font-medium">{String(h).padStart(2, '0')}h</span>
            </div>
          ))}
        </div>

        {/* Colonnes jours */}
        {DAYS.map((_, dayIdx) => {
          const dayNum      = dayIdx + 1;
          const dayCours    = coursSlots.filter(s => s.day_of_week === dayNum);
          const dayTraining = trainingSessions.filter(s => s.day_of_week === dayNum);
          const showGhost   = ghost?.day === dayNum && dragging;
          const showLibGhost = libGhost?.day === dayNum && libDrag;
          const showResize  = resizeGhost?.day === dayNum;

          return (
            <div
              key={dayIdx}
              className={`relative border-l border-gray-200 ${
                libDrag ? 'cursor-copy' : 'cursor-crosshair'
              } ${showLibGhost ? 'bg-blue-50/30' : ''}`}
              style={{ height: `${totalHeight}px` }}
              onDragOver={e => handleDragOver(e, dayIdx)}
              onDrop={e => handleDrop(e, dayIdx)}
              onDragLeave={handleDragLeave}
              onClick={e => handleColumnClick(e, dayIdx)}
            >
              {/* Lignes heures */}
              {HOURS.map(h => (
                <div key={h} className="absolute left-0 right-0 border-t border-gray-100"
                  style={{ top: `${(h - START_HOUR) * CELL_HEIGHT}px` }} />
              ))}
              {/* Lignes demi-heures */}
              {HOURS.map(h => (
                <div key={`${h}h`} className="absolute left-0 right-0 border-t border-gray-50 border-dashed"
                  style={{ top: `${(h - START_HOUR) * CELL_HEIGHT + CELL_HEIGHT / 2}px` }} />
              ))}

              {/* Cours scolaires */}
              {dayCours.map(slot => (
                <SlotBlock key={slot.id} slot={slot} isTraining={false} readOnly={readOnly} />
              ))}

              {/* Entraînements */}
              {dayTraining.map(session => (
                <DraggableTraining
                  key={session.id}
                  session={session}
                  readOnly={readOnly}
                  onDelete={onDeleteTraining}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onEdit={onEditTraining}
                  onViewSession={onViewSession}
                  onResizeStart={!readOnly ? handleResizeStart : undefined}
                />
              ))}

              {/* Ghost déplacement interne */}
              {showGhost && (
                <div
                  className="absolute left-0.5 right-0.5 rounded z-30 opacity-50 border-2 border-white border-dashed pointer-events-none"
                  style={{
                    top:             `${minutesToPx(timeToMinutes(ghost.startTime))}px`,
                    height:          `${Math.max(minutesToPx(timeToMinutes(ghost.endTime)) - minutesToPx(timeToMinutes(ghost.startTime)), 20)}px`,
                    backgroundColor: dragging.session.training_type?.color || '#3b82f6',
                  }}
                />
              )}

              {/* Ghost dépôt bibliothèque */}
              {showLibGhost && (
                <div
                  className="absolute left-0.5 right-0.5 rounded z-30 opacity-60 border-2 border-white border-dashed pointer-events-none flex items-start px-1.5 py-1"
                  style={{
                    top:             `${minutesToPx(timeToMinutes(libGhost.startTime))}px`,
                    height:          `${Math.max(minutesToPx(timeToMinutes(libGhost.endTime)) - minutesToPx(timeToMinutes(libGhost.startTime)), 20)}px`,
                    backgroundColor: libDrag.color || '#3b82f6',
                  }}
                >
                  <span className="text-[10px] text-white font-semibold truncate">{libDrag.title}</span>
                </div>
              )}

              {/* Ghost redimensionnement */}
              {showResize && (() => {
                const session = trainingSessions.find(s => s.id === resizeGhost.sessionId);
                const color   = session?.training_type?.color || '#3b82f6';
                const topPx   = minutesToPx(timeToMinutes(resizeGhost.startTime));
                const botPx   = minutesToPx(timeToMinutes(resizeGhost.endTime));
                const h       = Math.max(botPx - topPx, 13);
                return (
                  <div
                    className="absolute left-0.5 right-0.5 rounded z-40 pointer-events-none border-2 border-white border-dashed flex flex-col justify-between px-1.5 py-1"
                    style={{ top: `${topPx}px`, height: `${h}px`, backgroundColor: color, opacity: 0.85 }}
                  >
                    {/* Horaires mis à jour en temps réel */}
                    <span className="text-[9px] text-white font-bold leading-none">
                      {resizeGhost.startTime.slice(0, 5)}
                    </span>
                    {h >= 26 && (
                      <span className="text-[9px] text-white font-bold leading-none self-end">
                        {resizeGhost.endTime.slice(0, 5)}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <div className="text-center text-[11px] text-gray-400 py-2 border-t border-gray-100 bg-gray-50">
          {libDrag ? "Déposez sur le jour et l'heure souhaités" : 'Glissez un bloc · Cliquez pour ajouter'}
        </div>
      )}
    </div>
  );
}

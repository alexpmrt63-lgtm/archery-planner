import { useState } from 'react';
import { format, addDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const START_HOUR = 7;
const END_HOUR = 21;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR);
const CELL_HEIGHT = 52; // px par heure

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToPx(minutes) {
  return ((minutes - START_HOUR * 60) / 60) * CELL_HEIGHT;
}

function minutesToTime(min) {
  const clamped = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, min));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

function pxToTime(px) {
  const totalMinutes = Math.round((px / CELL_HEIGHT) * 60 / 15) * 15 + START_HOUR * 60;
  return minutesToTime(totalMinutes);
}

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

function DraggableTraining({ session, readOnly, onDelete, onDragStart, onEdit, onViewSession }) {
  const top    = minutesToPx(timeToMinutes(session.start_time));
  const height = Math.max(minutesToPx(timeToMinutes(session.end_time)) - top, 20);
  const color  = session.training_type?.color || '#3b82f6';
  const label  = session.training_type?.title || 'Entraînement';

  // Distingue un vrai clic d'un drag
  const dragMoved = { current: false };

  return (
    <div
      className={`absolute left-0.5 right-0.5 rounded overflow-hidden z-20 text-white shadow group ${
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
      <div className="flex flex-col h-full px-1.5 py-1 gap-0.5 overflow-hidden">
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
        {/* Ligne 3 : notes */}
        {height >= 52 && session.notes && (
          <div className="text-[9px] opacity-70 leading-tight mt-0.5 line-clamp-3 break-words">
            {session.notes}
          </div>
        )}
        {/* Icône crayon au survol si éditable */}
        {!readOnly && height >= 24 && (
          <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-60 text-[9px]">✎</div>
        )}
      </div>
    </div>
  );
}

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
}) {
  const [dragging, setDragging]   = useState(null); // { session, offsetY }
  const [ghost, setGhost]         = useState(null); // ghost déplacement interne
  const [libGhost, setLibGhost]   = useState(null); // ghost dépôt depuis la bibliothèque

  const weekDates = DAYS.map((_, i) => addDays(parseISO(weekStart), i));

  // ── Clic pour ajouter (mode sans bibliothèque) ──
  function handleColumnClick(e, dayIndex) {
    if (readOnly || !onAddTraining || libDrag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const startTime = pxToTime(e.clientY - rect.top);
    onAddTraining({ day: dayIndex + 1, startTime });
  }

  // ── Drag interne ──
  function handleDragStart(session, offsetY) {
    setDragging({ session, offsetY });
  }

  function handleDragOver(e, dayIndex) {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();

    // Ghost bibliothèque
    if (libDrag) {
      const startTime = pxToTime(e.clientY - rect.top);
      const startMin  = timeToMinutes(startTime);
      const endTime   = minutesToTime(startMin + (libDrag.duration_minutes || 120));
      setLibGhost({ day: dayIndex + 1, startTime, endTime });
      setGhost(null);
      return;
    }

    // Ghost déplacement interne
    if (!dragging) return;
    const y         = e.clientY - rect.top - dragging.offsetY;
    const startTime = pxToTime(Math.max(0, y));
    const durationMin = timeToMinutes(dragging.session.end_time) - timeToMinutes(dragging.session.start_time);
    const endTime   = minutesToTime(timeToMinutes(startTime) + durationMin);
    setGhost({ day: dayIndex + 1, startTime, endTime });
    setLibGhost(null);
  }

  function handleDrop(e, dayIndex) {
    e.preventDefault();

    // Dépôt depuis la bibliothèque
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

    // Déplacement interne
    if (!dragging || !ghost) { setDragging(null); setGhost(null); return; }
    onMoveTraining?.(dragging.session.id, {
      day_of_week: ghost.day,
      start_time:  ghost.startTime,
      end_time:    ghost.endTime,
    });
    setDragging(null);
    setGhost(null);
  }

  function handleDragLeave() {
    setLibGhost(null);
  }

  function handleDragEnd() {
    setDragging(null);
    setGhost(null);
    setLibGhost(null);
  }

  const totalHeight = CELL_HEIGHT * HOURS.length;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm select-none">

      {/* En-tête jours */}
      <div className="grid border-b border-gray-200 bg-gray-50"
        style={{ gridTemplateColumns: '48px repeat(6, 1fr)' }}>
        <div />
        {DAYS.map((day, i) => (
          <div key={day} className="py-2 text-center border-l border-gray-200">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{day}</div>
            <div className="text-sm font-bold text-gray-800">{format(weekDates[i], 'd MMM', { locale: fr })}</div>
          </div>
        ))}
      </div>

      {/* Grille horaire */}
      <div className="grid" style={{ gridTemplateColumns: '48px repeat(6, 1fr)' }}>

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
          const dayNum     = dayIdx + 1;
          const dayCours   = coursSlots.filter(s => s.day_of_week === dayNum);
          const dayTraining = trainingSessions.filter(s => s.day_of_week === dayNum);
          const showGhost   = ghost?.day    === dayNum && dragging;
          const showLibGhost = libGhost?.day === dayNum && libDrag;

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
                />
              ))}

              {/* Ghost déplacement interne */}
              {showGhost && (
                <div
                  className="absolute left-0.5 right-0.5 rounded z-30 opacity-50 border-2 border-white border-dashed pointer-events-none"
                  style={{
                    top:            `${minutesToPx(timeToMinutes(ghost.startTime))}px`,
                    height:         `${Math.max(minutesToPx(timeToMinutes(ghost.endTime)) - minutesToPx(timeToMinutes(ghost.startTime)), 20)}px`,
                    backgroundColor: dragging.session.training_type?.color || '#3b82f6',
                  }}
                />
              )}

              {/* Ghost dépôt depuis la bibliothèque */}
              {showLibGhost && (
                <div
                  className="absolute left-0.5 right-0.5 rounded z-30 opacity-60 border-2 border-white border-dashed pointer-events-none flex items-start px-1.5 py-1"
                  style={{
                    top:            `${minutesToPx(timeToMinutes(libGhost.startTime))}px`,
                    height:         `${Math.max(minutesToPx(timeToMinutes(libGhost.endTime)) - minutesToPx(timeToMinutes(libGhost.startTime)), 20)}px`,
                    backgroundColor: libDrag.color || '#3b82f6',
                  }}
                >
                  <span className="text-[10px] text-white font-semibold truncate">{libDrag.title}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <div className="text-center text-[11px] text-gray-400 py-2 border-t border-gray-100 bg-gray-50">
          {libDrag ? 'Déposez sur le jour et l\'heure souhaités' : 'Glissez un bloc · Cliquez pour ajouter'}
        </div>
      )}
    </div>
  );
}

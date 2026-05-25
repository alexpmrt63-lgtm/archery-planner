import { format, addWeeks, subWeeks, parseISO, startOfISOWeek } from 'date-fns';
import { fr } from 'date-fns/locale';

function currentMonday() {
  return format(startOfISOWeek(new Date()), 'yyyy-MM-dd');
}

export default function WeekPicker({ weekStart, onChange }) {
  // Snap au lundi de la semaine ISO (corrige tout décalage résiduel)
  const monday = format(startOfISOWeek(parseISO(weekStart)), 'yyyy-MM-dd');
  const date = parseISO(monday);
  const isCurrentWeek = monday === currentMonday();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(format(subWeeks(date, 1), 'yyyy-MM-dd'))}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 text-lg font-medium leading-none"
      >
        ‹
      </button>

      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-gray-700 min-w-[170px] text-center">
          Semaine du {format(date, "d MMMM yyyy", { locale: fr })}
        </span>
        {!isCurrentWeek && (
          <button
            onClick={() => onChange(currentMonday())}
            title="Revenir à cette semaine"
            className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-full transition font-medium"
          >
            Aujourd'hui
          </button>
        )}
      </div>

      <button
        onClick={() => onChange(format(addWeeks(date, 1), 'yyyy-MM-dd'))}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 text-lg font-medium leading-none"
      >
        ›
      </button>
    </div>
  );
}

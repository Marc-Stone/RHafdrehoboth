import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDateFr } from '@/utils/date';

interface ExportMenuProps {
  onExportDay: (date: string) => void;
  onExportAll: () => void;
  countForDate: (date: string) => number;
  totalCount: number;
}

export default function ExportMenu({ onExportDay, onExportAll, countForDate, totalCount }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const dayCount = useMemo(() => (date ? countForDate(date) : 0), [date, countForDate]);

  const runDay = () => {
    if (!date || dayCount === 0) return;
    onExportDay(date);
    setOpen(false);
  };

  const runAll = () => {
    onExportAll();
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
      >
        <span className="flex h-5 w-5 items-center justify-center">
          <i className="ri-download-2-line text-base"></i>
        </span>
        Exporter par jour
        <span className="flex h-5 w-5 items-center justify-center">
          <i className={open ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}></i>
        </span>
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-background-200 bg-background-50 p-4 shadow-xl animate-fade-up">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <i className="ri-calendar-check-line"></i>
            </div>
            <div>
              <h3 className="font-heading text-sm font-semibold text-foreground-900">Exporter par jour</h3>
              <p className="mt-0.5 text-xs text-foreground-500">
                Choisissez une date pour n'exporter que les présences de cette journée.
              </p>
            </div>
          </div>

          <label className="mt-4 block text-xs font-medium text-foreground-700">Jour à exporter</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1.5 w-full cursor-pointer rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm text-foreground-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />

          {date && (
            <p className="mt-2 text-xs text-foreground-500">
              {dayCount > 0 ? (
                <>
                  <strong className="text-foreground-800">{dayCount}</strong> présence{dayCount > 1 ? 's' : ''} le{' '}
                  {formatDateFr(date)}.
                </>
              ) : (
                <>Aucune présence enregistrée le {formatDateFr(date)}.</>
              )}
            </p>
          )}

          <button
            onClick={runDay}
            disabled={!date || dayCount === 0}
            className="mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <i className="ri-file-download-line text-base"></i>
            Exporter ce jour
          </button>

          <div className="my-3 flex items-center gap-2">
            <span className="h-px flex-1 bg-background-200"></span>
            <span className="text-[11px] uppercase tracking-wide text-foreground-400">ou</span>
            <span className="h-px flex-1 bg-background-200"></span>
          </div>

          <button
            onClick={runAll}
            disabled={totalCount === 0}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-background-200 px-4 py-2.5 text-sm font-medium text-foreground-700 transition-colors hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <i className="ri-history-line text-base"></i>
            Exporter tout l'historique ({totalCount})
          </button>
        </div>
      )}
    </div>
  );
}
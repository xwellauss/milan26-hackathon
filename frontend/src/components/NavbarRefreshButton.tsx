import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw, Check, X } from 'lucide-react';
import { useData } from '../context/AppContext';

export const NavbarRefreshButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { refreshCurrentData } = useData();
  const [buttonState, setButtonState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleRefresh = async () => {
    if (buttonState === 'loading') return;
    if (timerRef.current) clearTimeout(timerRef.current);

    setButtonState('loading');

    try {
      const success = await refreshCurrentData();
      if (success) {
        setButtonState('success');
      } else {
        setButtonState('error');
      }
    } catch {
      setButtonState('error');
    }

    // Hold the success/error state for 2.5 seconds, then morph back to the original refresh button
    timerRef.current = setTimeout(() => {
      setButtonState('idle');
    }, 2500);
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={buttonState === 'loading'}
      title={
        buttonState === 'loading'
          ? 'Refreshing active tab data...'
          : buttonState === 'success'
          ? 'Data refreshed successfully!'
          : buttonState === 'error'
          ? 'Failed to refresh data'
          : 'Refresh data from database'
      }
      aria-label="Refresh database data"
      className={`group w-full flex items-center rounded-lg text-xs font-medium transition-all duration-300 active:scale-[0.97] cursor-pointer ${
        compact ? 'justify-center p-2.5' : 'justify-start px-3 py-2'
      } ${
        buttonState === 'loading'
          ? 'bg-indigo-50/90 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
          : buttonState === 'success'
          ? 'bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
          : buttonState === 'error'
          ? 'bg-rose-50/90 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/60 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent'
      }`}
    >
      <div className={`flex items-center ${compact ? 'justify-center' : 'gap-2.5'}`}>
        <div className="relative w-4 h-4 flex items-center justify-center shrink-0">
          {buttonState === 'idle' && (
            <RefreshCw className="w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 group-hover:rotate-180" />
          )}
          {buttonState === 'loading' && (
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
          )}
          {buttonState === 'success' && (
            <span className="inline-flex animate-scale-in">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
            </span>
          )}
          {buttonState === 'error' && (
            <span className="inline-flex animate-scale-in">
              <X className="w-4 h-4 text-rose-600 dark:text-rose-400 stroke-[2.5]" />
            </span>
          )}
        </div>

        {!compact && (
          <span className="transition-all duration-200 truncate font-medium">
            {buttonState === 'loading' && 'Refreshing...'}
            {buttonState === 'success' && 'Refreshed!'}
            {buttonState === 'error' && 'Failed'}
            {buttonState === 'idle' && 'Refresh Data'}
          </span>
        )}
      </div>
    </button>
  );
};

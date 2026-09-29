import React, { useState } from 'react';
import { 
  Database, RefreshCw, CheckCircle2, AlertTriangle, X, 
  ExternalLink, ShieldAlert, Layers, Info
} from 'lucide-react';
import { useData } from '../context/AppContext';

export const AirtableStatusBadge: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { airtableStatus, refreshAirtable, isAirtableLoading } = useData();
  const [isOpen, setIsOpen] = useState(false);

  const isConnected = airtableStatus.connected;
  const isPermissionDenied = airtableStatus.status === 'permission_denied' || airtableStatus.statusCode === 403;
  const isSyncing = isAirtableLoading || airtableStatus.status === 'syncing' || airtableStatus.status === 'loading';

  return (
    <>
      {/* Badge Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`group flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer border ${
          isSyncing
            ? 'bg-indigo-50/70 border-indigo-200/80 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300'
            : isConnected
            ? 'bg-emerald-50/80 border-emerald-200/80 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/70'
            : isPermissionDenied
            ? 'bg-amber-50/80 border-amber-200/80 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300 hover:bg-amber-100/70'
            : 'bg-rose-50/80 border-rose-200/80 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300 hover:bg-rose-100/70'
        }`}
        title="View Airtable Database Sync Status"
      >
        <span className="relative flex h-2 w-2">
          {isSyncing ? (
            <span className="animate-spin inline-block w-2 h-2 rounded-full border border-indigo-600 border-t-transparent" />
          ) : isConnected ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </>
          ) : isPermissionDenied ? (
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          ) : (
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
          )}
        </span>

        <span className="flex items-center gap-1.5 font-medium">
          <Database className="w-3.5 h-3.5 opacity-80" />
          {!compact && (
            <span>
              {isSyncing
                ? 'Syncing Airtable...'
                : isConnected
                ? 'Airtable Active'
                : isPermissionDenied
                ? 'Airtable: Permission'
                : 'Airtable Disconnected'}
            </span>
          )}
        </span>
      </button>

      {/* Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-backdrop-enter">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-modal-enter">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Airtable Database Status
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Base: <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300 font-semibold">{airtableStatus.baseId}</code>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
              {/* Status Banner */}
              <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                isConnected
                  ? 'bg-emerald-50/80 border-emerald-200/80 dark:bg-emerald-950/30 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200'
                  : isPermissionDenied
                  ? 'bg-amber-50/90 border-amber-200/80 dark:bg-amber-950/30 dark:border-amber-800/80 text-amber-950 dark:text-amber-200'
                  : 'bg-rose-50/80 border-rose-200/80 dark:bg-rose-950/30 dark:border-rose-800/80 text-rose-900 dark:text-rose-200'
              }`}>
                {isConnected ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : isPermissionDenied ? (
                  <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="text-xs leading-relaxed space-y-1">
                  <div className="font-semibold text-sm">
                    {isConnected
                      ? 'Connected and Synchronized'
                      : isPermissionDenied
                      ? 'Airtable Permissions Configuration Required'
                      : 'Connection Pending'}
                  </div>
                  <p className="opacity-90">
                    {airtableStatus.message || (isConnected ? 'Read and write operations are routed directly to your Airtable base.' : 'Airtable token needs access.')}
                  </p>
                </div>
              </div>

              {/* Instructions if permission is needed */}
              {isPermissionDenied && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                    <Info className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>How to enable your Personal Access Token in Airtable:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 ml-1 text-slate-600 dark:text-slate-400 leading-relaxed">
                    <li>
                      Visit{' '}
                      <a
                        href="https://airtable.com/create/tokens"
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 dark:text-indigo-400 underline font-medium inline-flex items-center gap-0.5"
                      >
                        airtable.com/create/tokens
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </li>
                    <li>
                      Click on your token and verify <strong>Scopes</strong> include:
                      <div className="mt-1 flex flex-wrap gap-1">
                        <code className="bg-slate-200/80 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-800 dark:text-slate-200">data.records:read</code>
                        <code className="bg-slate-200/80 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-800 dark:text-slate-200">data.records:write</code>
                      </div>
                    </li>
                    <li className="mt-1">
                      Under <strong>Access</strong>, click <strong>"Add a base"</strong> and select your base:
                      <div className="mt-1">
                        <code className="bg-slate-200/80 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-800 dark:text-slate-200 font-semibold">{airtableStatus.baseId}</code>
                        {' '}(or select <em>"All current and future bases"</em>).
                      </div>
                    </li>
                    <li className="mt-1">
                      Save changes in Airtable, then click <strong>"Test & Re-sync"</strong> below.
                    </li>
                  </ol>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 italic pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    * Note: While waiting for permissions to be saved in Airtable, IRIS maintains full interactive state and offline resilience with all your CSV data ready.
                  </p>
                </div>
              )}

              {/* 12 Tables Overview */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  <Layers className="w-4 h-4 text-slate-400" />
                  <span>Configured Database Tables (12)</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  {[
                    'MOCK_USERS',
                    'INITIAL_ANNOUNCEMENTS',
                    'INITIAL_THREADS',
                    'INITIAL_REPLIES',
                    'INITIAL_SCHEDULES',
                    'INITIAL_BASE_EVENTS',
                    'INITIAL_EXCEPTIONS',
                    'INITIAL_EXAMS',
                    'INITIAL_FOLDERS',
                    'INITIAL_RESOURCES',
                    'INITIAL_COURSES',
                    'INITIAL_ENROLLMENTS'
                  ].map(table => (
                    <div
                      key={table}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 font-mono text-slate-600 dark:text-slate-400 flex items-center justify-between"
                    >
                      <span className="truncate">{table}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 ml-1" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                {airtableStatus.lastSyncedAt ? `Synced at ${new Date(airtableStatus.lastSyncedAt).toLocaleTimeString()}` : 'Real-time proxy active'}
              </span>
              <button
                onClick={() => refreshAirtable()}
                disabled={isSyncing}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 active:scale-98 transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Testing...' : 'Test & Re-sync'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

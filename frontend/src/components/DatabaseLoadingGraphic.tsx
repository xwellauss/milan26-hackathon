import React from "react";
import type { Database, LucideIcon } from "lucide-react";

interface DatabaseLoadingGraphicProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  color?:
    | "emerald"
    | "indigo"
    | "amber"
    | "yellow"
    | "purple"
    | "rose"
    | "slate";
  compact?: boolean;
  className?: string;
}

const COLOR_MAP = {
  emerald: {
    ring: "border-emerald-500/25 border-t-emerald-600 dark:border-t-emerald-400",
    pulse: "bg-emerald-500/10 dark:bg-emerald-500/15",
    icon: "text-emerald-600 dark:text-emerald-400",
    badge:
      "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800",
  },
  indigo: {
    ring: "border-indigo-500/25 border-t-indigo-600 dark:border-t-indigo-400",
    pulse: "bg-indigo-500/10 dark:bg-indigo-500/15",
    icon: "text-indigo-600 dark:text-indigo-400",
    badge:
      "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800",
  },
  amber: {
    ring: "border-amber-500/25 border-t-amber-600 dark:border-t-amber-400",
    pulse: "bg-amber-500/10 dark:bg-amber-500/15",
    icon: "text-amber-600 dark:text-amber-400",
    badge:
      "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200/80 dark:border-amber-800",
  },
  yellow: {
    ring: "border-yellow-500/25 border-t-yellow-600 dark:border-t-yellow-400",
    pulse: "bg-yellow-500/10 dark:bg-yellow-500/15",
    icon: "text-yellow-600 dark:text-yellow-400",
    badge:
      "bg-yellow-50 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-300 border-yellow-200/80 dark:border-yellow-800",
  },
  purple: {
    ring: "border-purple-500/25 border-t-purple-600 dark:border-t-purple-400",
    pulse: "bg-purple-500/10 dark:bg-purple-500/15",
    icon: "text-purple-600 dark:text-purple-400",
    badge:
      "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200/80 dark:border-purple-800",
  },
  rose: {
    ring: "border-rose-500/25 border-t-rose-600 dark:border-t-rose-400",
    pulse: "bg-rose-500/10 dark:bg-rose-500/15",
    icon: "text-rose-600 dark:text-rose-400",
    badge:
      "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-800",
  },
  slate: {
    ring: "border-slate-500/25 border-t-slate-600 dark:border-t-slate-400",
    pulse: "bg-slate-500/10 dark:bg-slate-500/15",
    icon: "text-slate-600 dark:text-slate-400",
    badge:
      "bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800",
  },
};

export const DatabaseLoadingGraphic: React.FC<DatabaseLoadingGraphicProps> = ({
  title = "Loading Data",
  description = "Querying database for records...",
  icon: Icon = Database,
  color = "indigo",
  compact = false,
  className = "",
}) => {
  const styles = COLOR_MAP[color] || COLOR_MAP.indigo;

  if (compact) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-6 text-center animate-fade-in ${className}`}
      >
        <div className="relative flex items-center justify-center w-9 h-9 mb-2.5">
          <div
            className={`absolute inset-0 rounded-full animate-ping opacity-30 ${styles.pulse}`}
          />
          <div
            className={`w-9 h-9 rounded-full border-2 animate-spin ${styles.ring}`}
          />
          <Icon className={`w-4 h-4 absolute ${styles.icon}`} />
        </div>
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          {title}
        </p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
          {description}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-4 text-center animate-fade-in ${className}`}
    >
      {/* Graphic with dual pulsing halo and spinning perimeter ring */}
      <div className="relative flex items-center justify-center w-14 h-14 mb-3.5">
        <div
          className={`absolute inset-0 rounded-2xl animate-pulse ${styles.pulse}`}
        />
        <div
          className={`w-14 h-14 rounded-2xl border-2 animate-spin ${styles.ring}`}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className={`w-6 h-6 ${styles.icon}`} />
        </div>
      </div>

      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">
        {title}
      </h4>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm leading-relaxed">
        {description}
      </p>

      {/* Database Querying indicator pill */}
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase mt-3.5 border ${styles.badge}`}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
        </span>
        <span>Querying Database</span>
      </div>
    </div>
  );
};

import React from 'react';
import { 
  Database, Loader2, MessageSquare, MessagesSquare, FileText, 
  FolderGit2, GraduationCap, Calendar, Bell, Sparkles
} from 'lucide-react';

export type ResourceQueryType = 
  | 'forum_threads' 
  | 'forum_replies' 
  | 'announcement_replies'
  | 'resource_directory' 
  | 'resource_content' 
  | 'curriculum_courses' 
  | 'schedules_events' 
  | 'announcements' 
  | 'dashboard_workspace'
  | 'general';

interface DatabaseLoaderProps {
  type?: ResourceQueryType;
  resourceName?: string;
  message?: string;
  variant?: 'fullscreen' | 'panel' | 'inline' | 'card' | 'sidebar' | 'compact';
  className?: string;
}

const RESOURCE_CONFIG: Record<ResourceQueryType, {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  colorClass: string;
}> = {
  forum_threads: {
    icon: MessageSquare,
    title: 'Loading Forum Topics',
    description: 'Fetching discussion threads from database...',
    colorClass: 'text-emerald-600 dark:text-emerald-400'
  },
  forum_replies: {
    icon: MessagesSquare,
    title: 'Loading Discussion',
    description: 'Fetching conversation history from database...',
    colorClass: 'text-teal-600 dark:text-teal-400'
  },
  announcement_replies: {
    icon: MessagesSquare,
    title: 'Loading Replies',
    description: 'Fetching announcement replies from database...',
    colorClass: 'text-amber-600 dark:text-amber-400'
  },
  resource_directory: {
    icon: FolderGit2,
    title: 'Loading Resources',
    description: 'Fetching directory and folder contents...',
    colorClass: 'text-sky-600 dark:text-sky-400'
  },
  resource_content: {
    icon: FileText,
    title: 'Loading Document',
    description: 'Fetching document content from database...',
    colorClass: 'text-blue-600 dark:text-blue-400'
  },
  curriculum_courses: {
    icon: GraduationCap,
    title: 'Loading Curriculum',
    description: 'Fetching enrolled courses from database...',
    colorClass: 'text-rose-600 dark:text-rose-400'
  },
  schedules_events: {
    icon: Calendar,
    title: 'Loading Timetable',
    description: 'Fetching schedules and exam dates...',
    colorClass: 'text-indigo-600 dark:text-indigo-400'
  },
  announcements: {
    icon: Bell,
    title: 'Loading Announcements',
    description: 'Fetching campus notices from database...',
    colorClass: 'text-amber-600 dark:text-amber-400'
  },
  dashboard_workspace: {
    icon: Sparkles,
    title: 'Loading Workspace',
    description: 'Syncing schedule, courses, and notices...',
    colorClass: 'text-emerald-600 dark:text-emerald-400'
  },
  general: {
    icon: Database,
    title: 'Loading Data',
    description: 'Querying database...',
    colorClass: 'text-slate-600 dark:text-slate-400'
  }
};

export const DatabaseLoader: React.FC<DatabaseLoaderProps> = ({
  type = 'general',
  resourceName,
  message,
  variant = 'panel',
  className = ''
}) => {
  const config = RESOURCE_CONFIG[type] || RESOURCE_CONFIG.general;
  const MainIcon = config.icon;
  const displayTitle = resourceName ? `Loading ${resourceName}` : config.title;
  const displayDesc = message || config.description;

  // Sidebar variant (used inside lists / thread drawer)
  if (variant === 'sidebar') {
    return (
      <div className={`p-5 flex flex-col items-center justify-center text-center space-y-3 animate-fade-in ${className}`}>
        <div className="relative flex items-center justify-center">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
            <MainIcon className="w-5 h-5 opacity-80" />
          </div>
          <Loader2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-spin absolute -bottom-1 -right-1" />
        </div>
        <div className="space-y-0.5">
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            {displayTitle}
          </p>
          <p className="text-[11px] text-slate-400">
            {displayDesc}
          </p>
        </div>
      </div>
    );
  }

  // Compact variant (ideal for small drawers / replies)
  if (variant === 'compact') {
    return (
      <div className={`py-6 px-4 flex flex-col items-center justify-center text-center space-y-2.5 animate-fade-in ${className}`}>
        <div className="flex items-center gap-2.5 text-xs font-medium text-slate-600 dark:text-slate-300">
          <Loader2 className="w-4 h-4 animate-spin text-amber-500 dark:text-amber-400 shrink-0" />
          <span>{displayTitle}</span>
        </div>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          {displayDesc}
        </p>
      </div>
    );
  }

  // Inline status badge
  if (variant === 'inline') {
    return (
      <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 animate-fade-in ${className}`}>
        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 dark:text-emerald-400" />
        <span>{displayTitle}</span>
      </div>
    );
  }

  // Simple, elegant panel / card loader
  return (
    <div className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 backdrop-blur-xs animate-fade-in ${className}`}>
      {/* Icon with smooth spinner */}
      <div className="relative mb-4 flex items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center shadow-xs">
          <MainIcon className={`w-6 h-6 ${config.colorClass}`} />
        </div>
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-2xs">
          <Loader2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 animate-spin" />
        </div>
      </div>

      {/* Title and Message */}
      <div className="space-y-1 max-w-xs">
        <h3 className="font-semibold text-sm sm:text-base text-slate-800 dark:text-slate-200">
          {displayTitle}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {displayDesc}
        </p>
      </div>

      {/* Minimal clean progress bar */}
      <div className="w-36 sm:w-44 h-1 bg-slate-200/80 dark:bg-slate-800 rounded-full mt-5 overflow-hidden">
        <div className="h-full bg-emerald-500/80 dark:bg-emerald-400 rounded-full w-2/5 animate-shimmer" />
      </div>
    </div>
  );
};


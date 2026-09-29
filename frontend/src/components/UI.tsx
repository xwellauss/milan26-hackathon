import React from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Tag, ThreadTag, User, Role, Branch } from '../types';

// Lightweight in-memory public role tag cache (only holds role labels like "CS CR" or "VK HR")
// Never stores user records, passwords, or emails.
const publicRoleTags = new Map<string, string>();

export const registerUserRole = (u?: { id?: string; name?: string; role?: Role; branch?: Branch; hostel?: string } | null) => {
  if (!u) return;
  let tag: string | null = null;
  if (u.role === 'CR') {
    const branch = u.branch && u.branch !== '-' ? u.branch : 'CS';
    tag = `${branch} CR`;
  } else if (u.role === 'HR') {
    tag = `${u.hostel || 'Hostel'} HR`;
  }
  if (tag) {
    if (u.id) publicRoleTags.set(u.id, tag);
    if (u.name) publicRoleTags.set(cleanDisplayName(u.name).toLowerCase(), tag);
  }
};

export const registerRepsForRoleLookup = (reps: Array<{ id: string; name: string; role: Role; branch: Branch; hostel: string }>) => {
  if (Array.isArray(reps)) {
    reps.forEach(registerUserRole);
  }
};

// Legacy compatibility shim that only records public role tags
export const registerUsersForRoleLookup = (users: Array<{ id?: string; name?: string; role?: Role; branch?: Branch; hostel?: string }>) => {
  if (Array.isArray(users)) {
    users.forEach(registerUserRole);
  }
};

export const Button = ({ children, onClick, variant = 'primary', className = '', ...props }: any) => {
  const base = "px-4 py-2 rounded-xl font-medium transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer text-sm select-none";
  const variants = {
    primary: "bg-indigo-600/90 text-white hover:bg-indigo-600 active:bg-indigo-700 shadow-2xs dark:bg-indigo-500/80 dark:hover:bg-indigo-500 dark:text-slate-50",
    amber: "bg-amber-600/90 text-white hover:bg-amber-600 active:bg-amber-700 shadow-2xs dark:bg-amber-500/85 dark:hover:bg-amber-500 dark:text-slate-50",
    emerald: "bg-emerald-600/90 text-white hover:bg-emerald-600 active:bg-emerald-700 shadow-2xs dark:bg-emerald-500/85 dark:hover:bg-emerald-500 dark:text-slate-50",
    rose: "bg-rose-600/90 text-white hover:bg-rose-600 active:bg-rose-700 shadow-2xs dark:bg-rose-500/85 dark:hover:bg-rose-500 dark:text-slate-50",
    secondary: "bg-slate-100/80 text-slate-700 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-750 border border-slate-200/60 dark:border-slate-700/60",
    danger: "bg-rose-600/85 text-white hover:bg-rose-600 active:bg-rose-700 shadow-2xs dark:bg-rose-500/80 dark:hover:bg-rose-500",
    warning: "bg-amber-600/85 text-white hover:bg-amber-600 active:bg-amber-700 shadow-2xs dark:bg-amber-500/80 dark:hover:bg-amber-500",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
  };
  return (
    <button onClick={onClick} className={`${base} ${variants[variant as keyof typeof variants] || variants.primary} ${className}`} {...props}>
      {children}
    </button>
  );
};

export const Input = ({ label, ...props }: any) => (
  <div className="mb-4">
    {label && <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">{label}</label>}
    <input 
      className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/80 outline-none bg-white dark:bg-slate-800/90 dark:text-slate-100 transition-all text-sm font-normal placeholder:text-slate-400 dark:placeholder:text-slate-500" 
      {...props} 
    />
  </div>
);

export const Select = ({ label, children, ...props }: any) => (
  <div className="mb-4">
    {label && <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">{label}</label>}
    <select 
      className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/80 outline-none bg-white dark:bg-slate-800/90 dark:text-slate-100 transition-all text-sm font-normal cursor-pointer" 
      {...props} 
    >
      {children}
    </select>
  </div>
);

/**
 * Strips any legacy "(CR)" or "(HR)" suffix from a display name
 */
export const cleanDisplayName = (rawName?: string): string => {
  if (!rawName) return 'Student';
  return rawName.replace(/\s*\((?:CR|HR)\)\s*/gi, '').trim();
};

/**
 * Resolves the subtle role tag for a user (e.g. "CS CR", "EE CR", "MnC CR", "Vivekananda HR")
 */
export const getUserRoleTag = (opts: {
  user?: User | null;
  userId?: string;
  name?: string;
}): string | null => {
  if (opts.user) {
    if (opts.user.role === 'CR') {
      const branch = opts.user.branch && opts.user.branch !== '-' ? opts.user.branch : 'CS';
      return `${branch} CR`;
    }
    if (opts.user.role === 'HR') {
      return `${opts.user.hostel} HR`;
    }
  }

  if (opts.userId && publicRoleTags.has(opts.userId)) {
    return publicRoleTags.get(opts.userId)!;
  }

  if (opts.name) {
    const cleaned = cleanDisplayName(opts.name).toLowerCase();
    if (publicRoleTags.has(cleaned)) {
      return publicRoleTags.get(cleaned)!;
    }
  }

  return null;
};

/**
 * Extracts literal search tokens from a query (supports both normal text and wildcard patterns like *.pdf or abc_*.pdf)
 */
export const getHighlightTokens = (query?: string): string[] => {
  if (!query || !query.trim()) return [];
  const trimmed = query.trim();
  if (trimmed.includes('*') || trimmed.includes('?')) {
    return trimmed
      .split(/[*?]+/)
      .map(s => s.trim())
      .filter(Boolean);
  }
  return [trimmed];
};

/**
 * Highlights exact matching parts of `text` based on `query`
 */
export const HighlightText = ({
  text,
  query,
  className = ''
}: {
  text: string;
  query?: string;
  className?: string;
}) => {
  const tokens = getHighlightTokens(query);
  if (!text || tokens.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const escapedTokens = tokens
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length);

  if (escapedTokens.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const regex = new RegExp(`(${escapedTokens.join('|')})`, 'gi');
  const parts = text.split(regex);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        const isMatch = tokens.some(t => t.toLowerCase() === part.toLowerCase());
        return isMatch ? (
          <mark
            key={i}
            className="bg-amber-200/85 dark:bg-amber-500/35 text-slate-900 dark:text-amber-100 rounded-xs px-0.5 font-semibold"
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        );
      })}
    </span>
  );
};

/**
 * Renders a user's name along with a subtle plain "<branch> CR" or "<hostel> HR" tag when applicable
 */
export const UserNameWithTag = ({
  user,
  userId,
  name,
  highlightQuery,
  nameClassName = '',
  tagClassName = '',
  className = ''
}: {
  user?: User | null;
  userId?: string;
  name?: string;
  highlightQuery?: string;
  nameClassName?: string;
  tagClassName?: string;
  className?: string;
}) => {
  const displayName = cleanDisplayName(name || user?.name);
  const roleTag = getUserRoleTag({ user, userId, name: displayName });

  return (
    <span className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}>
      <HighlightText text={displayName} query={highlightQuery} className={`truncate ${nameClassName}`} />
      {roleTag && (
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100/90 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700/70 leading-none shrink-0 ${tagClassName}`}
        >
          <HighlightText text={roleTag} query={highlightQuery} />
        </span>
      )}
    </span>
  );
};

export const TagIcon = ({ tag, highlightQuery }: { tag: Tag | ThreadTag; highlightQuery?: string }) => {
  switch (tag) {
    case 'URGENT': 
      return <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50/80 border border-rose-200/50 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/40 px-2 py-0.5 rounded-md"><AlertTriangle className="w-3 h-3 text-rose-500" /> <HighlightText text="URGENT" query={highlightQuery} /></span>;
    case 'IMPORTANT': 
      return <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50/80 border border-amber-200/50 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40 px-2 py-0.5 rounded-md"><AlertCircle className="w-3 h-3 text-amber-500" /> <HighlightText text="IMPORTANT" query={highlightQuery} /></span>;
    case 'INFO': 
      return <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100/80 border border-slate-200/60 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 px-2 py-0.5 rounded-md"><Info className="w-3 h-3 text-slate-400" /> <HighlightText text="INFO" query={highlightQuery} /></span>;
    case 'EXAM': 
      return <span className="px-2 py-0.5 text-[11px] font-medium text-purple-700 bg-purple-50/80 border border-purple-200/50 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/40 rounded-md"><HighlightText text="EXAM" query={highlightQuery} /></span>;
    case 'LECTURE': 
      return <span className="px-2 py-0.5 text-[11px] font-medium text-emerald-700 bg-emerald-50/80 border border-emerald-200/50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40 rounded-md"><HighlightText text="LECTURE" query={highlightQuery} /></span>;
    case 'Academic': 
      return <span className="px-2 py-0.5 text-[11px] font-medium text-indigo-700 bg-indigo-50/80 border border-indigo-200/50 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/40 rounded-md">Academic</span>;
    case 'Announcement Discussion': 
      return <span className="px-2 py-0.5 text-[11px] font-medium text-teal-700 bg-teal-50/80 border border-teal-200/50 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900/40 rounded-md">Discussion</span>;
    case 'TimePass': 
      return <span className="px-2 py-0.5 text-[11px] font-medium text-slate-600 bg-slate-100/80 border border-slate-200/50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 rounded-md">General</span>;
    default: 
      return null;
  }
};

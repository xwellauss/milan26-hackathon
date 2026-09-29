import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Bell, Filter, Plus, Edit2, Trash2, X, MessageSquare, Send, Check, Search, RotateCcw,
  Eye, Code2, Maximize2, Minimize2, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth, useData } from '../context/AppContext';
import { Announcement, Reply, Tag } from '../types';
import { Button, TagIcon, UserNameWithTag, HighlightText } from './UI';
import { SimpleMarkdown } from './Markdown';
import { MarkdownToolbar, handleMarkdownKeydown } from './MarkdownToolbar';
import { DatabaseLoader } from './DatabaseLoader';

const ChatBubble = ({ 
  msg, 
  onDelete, 
  onEdit 
}: { 
  msg: Reply; 
  onDelete?: (id: string) => void; 
  onEdit?: (id: string, newContent: string) => void;
}) => {
  const { user } = useAuth();
  const isMe = msg.author_id === user?.id;
  const isDeleted = msg.is_deleted;
  const timePassed = Date.now() - msg.created_at;
  const canEdit = isMe && !isDeleted && timePassed <= 300000; // 5 minutes
  
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(msg.content);

  if (isDeleted) {
    return (
      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-2.5 animate-scale-in`}>
        <div className="px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 italic text-xs border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1.5">
          <span>🚫</span>
          <UserNameWithTag userId={msg.author_id} name={msg.author_name} />
          <span>deleted this message.</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-3 group ${isMe ? 'animate-msg-own' : 'animate-msg-other'}`}>
      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1 mx-1 font-medium">
        <UserNameWithTag userId={msg.author_id} name={msg.author_name} />
        <span className="opacity-60 font-normal text-[10px] font-mono tabular-nums">
          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div className="relative flex items-start max-w-[85%] sm:max-w-[70%] group">
        <div className={`px-3.5 py-2.5 rounded-2xl transition-all duration-150 ${
          isMe 
            ? 'bg-indigo-600 text-slate-50 rounded-tr-xs shadow-2xs' 
            : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-xs shadow-2xs border border-slate-200/80 dark:border-slate-700'
        }`}>
          {isEditing ? (
            <div className="flex flex-col gap-2 min-w-[200px] animate-scale-in">
              <textarea 
                className="w-full p-2 text-slate-900 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono" 
                value={editContent} 
                onChange={e => setEditContent(e.target.value)} 
                onKeyDown={e => handleMarkdownKeydown(e, editContent, setEditContent)}
                autoFocus
              />
              <div className="flex justify-end gap-2 text-white">
                <button onClick={() => setIsEditing(false)} className="text-xs font-medium hover:underline opacity-90 cursor-pointer">Cancel</button>
                <button onClick={() => { onEdit?.(msg.id, editContent); setIsEditing(false); }} className="text-xs font-bold bg-white/20 px-2 py-1 rounded hover:bg-white/30 active:scale-95 transition-transform cursor-pointer">Save</button>
              </div>
            </div>
          ) : (
            <SimpleMarkdown inverted={isMe}>{msg.content}</SimpleMarkdown>
          )}
        </div>

        {isMe && !isEditing && (
          <div className={`absolute top-1 ${isMe ? '-left-15' : '-right-15'} opacity-0 translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150 flex gap-1 bg-white dark:bg-slate-800 p-1 rounded-lg shadow-xs border border-slate-200 dark:border-slate-700`}>
            {canEdit && (
              <button 
                onClick={() => setIsEditing(true)} 
                className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-90 transition-all cursor-pointer"
                title="Edit message"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button 
              onClick={() => onDelete?.(msg.id)} 
              className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 active:scale-90 transition-all cursor-pointer"
              title="Delete message"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

import { airtableService } from '../services/airtableService';

export const Announcements = () => {
  const { user } = useAuth();
  const { 
    announcements, replies, addReply, deleteReply, editReply,
    addAnnouncement, editAnnouncement, deleteAnnouncement,
    isAirtableLoading, loadingTabPath
  } = useData();
  
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [typeFilter, setTypeFilter] = useState<'all' | 'academic' | 'hostel'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'priority'>('newest');
  
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [activeAnnouncementReplies, setActiveAnnouncementReplies] = useState<Reply[]>([]);
  const [isRepliesLoading, setIsRepliesLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const repliesContainerRef = useRef<HTMLDivElement>(null);

  // 1-second auto-refresh for announcement replies & memory cleanup on close/unmount
  useEffect(() => {
    if (!activeThread) {
      setActiveAnnouncementReplies([]);
      setIsRepliesLoading(false);
      return;
    }

    let isMounted = true;
    setIsRepliesLoading(true);

    const refreshAnnouncementReplies = async (isInitial = false) => {
      try {
        const fetched = await airtableService.fetchRepliesForTarget(activeThread);
        if (isMounted) {
          setActiveAnnouncementReplies(fetched.filter(r => !r.is_deleted));
        }
      } catch (err) {
        console.warn('[Announcements] Polling announcement replies error:', err);
      } finally {
        if (isInitial && isMounted) {
          setIsRepliesLoading(false);
        }
      }
    };

    refreshAnnouncementReplies(true);
    const intervalId = setInterval(() => refreshAnnouncementReplies(false), 1000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      setActiveAnnouncementReplies([]);
      setIsRepliesLoading(false);
    };
  }, [activeThread]);

  // Requirement 6: Default to 'collapsed' view
  const [viewDensity, setViewDensity] = useState<'expanded' | 'collapsed'>('collapsed');
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());

  const toggleCardExpand = (id: string) => {
    setExpandedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ content: string; tags: Tag[] }>({ content: '', tags: [] });
  const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const availableTags: Tag[] = ['URGENT', 'IMPORTANT', 'INFO', 'EXAM', 'LECTURE'];

  // Global ESC key to close modal & '/' shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isModalOpen) {
          setIsModalOpen(false);
        }
      }
      if (e.key === '/' && !isModalOpen) {
        const target = e.target as HTMLElement | null;
        if (target && target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const toggleTag = (tag: Tag) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleClearFilters = () => {
    setSelectedTags([]);
    setTypeFilter('all');
    setSearchQuery('');
  };

  const handleOpenModal = (mode: 'create' | 'edit', ann?: Announcement) => {
    setModalMode(mode);
    setEditorTab('write');
    if (mode === 'edit' && ann) {
      setEditId(ann.id);
      setFormData({ content: ann.content, tags: ann.tags });
    } else {
      setEditId(null);
      setFormData({ content: '', tags: [] });
    }
    setIsModalOpen(true);
  };

  const handleSaveAnnouncement = () => {
    if (!formData.content.trim()) return;
    if (modalMode === 'create') {
      addAnnouncement(formData.content, formData.tags);
    } else if (modalMode === 'edit' && editId) {
      editAnnouncement(editId, formData.content, formData.tags);
    }
    setIsModalOpen(false);
  };

  const getTagPriority = (tags: Tag[]) => {
    if (tags.includes('URGENT')) return 5;
    if (tags.includes('IMPORTANT')) return 4;
    if (tags.includes('INFO')) return 3;
    if (tags.includes('EXAM')) return 2;
    if (tags.includes('LECTURE')) return 1;
    return 0;
  };

  const visibleAnnouncements = useMemo(() => {
    let filtered = announcements.filter((a: Announcement) => {
      if (user?.role === 'Normal Student') {
        if (a.type === 'academic' && a.target !== user.branch && a.target !== 'All' && a.target !== '-') {
          return false;
        }
        if (a.type === 'hostel' && a.target !== user.hostel && a.target !== 'All') {
          return false;
        }
      }
      if (user?.role === 'HR') {
        if (a.type === 'academic') return false; 
        if (a.type === 'hostel' && a.target !== user.hostel && a.target !== 'All') {
          return false;
        }
      }

      if (typeFilter !== 'all' && a.type !== typeFilter) {
        return false;
      }

      if (selectedTags.length > 0) {
        const hasMatchingTag = a.tags && a.tags.some(tag => selectedTags.includes(tag));
        if (!hasMatchingTag) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const contentMatch = a.content.toLowerCase().includes(q);
        const authorMatch = (a.author_name || '').toLowerCase().includes(q);
        const targetMatch = a.target.toLowerCase().includes(q);
        const tagMatch = a.tags.some(t => t.toLowerCase().includes(q));
        if (!contentMatch && !authorMatch && !targetMatch && !tagMatch) {
          return false;
        }
      }
      
      return true;
    });

    return [...filtered].sort((a: Announcement, b: Announcement) => {
      if (sortOrder === 'newest') {
        return b.date_time - a.date_time;
      } else if (sortOrder === 'oldest') {
        return a.date_time - b.date_time;
      } else if (sortOrder === 'priority') {
        const priorityA = getTagPriority(a.tags);
        const priorityB = getTagPriority(b.tags);
        if (priorityA !== priorityB) {
          return priorityB - priorityA;
        }
        return b.date_time - a.date_time;
      }
      return 0;
    });
  }, [announcements, user, selectedTags, typeFilter, searchQuery, sortOrder]);

  const handleSendReply = (targetId: string) => {
    if (!replyText.trim()) return;
    addReply(targetId, replyText);
    setReplyText('');
    requestAnimationFrame(() => {
      if (repliesContainerRef.current) {
        repliesContainerRef.current.scrollTo({
          top: repliesContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    });
  };

  const hasActiveFilters = selectedTags.length > 0 || typeFilter !== 'all' || searchQuery.trim().length > 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-5 relative">
      {/* Compact Sidebar Controls: Filters and Sorting (Bell Yellow base tint) */}
      <div className="md:col-span-1">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-2xs border border-amber-200/70 dark:border-slate-800 sticky top-20 space-y-3.5">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100 text-sm">
              <Filter className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Filters & Sort</span>
            </div>
            {hasActiveFilters && (
              <button 
                onClick={handleClearFilters} 
                className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer animate-scale-in active:scale-95 transition-transform"
                title="Clear all active filters"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear All</span>
              </button>
            )}
          </div>

          {/* Compact Search Bar */}
          <div>
            <label className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase mb-1 block">
              Search
            </label>
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search text, author, tags..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-amber-50/30 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-900 dark:text-slate-100 outline-none placeholder-slate-400 transition-all duration-150"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer animate-scale-in"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Compact Category Type Filter */}
          <div>
            <label className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase mb-1 block">
              Category
            </label>
            <div className="grid grid-cols-3 gap-1 bg-slate-100/90 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/70 dark:border-slate-700">
              {(['all', 'academic', 'hostel'] as const).map(cat => (
                <button
                  key={cat}
                  onClick={() => setTypeFilter(cat)}
                  className={`py-1 text-xs font-semibold rounded-lg transition-all duration-150 active:scale-[0.97] cursor-pointer capitalize ${
                    typeFilter === cat
                      ? 'bg-white dark:bg-slate-700 text-amber-800 dark:text-amber-300 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          
          {/* Compact Tag Filter */}
          <div>
            <label className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase mb-1.5 block">
              Filter by Tag
            </label>
            <div className="flex flex-col gap-1">
              {availableTags.map(t => {
                const isSelected = selectedTags.includes(t);
                return (
                  <div
                    key={t}
                    onClick={() => toggleTag(t)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border transition-all duration-150 active:scale-[0.98] cursor-pointer select-none ${
                      isSelected
                        ? 'bg-amber-50/90 border-amber-300/80 dark:bg-amber-950/40 dark:border-amber-700/80'
                        : 'bg-transparent border-transparent hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all duration-150 ${
                        isSelected 
                          ? 'bg-amber-600 border-amber-600 text-white scale-105' 
                          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                      }`}>
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3] animate-scale-in" />}
                      </div>
                      <TagIcon tag={t} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Compact Sort By Dropdown */}
          <div>
            <label className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase mb-1 block">
              Sort Order
            </label>
            <select 
              value={sortOrder} 
              onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest' | 'priority')}
              className="w-full bg-amber-50/30 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-amber-500/20 outline-none cursor-pointer transition-all duration-150"
            >
              <option value="newest">Date: Newest First</option>
              <option value="oldest">Date: Oldest First</option>
              <option value="priority">Priority: Highest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Announcements Feed */}
      <div className="md:col-span-3 space-y-3.5">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Announcements
            </h2>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => {
                setViewDensity(prev => (prev === 'expanded' ? 'collapsed' : 'expanded'));
                setExpandedCardIds(new Set());
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-all duration-150 active:scale-[0.97] cursor-pointer border border-amber-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-amber-50/50 dark:hover:bg-slate-800 shadow-2xs"
              title={viewDensity === 'expanded' ? 'Switch to Collapsed View' : 'Switch to Expanded View'}
            >
              {viewDensity === 'expanded' ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-icon-pop" />
                  <span>Expanded View</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-icon-pop" />
                  <span>Collapsed View</span>
                </>
              )}
            </button>

            {(user?.role === 'CR' || user?.role === 'HR') && (
              <Button 
                variant="amber"
                onClick={() => handleOpenModal('create')}
                className="!text-xs !py-1.5 !px-3.5 font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Announcement</span>
              </Button>
            )}
          </div>
        </div>

        {/* Empty State / Database Loading State */}
        {(loadingTabPath === '/announcements' || (isAirtableLoading && announcements.length === 0)) ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200/80 dark:border-slate-800 p-8 shadow-2xs">
            <DatabaseLoader 
              type="announcements" 
              resourceName="Campus Announcements"
              message="Fetching official campus announcements and hostel notices from database..."
              variant="panel"
            />
          </div>
        ) : visibleAnnouncements.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-amber-200/80 dark:border-slate-800 p-8 shadow-2xs animate-tab-enter">
            <Bell className="w-10 h-10 text-amber-400 dark:text-slate-500 mx-auto mb-2.5" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">No announcements found</h4>
            <p className="text-slate-500 dark:text-slate-400 text-xs max-w-sm mx-auto">
              {hasActiveFilters 
                ? "No announcements matched your current filters."
                : "No announcements have been posted for your branch or hostel yet."}
            </p>
          </div>
        ) : (
          <div key={`${typeFilter}-${sortOrder}-${selectedTags.join(',')}`} className="space-y-3.5 animate-tab-enter">
            {visibleAnnouncements.map((ann: Announcement) => {
              const isCardCollapsed = viewDensity === 'collapsed' && !expandedCardIds.has(ann.id);
              const isLongContent = ann.content.length > 90 || ann.content.split('\n').length > 2;
              const isRepliesOpen = activeThread === ann.id;
              const annReplies = isRepliesOpen ? activeAnnouncementReplies : [];

              const handleSendReply = async (annId: string) => {
                if (!replyText.trim()) return;
                const textToSend = replyText.trim();
                setReplyText('');
                addReply(annId, textToSend);

                try {
                  const fresh = await airtableService.fetchRepliesForTarget(annId);
                  setActiveAnnouncementReplies(fresh.filter(r => !r.is_deleted));
                } catch (err) {
                  console.warn('[Announcements] Reply refresh error:', err);
                }
              };

              return (
                <div 
                  key={ann.id} 
                  className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xs border border-amber-100/90 dark:border-slate-800 p-4 sm:p-5 transition-all duration-150 hover:border-amber-300 dark:hover:border-amber-700/70 relative overflow-hidden"
                >
                  <div className={`absolute top-0 left-0 w-1 h-full ${ann.type === 'academic' ? 'bg-amber-500' : 'bg-indigo-500'}`} />
                  
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserNameWithTag 
                        userId={ann.author_id} 
                        name={ann.author_name} 
                        highlightQuery={searchQuery}
                        nameClassName="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm"
                      />
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                        {new Date(ann.date_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                        ann.type === 'academic' 
                          ? 'bg-amber-50/90 text-amber-800 border-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60' 
                          : 'bg-indigo-50/90 text-indigo-700 border-indigo-200/70 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60'
                      }`}>
                        <HighlightText text={ann.target} query={searchQuery} />
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex flex-wrap gap-1">
                        {ann.tags.map(t => <TagIcon key={t} tag={t} highlightQuery={searchQuery} />)}
                      </div>
                      
                      {ann.author_id === user?.id && (
                        <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-2 ml-1">
                          <button 
                            onClick={() => handleOpenModal('edit', ann)}
                            className="p-1 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 transition-all cursor-pointer"
                            title="Edit announcement"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => deleteAnnouncement(ann.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 transition-all cursor-pointer"
                            title="Delete announcement"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Smooth animated collapse/expand body */}
                  <div className="mb-2.5">
                    <motion.div
                      initial={false}
                      animate={{
                        height: isCardCollapsed && isLongContent ? 44 : 'auto'
                      }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="relative overflow-hidden"
                    >
                      <SimpleMarkdown highlightQuery={searchQuery}>{ann.content}</SimpleMarkdown>
                      <div 
                        className={`absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-white dark:from-slate-900 to-transparent pointer-events-none transition-opacity duration-200 ${
                          isCardCollapsed && isLongContent ? 'opacity-100' : 'opacity-0'
                        }`} 
                      />
                    </motion.div>

                    {viewDensity === 'collapsed' && isLongContent && (
                      <button
                        type="button"
                        onClick={() => toggleCardExpand(ann.id)}
                        className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 hover:underline inline-flex items-center gap-1 mt-1.5 cursor-pointer select-none active:scale-95 transition-transform"
                      >
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${!isCardCollapsed ? 'rotate-180' : ''}`} />
                        <span>{isCardCollapsed ? 'Read more' : 'Show less'}</span>
                      </button>
                    )}
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-2.5 flex items-center justify-between text-xs text-slate-500">
                    <button 
                      onClick={() => setActiveThread(isRepliesOpen ? null : ann.id)}
                      className={`flex items-center gap-1.5 font-semibold px-2.5 py-1 -ml-2.5 rounded-lg cursor-pointer transition-all duration-150 active:scale-95 ${
                        isRepliesOpen
                          ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300'
                          : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50/60 dark:hover:bg-slate-800/70 hover:text-amber-900 dark:hover:text-amber-300'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5"/> 
                      <span>{isRepliesOpen ? 'Hide Replies' : 'Show Replies'}</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isRepliesOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {/* Smooth Accordion Discussion Thread / Replies Drawer */}
                  <AnimatePresence initial={false}>
                    {isRepliesOpen && (
                      <motion.div
                        key={`replies-${ann.id}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                          <div 
                            ref={repliesContainerRef}
                            className="space-y-2 mb-3 max-h-64 overflow-y-auto custom-scrollbar px-1"
                          >
                            {isRepliesLoading ? (
                              <DatabaseLoader 
                                type="announcement_replies" 
                                variant="compact" 
                                message="Fetching discussion replies from database..." 
                              />
                            ) : annReplies.length === 0 ? (
                              <p className="text-xs text-slate-400 italic text-center py-3 animate-fade-in">
                                No replies yet. Start the discussion below!
                              </p>
                            ) : (
                              annReplies.map(reply => (
                                <ChatBubble 
                                  key={reply.id} 
                                  msg={reply} 
                                  onDelete={deleteReply} 
                                  onEdit={editReply} 
                                />
                              ))
                            )}
                          </div>

                          {/* Clean Reply Input Box */}
                          <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus-within:border-amber-500/70 focus-within:ring-2 focus-within:ring-amber-500/15 transition-all duration-150 rounded-xl p-2 flex gap-2 items-center">
                            <input 
                              type="text"
                              value={replyText}
                              onChange={e => setReplyText(e.target.value)}
                              onKeyDown={e => {
                                if (handleMarkdownKeydown(e, replyText, setReplyText)) {
                                  return;
                                }
                                if (e.key === 'Enter') {
                                  handleSendReply(ann.id);
                                }
                              }}
                              placeholder="Write a reply..."
                              className="flex-1 bg-transparent px-2.5 py-1 text-xs sm:text-sm focus:outline-none text-slate-900 dark:text-white"
                            />
                            <Button 
                              variant="amber" 
                              onClick={() => handleSendReply(ann.id)} 
                              className="!rounded-lg !p-2 px-3 shadow-none group"
                            >
                              <Send className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New / Edit Announcement Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-backdrop-enter">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] animate-modal-enter">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-amber-50/40 dark:bg-slate-900/50">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {modalMode === 'create' ? <Plus className="w-5 h-5 text-amber-600"/> : <Edit2 className="w-5 h-5 text-amber-600"/>}
                {modalMode === 'create' ? 'New Announcement' : 'Edit Announcement'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all active:scale-90 bg-white dark:bg-slate-800 p-1.5 rounded-full border border-slate-200 dark:border-slate-700 cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Announcement Body
                  </label>
                  <div className="flex rounded-lg bg-slate-100 dark:bg-slate-900 p-0.5 border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setEditorTab('write')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all duration-150 active:scale-95 cursor-pointer ${
                        editorTab === 'write'
                          ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <Code2 className="w-3.5 h-3.5" /> Write
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorTab('preview')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all duration-150 active:scale-95 cursor-pointer ${
                        editorTab === 'preview'
                          ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" /> Preview
                    </button>
                  </div>
                </div>

                {editorTab === 'write' ? (
                  <div key="write" className="space-y-2 animate-tab-enter">
                    <MarkdownToolbar 
                      textareaRef={textareaRef} 
                      value={formData.content} 
                      onChange={val => setFormData({ ...formData, content: val })} 
                    />
                    <textarea
                      ref={textareaRef}
                      className="w-full h-52 px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white resize-none outline-none transition-shadow font-mono text-sm leading-relaxed"
                      placeholder="Write your announcement..."
                      value={formData.content}
                      onChange={e => setFormData({ ...formData, content: e.target.value })}
                      onKeyDown={e => handleMarkdownKeydown(e, formData.content, val => setFormData({ ...formData, content: val }))}
                    />
                  </div>
                ) : (
                  <div key="preview" className="w-full min-h-52 max-h-72 p-4 border rounded-xl overflow-y-auto bg-slate-50/70 dark:bg-slate-900/70 border-slate-200 dark:border-slate-700 custom-scrollbar animate-tab-enter">
                    {formData.content.trim() ? (
                      <SimpleMarkdown>{formData.content}</SimpleMarkdown>
                    ) : (
                      <p className="text-slate-400 text-xs italic text-center my-16">
                        No content written yet. Switch to "Write" tab to compose your announcement.
                      </p>
                    )}
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Priority & Category Tags</label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag]
                      }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 active:scale-95 cursor-pointer ${
                        formData.tags.includes(tag)
                          ? 'bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-900/60 dark:border-amber-700 dark:text-amber-200 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 bg-slate-50 dark:bg-slate-900/50">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="amber" onClick={handleSaveAnnouncement} className="px-6">
                {modalMode === 'create' ? 'Post Announcement' : 'Update Announcement'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

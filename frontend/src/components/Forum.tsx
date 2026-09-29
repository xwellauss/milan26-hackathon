import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  MessageSquare, Hash, Plus, X, Link as LinkIcon, ChevronLeft, Send, 
  User as UserIcon, Bell, Calendar as CalendarIcon, Eye, Code2, Globe, Lock, Home, Trash2
} from 'lucide-react';
import { useAuth, useData } from '../context/AppContext';
import { Thread, Reply, ThreadTag, Announcement, ScheduleMaster, Branch } from '../types';
import { Button, TagIcon, UserNameWithTag } from './UI';
import { SimpleMarkdown } from './Markdown';
import { MarkdownToolbar, handleMarkdownKeydown } from './MarkdownToolbar';
import { airtableService } from '../services/airtableService';
import { DatabaseLoader } from './DatabaseLoader';

export const Forum = () => {
  const { user } = useAuth();
  const { 
    threads, setThreads, addThread, deleteThread, replies, addReply, deleteReply, 
    announcements, schedules, isAirtableLoading, loadingTabPath 
  } = useData();
  
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isRepliesLoading, setIsRepliesLoading] = useState(false);
  const [messageText, setMessageText] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [titleError, setTitleError] = useState('');
  const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write');
  const threadTextareaRef = useRef<HTMLTextAreaElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const [newThread, setNewThread] = useState<{
    title: string;
    initialPost: string;
    tags: ThreadTag[];
    linked_resource: Thread['linked_resource'];
    visibility_branch: Branch | 'public';
    visibility_hostel: string | 'public';
  }>({ 
    title: '', 
    initialPost: '', 
    tags: [], 
    linked_resource: null,
    visibility_branch: 'public',
    visibility_hostel: 'public'
  });

  const availableTags: ThreadTag[] = ['Academic', 'Announcement Discussion', 'TimePass'];

  // ESC to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  // Filter threads based on creator restrictions for Branch and Hostel
  const visibleThreads = useMemo(() => {
    return threads.filter((t: Thread) => {
      if (!user) return true;
      if (t.author_id === user.id) return true;

      const branchOk = 
        !t.visibility_branch || 
        t.visibility_branch === 'public' || 
        t.visibility_branch === user.branch;

      const hostelOk = 
        !t.visibility_hostel || 
        t.visibility_hostel === 'public' || 
        t.visibility_hostel === user.hostel;

      return branchOk && hostelOk;
    });
  }, [threads, user]);

  // Set initial active thread if none selected or if current active becomes invisible
  useEffect(() => {
    if (!activeThreadId && visibleThreads.length > 0) {
      setActiveThreadId(visibleThreads[0].id);
    } else if (activeThreadId && !visibleThreads.some(t => t.id === activeThreadId)) {
      setActiveThreadId(visibleThreads[0]?.id || null);
    }
  }, [visibleThreads, activeThreadId]);

  const [activeThreadReplies, setActiveThreadReplies] = useState<Reply[]>([]);

  // 1-second auto-refresh for thread replies while active & memory cleanup when switching threads
  useEffect(() => {
    if (!activeThreadId) {
      setActiveThreadReplies([]);
      setIsRepliesLoading(false);
      return;
    }

    let isMounted = true;
    setIsRepliesLoading(true);

    const refreshThreadReplies = async () => {
      try {
        const fetched = await airtableService.fetchRepliesForTarget(activeThreadId);
        if (isMounted) {
          setActiveThreadReplies(fetched.filter(r => !r.is_deleted));
        }
      } catch (err) {
        console.warn('[Forum] Polling thread replies error:', err);
      } finally {
        if (isMounted) {
          setIsRepliesLoading(false);
        }
      }
    };

    refreshThreadReplies();
    const intervalId = setInterval(async () => {
      try {
        const fetched = await airtableService.fetchRepliesForTarget(activeThreadId);
        if (isMounted) {
          setActiveThreadReplies(fetched.filter(r => !r.is_deleted));
        }
      } catch (err) {
        console.warn('[Forum] Background thread replies refresh error:', err);
      }
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      setActiveThreadReplies([]);
      setIsRepliesLoading(false);
    };
  }, [activeThreadId]);

  const activeThread = visibleThreads.find((t: Thread) => t.id === activeThreadId);
  const threadMessages = activeThreadReplies;

  const handleSendMessage = async () => {
    if (!messageText.trim() || !activeThreadId) return;
    const textToSend = messageText.trim();
    setMessageText('');
    if (messageInputRef.current) {
      messageInputRef.current.style.height = 'auto';
    }
    addReply(activeThreadId, textToSend);

    // Refresh immediately
    try {
      const fresh = await airtableService.fetchRepliesForTarget(activeThreadId);
      setActiveThreadReplies(fresh.filter(r => !r.is_deleted));
    } catch (err) {
      console.warn('[Forum] Reply refresh error:', err);
    }

    requestAnimationFrame(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    });
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setEditorTab('write');
    setTitleError('');
  };

  const handleCreateThread = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newThread.title.trim()) {
      setTitleError('Please enter a thread topic / title');
      return;
    }
    if (!user) {
      setTitleError('You must be logged in to create a thread');
      return;
    }

    const threadId = `t_${Date.now()}`;
    const thread: Thread = {
      id: threadId,
      author_id: user.id,
      author_name: user.name,
      title: newThread.title.trim(),
      created_at: Date.now(),
      tags: newThread.tags,
      linked_resource: newThread.linked_resource,
      visibility_branch: newThread.visibility_branch,
      visibility_hostel: newThread.visibility_hostel
    };

    addThread(thread);

    if (newThread.initialPost.trim()) {
      addReply(threadId, newThread.initialPost.trim());
    }

    setIsModalOpen(false);
    setTitleError('');
    setNewThread({ 
      title: '', 
      initialPost: '', 
      tags: [], 
      linked_resource: null,
      visibility_branch: 'public',
      visibility_hostel: 'public'
    });
    setActiveThreadId(thread.id);
  };

  const renderLinkedResource = (linked: Thread['linked_resource']) => {
    if (!linked) return null;
    if (linked.type === 'announcement') {
      const ann = announcements.find((a: Announcement) => a.id === linked.id);
      if (!ann) return null;
      return (
        <div className="bg-white dark:bg-slate-800 border border-amber-200/80 dark:border-amber-900/50 rounded-xl p-3.5 mb-4 shadow-2xs relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 uppercase mb-1">
            <Bell className="w-3.5 h-3.5"/> Linked Announcement
          </div>
          <h4 className="font-bold text-slate-900 dark:text-white line-clamp-1 text-sm">{ann.content.split('\n')[0].replace(/[#*]/g, '')}</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{ann.content}</p>
        </div>
      );
    }
    if (linked.type === 'schedule') {
      const sch = schedules.find((s: ScheduleMaster) => s.id === linked.id);
      if (!sch) return null;
      return (
        <div className="bg-white dark:bg-slate-800 border border-indigo-200/80 dark:border-indigo-900/50 rounded-xl p-3.5 mb-4 shadow-2xs relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-1">
            <CalendarIcon className="w-3.5 h-3.5"/> Linked Schedule
          </div>
          <h4 className="font-bold text-slate-900 dark:text-white text-sm">{sch.title}</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Valid: {sch.valid_from} to {sch.valid_until}</p>
        </div>
      );
    }
    return null;
  };

  const renderVisibilityBadges = (thread: Thread) => {
    const isPublicBranch = !thread.visibility_branch || thread.visibility_branch === 'public';
    const isPublicHostel = !thread.visibility_hostel || thread.visibility_hostel === 'public';

    if (isPublicBranch && isPublicHostel) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800">
          <Globe className="w-2.5 h-2.5" /> Public
        </span>
      );
    }

    return (
      <div className="flex flex-wrap gap-1">
        {!isPublicBranch && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200/70 dark:border-purple-800">
            <Lock className="w-2.5 h-2.5" /> {thread.visibility_branch} Only
          </span>
        )}
        {!isPublicHostel && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800">
            <Home className="w-2.5 h-2.5" /> {thread.visibility_hostel} Only
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xs border border-emerald-200/60 dark:border-slate-800 h-[calc(100vh-7rem)] flex overflow-hidden animate-fade-in">
      {/* Threads Sidebar (WhatsApp Green Base Tint) */}
      <div className={`w-full md:w-1/3 xl:w-1/4 border-r border-emerald-100/80 dark:border-slate-800 flex flex-col ${activeThreadId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-emerald-100/80 dark:border-slate-800 bg-emerald-50/35 dark:bg-emerald-950/15 flex justify-between items-center h-15 shrink-0">
          <div>
            <h2 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Hash className="w-4 h-4 text-emerald-600 dark:text-emerald-400"/> Threads
            </h2>
          </div>
          <button 
            onClick={handleOpenModal} 
            className="p-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-all cursor-pointer active:scale-95"
            title="Start new thread"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 custom-scrollbar bg-white dark:bg-slate-900">
          {(loadingTabPath === '/forum' || (isAirtableLoading && threads.length === 0)) ? (
            <DatabaseLoader type="forum_threads" variant="sidebar" />
          ) : visibleThreads.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">
              <MessageSquare className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-50" />
              <p>No threads visible for your branch or hostel yet.</p>
            </div>
          ) : visibleThreads.map((thread: Thread) => (
            <div 
              key={thread.id} 
              onClick={() => setActiveThreadId(thread.id)}
              className={`p-3.5 border-b border-slate-100 dark:border-slate-800/80 cursor-pointer transition-all duration-150 active:scale-[0.99] hover:bg-emerald-50/40 dark:hover:bg-emerald-950/25 group ${
                activeThreadId === thread.id 
                  ? 'bg-emerald-50/75 dark:bg-emerald-950/40 border-l-4 border-l-emerald-600 text-emerald-950 dark:text-emerald-200' 
                  : 'border-l-4 border-l-transparent'
              }`}
            >
              <h3 className={`font-bold text-sm line-clamp-2 mb-1.5 transition-colors ${
                activeThreadId === thread.id 
                  ? 'text-emerald-800 dark:text-emerald-300' 
                  : 'text-slate-800 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400'
              }`}>
                {thread.title}
              </h3>

              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {thread.tags.map(t => <TagIcon key={t} tag={t} />)}
                {renderVisibilityBadges(thread)}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1 min-w-0 truncate">
                  <UserIcon className="w-3 h-3 shrink-0"/>
                  <UserNameWithTag userId={thread.author_id} name={thread.author_name} />
                </span>
                <span className="shrink-0 text-[11px]">{new Date(thread.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Messages Pane */}
      <div className={`w-full md:w-2/3 xl:w-3/4 flex flex-col bg-[#f0f5f1] dark:bg-slate-950/80 relative ${!activeThreadId ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
        {!activeThread ? (
          <div className="text-center p-8 text-slate-400 animate-tab-enter">
            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50 text-emerald-500"/>
            <p className="text-sm">Select a thread from the sidebar or start a new one.</p>
          </div>
        ) : (
          <div key={activeThread.id} className="flex flex-col flex-1 min-h-0 animate-tab-enter">
            {/* Thread Header */}
            <div className="px-4 py-3 border-b border-emerald-100/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center h-15 shrink-0 shadow-2xs">
              <div className="flex items-center gap-3 overflow-hidden">
                <button 
                  onClick={() => setActiveThreadId(null)}
                  className="md:hidden p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white active:scale-90 transition-all rounded-lg cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5"/>
                </button>
                <div className="overflow-hidden">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base truncate">
                      {activeThread.title}
                    </h3>
                    {renderVisibilityBadges(activeThread)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    <span className="inline-flex items-center gap-1">
                      Started by <UserNameWithTag userId={activeThread.author_id} name={activeThread.author_name} className="font-semibold text-slate-700 dark:text-slate-300" />
                    </span>
                    <span>•</span>
                    <span>{new Date(activeThread.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {isRepliesLoading && (
                <div className="hidden sm:flex">
                  <DatabaseLoader type="forum_replies" variant="inline" resourceName="Replies" />
                </div>
              )}
            </div>

            {/* Messages Feed or Conversation History Database Loading Graphic */}
            {isRepliesLoading ? (
              <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
                <DatabaseLoader 
                  type="forum_replies" 
                  resourceName={`"${activeThread.title}"`}
                  message="Fetching discussion messages and conversation history from database..." 
                  variant="panel"
                />
              </div>
            ) : (
              <div 
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar space-y-3.5"
              >
                {renderLinkedResource(activeThread.linked_resource)}

                {threadMessages.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 animate-fade-in">
                    <p className="text-sm">No messages in this thread yet. Send a message below to start the conversation!</p>
                  </div>
                ) : (
                  threadMessages.map(msg => {
                    const isOwnMessage = Boolean(user && msg.author_id === user.id);

                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-2.5 group relative max-w-[85%] sm:max-w-[75%] ${
                          isOwnMessage ? 'ml-auto flex-row-reverse animate-msg-own' : 'mr-auto animate-msg-other'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-full font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs mt-0.5 ${
                            isOwnMessage
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {msg.author_name.charAt(0)}
                        </div>

                        <div className={`flex flex-col min-w-0 ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                          <div className={`flex items-center gap-2 mb-1 px-1 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                            <UserNameWithTag
                              userId={msg.author_id}
                              name={msg.author_name}
                              className="font-bold text-xs text-slate-800 dark:text-slate-200"
                            />
                            <span className="text-[10px] text-slate-400">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isOwnMessage && (
                              <button
                                type="button"
                                onClick={() => deleteReply(msg.id)}
                                className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-0.5 rounded hover:bg-slate-200/60 dark:hover:bg-slate-800 active:scale-90 transition-all opacity-80 sm:opacity-0 group-hover:opacity-100 cursor-pointer"
                                title="Delete message"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          <div
                            className={`px-3.5 py-2.5 rounded-2xl shadow-2xs text-sm leading-relaxed border transition-all duration-150 ${
                              isOwnMessage
                                ? 'bg-[#dcf8c6] dark:bg-emerald-900/60 border-emerald-200/90 dark:border-emerald-800/70 text-slate-800 dark:text-emerald-50 rounded-tr-xs'
                                : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 rounded-tl-xs'
                            }`}
                          >
                            <SimpleMarkdown>{msg.content}</SimpleMarkdown>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Reply Input Bar */}
            <div className="p-3.5 bg-white dark:bg-slate-900 border-t border-emerald-100/80 dark:border-slate-800 shrink-0">
              <div className="flex flex-wrap items-center gap-1 px-1 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                <button type="button" onClick={() => setMessageText(prev => prev + '**bold**')} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all text-slate-700 dark:text-slate-300 font-bold cursor-pointer" title="Bold">B</button>
                <button type="button" onClick={() => setMessageText(prev => prev + '*italic*')} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all text-slate-700 dark:text-slate-300 italic cursor-pointer" title="Italic">I</button>
                <button type="button" onClick={() => setMessageText(prev => prev + '<u>underline</u>')} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all text-slate-700 dark:text-slate-300 underline cursor-pointer" title="Underline">U</button>
                <button type="button" onClick={() => setMessageText(prev => prev + '~~strikethrough~~')} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all text-slate-700 dark:text-slate-300 line-through cursor-pointer" title="Strikethrough">S</button>
                <button type="button" onClick={() => setMessageText(prev => prev + '`code`')} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all text-emerald-700 dark:text-emerald-400 font-mono text-[11px] cursor-pointer" title="Inline Code">&lt;/&gt;</button>
                <button type="button" onClick={() => setMessageText(prev => prev + '\n> quote\n')} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all text-slate-700 dark:text-slate-300 cursor-pointer" title="Quote">”</button>
                <button type="button" onClick={() => setMessageText(prev => prev + '[Text](https://...)')} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all text-slate-700 dark:text-slate-300 cursor-pointer" title="Link">🔗</button>
              </div>

              <div className="flex items-end gap-2">
                <textarea
                  ref={messageInputRef}
                  rows={1}
                  placeholder="Write a message..."
                  value={messageText}
                  onChange={e => {
                    setMessageText(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                  }}
                  onKeyDown={e => {
                    if (handleMarkdownKeydown(e, messageText, setMessageText)) {
                      return;
                    }
                    if (e.key === 'Enter') {
                      if (e.shiftKey) {
                        return;
                      }
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all duration-150 text-slate-900 dark:text-white resize-none min-h-[42px] max-h-40 leading-relaxed font-sans"
                />
                <button 
                  onClick={handleSendMessage} 
                  disabled={!messageText.trim()} 
                  className="rounded-xl px-4 h-[42px] shrink-0 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white flex items-center justify-center transition-all duration-150 cursor-pointer active:scale-95 group"
                  title="Send message"
                >
                  <Send className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create New Thread Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-backdrop-enter">
          <form 
            onSubmit={handleCreateThread}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] animate-modal-enter"
          >
            <div className="p-4.5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-emerald-50/40 dark:bg-slate-900/50 shrink-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Hash className="w-4 h-4 text-emerald-600 dark:text-emerald-400"/> Start New Thread
              </h3>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)} 
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1.5 rounded-full cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Thread Topic / Title <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text"
                  placeholder="e.g. Operating Systems Assignment 4 questions"
                  value={newThread.title}
                  onChange={(e) => {
                    setNewThread({ ...newThread, title: e.target.value });
                    if (titleError) setTitleError('');
                  }}
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none dark:bg-slate-800 dark:text-white text-sm font-medium transition-shadow"
                  autoFocus
                />
                {titleError && (
                  <p className="text-rose-500 text-xs font-semibold mt-1">
                    {titleError}
                  </p>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                  <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Visibility & Access Controls</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Branch Visibility
                    </label>
                    <select
                      value={newThread.visibility_branch}
                      onChange={(e) => setNewThread({ ...newThread, visibility_branch: e.target.value as any })}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
                    >
                      <option value="public">🌐 Public (All Branches)</option>
                      <option value="CS">🔒 CS Branch Only</option>
                      <option value="EE">🔒 EE Branch Only</option>
                      <option value="MnC">🔒 MnC Branch Only</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Hostel Visibility
                    </label>
                    <select
                      value={newThread.visibility_hostel}
                      onChange={(e) => setNewThread({ ...newThread, visibility_hostel: e.target.value })}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
                    >
                      <option value="public">🌐 Public (All Hostels)</option>
                      <option value="Vivekananda">🏠 Vivekananda Hostel Only</option>
                      <option value="S.N. Bose">🏠 S.N. Bose Hostel Only</option>
                      <option value="Aryabhatta">🏠 Aryabhatta Hostel Only</option>
                      <option value="Charaka">🏠 Charaka Hostel Only</option>
                      <option value="Ramanujan">🏠 Ramanujan Hostel Only</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Initial Post with Toolbar and Preview */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Opening Message (Optional)
                  </label>
                  <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setEditorTab('write')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                        editorTab === 'write'
                          ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <Code2 className="w-3.5 h-3.5" /> Write
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorTab('preview')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                        editorTab === 'preview'
                          ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-2xs'
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
                      textareaRef={threadTextareaRef} 
                      value={newThread.initialPost} 
                      onChange={val => setNewThread({ ...newThread, initialPost: val })} 
                    />
                    <textarea
                      ref={threadTextareaRef}
                      className="w-full h-32 px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/30 dark:bg-slate-800 dark:text-white resize-none outline-none transition-shadow font-mono text-xs leading-relaxed"
                      placeholder="Write the opening post for this thread..."
                      value={newThread.initialPost}
                      onChange={e => setNewThread({ ...newThread, initialPost: e.target.value })}
                      onKeyDown={e => handleMarkdownKeydown(e, newThread.initialPost, val => setNewThread({ ...newThread, initialPost: val }))}
                    />
                  </div>
                ) : (
                  <div key="preview" className="w-full min-h-32 max-h-56 p-4 border rounded-xl overflow-y-auto bg-slate-50/70 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 custom-scrollbar animate-tab-enter">
                    {newThread.initialPost.trim() ? (
                      <SimpleMarkdown>{newThread.initialPost}</SimpleMarkdown>
                    ) : (
                      <p className="text-slate-400 text-xs italic text-center my-8">
                        No opening message typed yet.
                      </p>
                    )}
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Category Tags</label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setNewThread(prev => ({
                        ...prev,
                        tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag]
                      }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        newThread.tags.includes(tag)
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-900/60 dark:border-emerald-700 dark:text-emerald-300'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5" /> Link to Resource (Optional)
                </label>
                <select
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) setNewThread({ ...newThread, linked_resource: null });
                    else {
                      const [type, id] = val.split(':');
                      setNewThread({ ...newThread, linked_resource: { type: type as any, id } });
                    }
                  }}
                >
                  <option value="">-- No linked resource --</option>
                  <optgroup label="Announcements">
                    {announcements.map((a: Announcement) => (
                      <option key={a.id} value={`announcement:${a.id}`}>{a.content.substring(0, 40)}...</option>
                    ))}
                  </optgroup>
                  <optgroup label="Schedules">
                    {schedules.map((s: ScheduleMaster) => (
                      <option key={s.id} value={`schedule:${s.id}`}>{s.title}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-900/50 shrink-0">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-all cursor-pointer"
              >
                Create Thread
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

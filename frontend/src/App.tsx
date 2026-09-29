import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, Bell, Calendar as CalendarIcon, MessageSquare, Sun, Moon, 
  LogOut, ChevronDown, Keyboard, X, Menu,
  PanelLeftClose, PanelLeftOpen, FolderKanban, GraduationCap,
  Eye, EyeOff, LogIn, UserPlus, UserCog
} from 'lucide-react';
import { AppProvider, useAuth, useTheme, useRouter, useData } from './context/AppContext';
import { Dashboard } from './components/Dashboard';
import { Announcements } from './components/Announcements';
import { Schedules } from './components/Schedules';
import { Forum } from './components/Forum';
import { Resources } from './components/Resources';
import { Curriculum } from './components/Curriculum';
import { EditProfile } from './components/EditProfile';
import { NavbarRefreshButton } from './components/NavbarRefreshButton';
import { Button, Input, UserNameWithTag } from './components/UI';
import { inferUserDetailsFromEmail, HOSTEL_TABLE } from './utils/institute';
import { HostelName } from './types';

// Left-side Navigation Sidebar Component (Collapsible Minimalist Design)
const Sidebar = ({ 
  onOpenShortcuts,
  mobileOpen,
  onCloseMobile,
  isCollapsed,
  onToggleCollapse
}: { 
  onOpenShortcuts: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}) => {
  const { isDark, toggle } = useTheme();
  const { user, logout } = useAuth();
  const { path, navigate } = useRouter();
  const [showProfileSwitcher, setShowProfileSwitcher] = useState(false);

  // Close profile menu on ESC or when clicking outside (losing focus)
  useEffect(() => {
    if (!showProfileSwitcher) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowProfileSwitcher(false);
      }
    };

    const handlePointerDownOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !target.closest('[data-profile-menu]')) {
        setShowProfileSwitcher(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handlePointerDownOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handlePointerDownOutside);
    };
  }, [showProfileSwitcher]);

  const navItems = [
    { 
      name: 'Dashboard', 
      path: '/dashboard', 
      icon: LayoutDashboard,
      activeClass: 'bg-indigo-50/90 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-semibold',
      iconActiveClass: 'text-indigo-600 dark:text-indigo-400'
    },
    { 
      name: 'Schedules', 
      path: '/schedules', 
      icon: CalendarIcon,
      activeClass: 'bg-purple-50/90 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 font-semibold',
      iconActiveClass: 'text-purple-600 dark:text-purple-400'
    },
    { 
      name: 'Announcements', 
      path: '/announcements', 
      icon: Bell,
      activeClass: 'bg-amber-50/90 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 font-semibold',
      iconActiveClass: 'text-amber-600 dark:text-amber-400'
    },
    { 
      name: 'Forum', 
      path: '/forum', 
      icon: MessageSquare,
      activeClass: 'bg-emerald-50/90 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 font-semibold',
      iconActiveClass: 'text-emerald-600 dark:text-emerald-400'
    },
    { 
      name: 'Resources', 
      path: '/resources', 
      icon: FolderKanban,
      activeClass: 'bg-yellow-50/90 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-300 font-semibold',
      iconActiveClass: 'text-yellow-600 dark:text-yellow-400'
    },
    { 
      name: 'Curriculum', 
      path: '/curriculum', 
      icon: GraduationCap,
      activeClass: 'bg-rose-50/90 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 font-semibold',
      iconActiveClass: 'text-rose-600 dark:text-rose-400'
    },
  ];

  const handleNavClick = (targetPath: string) => {
    navigate(targetPath);
    onCloseMobile();
  };

  // Render helper so mobile always forces effectiveCollapsed = false (expanded mode)
  const renderSidebarContent = (effectiveCollapsed: boolean) => (
    <div className={`flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 select-none transition-all duration-200 ${effectiveCollapsed ? 'w-16' : 'w-64 md:w-60'}`}>
      {/* 1. TOP: Minimalist IRIS Brand Header & Collapse Toggle */}
      <div className={`py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center shrink-0 ${effectiveCollapsed ? 'px-2 flex-col gap-2 justify-center' : 'px-4 justify-between'}`}>
        <div 
          onClick={() => handleNavClick('/dashboard')}
          className={`flex items-center cursor-pointer group ${effectiveCollapsed ? 'justify-center' : 'gap-3 min-w-0'}`}
          title="IRIS - IIT Hyderabad"
        >
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 p-1 flex items-center justify-center border border-slate-200/50 dark:border-slate-700/50 transition-colors group-hover:bg-indigo-50 dark:group-hover:bg-slate-750 shrink-0">
            <img 
              src="/iris_logo.png" 
              alt="IRIS Logo" 
              className="w-6 h-6 object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          {!effectiveCollapsed && (
            <div className="min-w-0">
              <span className="text-base font-extrabold text-slate-800 dark:text-slate-100 tracking-tight leading-none block truncate">
                IRIS
              </span>
              <span className="text-[10px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase mt-0.5 block truncate">
                IIT Hyderabad
              </span>
            </div>
          )}
        </div>

        {/* Desktop Collapse / Expand Toggle Button */}
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 cursor-pointer transition-colors"
          title={effectiveCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {effectiveCollapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>

        {/* Mobile close drawer button */}
        <button
          onClick={onCloseMobile}
          className="md:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 2. MIDDLE: Navigation Tabs */}
      <div className={`flex-1 overflow-y-auto py-4 space-y-6 custom-scrollbar ${effectiveCollapsed ? 'px-2' : 'px-3'}`}>
        <div>
          {!effectiveCollapsed && (
            <p className="px-3 text-[10px] font-semibold tracking-wider uppercase text-slate-400 dark:text-slate-500 mb-2">
              Navigation
            </p>
          )}
          <div className="space-y-1">
            {navItems.map(item => {
              const isActive = path === item.path;
              return (
                <button
                  key={item.name}
                  onClick={() => handleNavClick(item.path)}
                  title={item.name}
                  className={`group w-full flex items-center rounded-lg text-xs font-medium transition-all duration-150 active:scale-[0.97] cursor-pointer ${
                    effectiveCollapsed 
                      ? 'justify-center p-2.5' 
                      : 'justify-start px-3 py-2'
                  } ${
                    isActive
                      ? item.activeClass
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/60 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <div className={`flex items-center ${effectiveCollapsed ? 'justify-center' : 'gap-2.5'}`}>
                    <item.icon className={`w-4 h-4 shrink-0 transition-transform duration-150 ${isActive ? `${item.iconActiveClass} scale-105` : 'text-slate-400 dark:text-slate-500 group-hover:scale-105'}`} />
                    {!effectiveCollapsed && <span>{item.name}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Tools Section */}
        <div>
          {!effectiveCollapsed && (
            <p className="px-3 text-[10px] font-semibold tracking-wider uppercase text-slate-400 dark:text-slate-500 mb-2">
              Preferences
            </p>
          )}
          <div className="space-y-1">
            {/* Theme Toggle Button */}
            <button
              onClick={toggle}
              title={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
              className={`group w-full flex items-center rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100/60 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200 transition-all duration-150 active:scale-[0.97] cursor-pointer ${
                effectiveCollapsed 
                  ? 'justify-center p-2.5' 
                  : 'justify-start px-3 py-2'
              }`}
            >
              <div className={`flex items-center ${effectiveCollapsed ? 'justify-center' : 'gap-2.5'}`}>
                <span key={isDark ? 'sun' : 'moon'} className="inline-flex animate-icon-pop">
                  {isDark ? (
                    <Sun className="w-4 h-4 text-amber-400/90 shrink-0" />
                  ) : (
                    <Moon className="w-4 h-4 text-indigo-500/90 shrink-0" />
                  )}
                </span>
                {!effectiveCollapsed && <span>{isDark ? 'Light Theme' : 'Dark Theme'}</span>}
              </div>
            </button>

            {/* Keyboard Shortcuts Dialog Button (kept on navbar per requirements, without inline shortcut hint) */}
            <button
              onClick={() => {
                onOpenShortcuts();
                onCloseMobile();
              }}
              title="Keyboard Shortcuts"
              className={`group w-full flex items-center rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100/60 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200 transition-all duration-150 active:scale-[0.97] cursor-pointer ${
                effectiveCollapsed 
                  ? 'justify-center p-2.5' 
                  : 'justify-start px-3 py-2'
              }`}
            >
              <div className={`flex items-center ${effectiveCollapsed ? 'justify-center' : 'gap-2.5'}`}>
                <Keyboard className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 transition-transform duration-150 group-hover:scale-105" />
                {!effectiveCollapsed && <span>Shortcuts</span>}
              </div>
            </button>

            {/* Database Refresh Button */}
            <div className={`pt-1.5 ${effectiveCollapsed ? 'flex justify-center' : 'px-1'}`}>
              <NavbarRefreshButton compact={effectiveCollapsed} />
            </div>
          </div>
        </div>
      </div>

      {/* 3. BOTTOM: Account Options & Minimalist User Bar */}
      {user && (
        <div
          data-profile-menu
          className={`border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 relative ${effectiveCollapsed ? 'p-2 flex justify-center' : 'p-3'}`}
        >
          {/* Profile Menu Popover */}
          {showProfileSwitcher && (
            <div className={`absolute bottom-full mb-2 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200/80 dark:border-slate-700/80 py-2 z-50 animate-popover-up ${
              effectiveCollapsed ? 'left-2 w-60' : 'left-3 right-3'
            }`}>
              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700/60 space-y-0.5 bg-slate-50/60 dark:bg-slate-900/40">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Signed In Account
                </p>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {user.email}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="font-mono">{user.rollNo}</span>
                  <span>•</span>
                  <span>{user.branch !== '-' ? `${user.branch} (${user.admissionYear})` : user.hostel}</span>
                  <span>•</span>
                  <span>{user.hostel}</span>
                  <span>•</span>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">{user.role}</span>
                </div>
              </div>

              <div className="py-1 space-y-0.5">
                <button
                  onClick={() => {
                    handleNavClick('/profile');
                    setShowProfileSwitcher(false);
                  }}
                  className={`w-full px-3 py-1.5 text-left text-xs font-medium flex items-center gap-2 cursor-pointer transition-colors ${
                    path === '/profile'
                      ? 'text-indigo-600 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/40'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <UserCog className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" /> Edit Profile
                </button>

                <button
                  onClick={() => {
                    logout();
                    setShowProfileSwitcher(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
              </div>
            </div>
          )}

          {/* Account Profile Trigger */}
          <div
            onClick={() => setShowProfileSwitcher(!showProfileSwitcher)}
            className={`flex items-center rounded-lg hover:bg-slate-100/70 dark:hover:bg-slate-800/60 cursor-pointer transition-all duration-150 active:scale-[0.98] border border-transparent hover:border-slate-200/50 dark:hover:border-slate-700/50 group ${
              effectiveCollapsed ? 'p-1.5 justify-center' : 'gap-2.5 p-2 w-full'
            }`}
            title={user.name}
          >
            <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-medium text-xs shrink-0 border border-indigo-200/50 dark:border-slate-700 overflow-hidden">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </div>

            {!effectiveCollapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1">
                    <UserNameWithTag user={user} />
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                    {user.branch !== '-' ? `${user.branch} • ${user.hostel}` : user.hostel}
                  </div>
                </div>

                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${showProfileSwitcher ? 'rotate-180' : ''}`} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Left Sidebar */}
      <aside className={`hidden md:flex md:flex-col md:fixed md:inset-y-0 z-40 transition-all duration-200 ${isCollapsed ? 'md:w-16' : 'md:w-60'}`}>
        {renderSidebarContent(isCollapsed)}
      </aside>

      {/* Mobile Slide-Over Drawer with Overlay — Forcefully Expanded Mode (false) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs animate-backdrop-enter" 
            onClick={onCloseMobile}
          />
          <div className="fixed inset-y-0 left-0 w-64 max-w-[85vw] bg-white dark:bg-slate-900 shadow-xl z-50 animate-drawer-left">
            {renderSidebarContent(false)}
          </div>
        </div>
      )}
    </>
  );
};

// Mobile Top Bar Header
const MobileHeader = ({ onOpenMobile }: { onOpenMobile: () => void }) => {
  const { path } = useRouter();

  const titleMap: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/schedules': 'Schedules',
    '/announcements': 'Announcements',
    '/forum': 'Threads',
    '/resources': 'Resources',
    '/curriculum': 'Curriculum',
    '/profile': 'Edit Profile',
  };

  return (
    <header className="md:hidden sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 h-13 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpenMobile}
          className="p-1.5 -ml-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
          title="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <img src="/iris_logo.png" alt="IRIS Logo" className="w-6 h-6 object-contain" />
          <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">IRIS</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <NavbarRefreshButton compact={true} />
        <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
          {titleMap[path] || 'Portal'}
        </div>
      </div>
    </header>
  );
};

const ShortcutsModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcutGroups = [
    {
      title: 'Global Navigation & Actions',
      shortcuts: [
        { keys: ['ESC'], desc: 'Close any active dialog / modal / reader' },
        { keys: ['1'], desc: 'Navigate to Dashboard tab' },
        { keys: ['2'], desc: 'Navigate to Schedules tab' },
        { keys: ['3'], desc: 'Navigate to Announcements tab' },
        { keys: ['4'], desc: 'Navigate to Forum tab' },
        { keys: ['5'], desc: 'Navigate to Resources tab' },
        { keys: ['6'], desc: 'Navigate to Curriculum tab' },
        { keys: ['Alt', 'D'], desc: 'Toggle Light / Dark mode' },
        { keys: ['?'], desc: 'Open this keyboard shortcuts guide' },
      ]
    },
    {
      title: 'Markdown Text Formatting',
      shortcuts: [
        { keys: ['Ctrl', 'B'], desc: 'Bold text (**text**)' },
        { keys: ['Ctrl', 'I'], desc: 'Italic text (*text*)' },
        { keys: ['Ctrl', 'U'], desc: 'Underline text (<u>text</u>)' },
        { keys: ['Ctrl', 'M'], desc: 'Inline math formula ($...$)' },
        { keys: ['Ctrl', 'Shift', 'S'], desc: 'Strikethrough text (~~text~~)' },
        { keys: ['Ctrl', 'K'], desc: 'Insert markdown link' },
        { keys: ['Ctrl', 'E'], desc: 'Inline code snippet (`code`)' },
        { keys: ['Ctrl', 'Shift', 'E'], desc: 'Multi-line code block' },
        { keys: ['Ctrl', 'Shift', 'Q'], desc: 'Blockquote (> quote)' },
        { keys: ['Tab'], desc: '2-space code indentation' },
      ]
    },
    {
      title: 'Resources & File Explorer',
      shortcuts: [
        { keys: ['Tab'], desc: 'Cycle through files and folders' },
        { keys: ['Enter'], desc: 'Open focused file or folder' },
        { keys: ['Backspace'], desc: 'Go back to parent directory' },
        { keys: ['ESC'], desc: 'Close Markdown reading panel' },
      ]
    },
    {
      title: 'Schedules View',
      shortcuts: [
        { keys: ['←'], desc: 'Previous week' },
        { keys: ['→'], desc: 'Next week' },
        { keys: ['T'], desc: 'Jump to current week (Today)' },
      ]
    },
    {
      title: 'Announcements Feed',
      shortcuts: [
        { keys: ['/'], desc: 'Quick focus search input' },
        { keys: ['Enter'], desc: 'Send reply message' },
      ]
    },
  ];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-backdrop-enter">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-700/80 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-modal-enter">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700/80 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-slate-700/50 rounded-xl text-indigo-600 dark:text-indigo-300">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                Keyboard Shortcuts
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Fluid keyboard navigation across IRIS
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 active:scale-90 transition-all rounded-full cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
          {shortcutGroups.map(group => (
            <div key={group.title}>
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-3">
                {group.title}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {group.shortcuts.map(sc => (
                  <div 
                    key={sc.desc}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800"
                  >
                    <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                      {sc.desc}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {sc.keys.map(k => (
                        <kbd 
                          key={k} 
                          className="px-2 py-0.5 text-[11px] font-mono font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-md"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-700/80 flex justify-end bg-slate-50/50 dark:bg-slate-900/50">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

const LoginScreen = () => {
  const { login, signup } = useAuth();
  const { hostels, isAirtableLoading } = useData();
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Sign Up state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupHostel, setSignupHostel] = useState<HostelName>('Vivekananda');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live email inference preview for Sign Up
  const emailInference = useMemo(() => {
    if (!signupEmail.trim()) return null;
    return inferUserDetailsFromEmail(signupEmail);
  }, [signupEmail]);

  const handleLogin = async () => {
    setError('');
    if (!loginEmail.trim()) {
      setError('Please enter your institute email ID.');
      return;
    }
    if (!loginPassword) {
      setError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await login(loginEmail, loginPassword);
      if (!result.success) {
        setError(result.error || 'Invalid login credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async () => {
    setError('');
    if (!firstName.trim()) {
      setError('Please enter your first name.');
      return;
    }
    if (!lastName.trim()) {
      setError('Please enter your last name.');
      return;
    }
    if (!signupEmail.trim()) {
      setError('Please enter your institute email ID.');
      return;
    }

    const inferred = inferUserDetailsFromEmail(signupEmail);
    if (!inferred.isValid) {
      setError(
        inferred.error ||
          'Email must follow format: (2-letter branch)(2-digit year)btech(5-digit number)@iith.ac.in'
      );
      return;
    }

    if (!signupPassword) {
      setError('Please enter a password.');
      return;
    }
    if (signupPassword !== confirmPassword) {
      setError('Passwords do not match. Please confirm your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signup({
        firstName,
        lastName,
        email: signupEmail,
        password: signupPassword,
        hostel: signupHostel
      });

      if (!result.success) {
        setError(result.error || 'Could not complete sign up.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchTab = (tab: 'login' | 'signup') => {
    setError('');
    setActiveTab(tab);
  };

  return (
    <div className="max-w-md mx-auto mt-14 mb-12 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 overflow-hidden animate-tab-enter">
      <div className="p-8 pb-6">
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-700/50 p-2 flex items-center justify-center border border-slate-200/60 dark:border-slate-600">
            <img 
              src="/iris_logo.png" 
              alt="IRIS Logo" 
              className="w-10 h-10 object-contain"
            />
          </div>
        </div>
        <h2 className="text-xl font-bold text-center mb-1 text-slate-900 dark:text-slate-100">
          {activeTab === 'login' ? 'IRIS Portal Login' : 'Create IRIS Account'}
        </h2>
        <p className="text-center text-slate-500 dark:text-slate-400 mb-6 text-xs">
          IITH Resources & Information System
        </p>

        {activeTab === 'login' ? (
          <div key="login-tab" className="space-y-4 animate-tab-enter">
            <Input 
              label="Institute Email ID" 
              type="email"
              placeholder="e.g. cs26btech11001@iith.ac.in"
              value={loginEmail}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setLoginEmail(e.target.value);
                if (error) setError('');
              }}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleLogin()}
            />

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={loginPassword}
                  onChange={(e) => {
                    setLoginPassword(e.target.value);
                    if (error) setError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  className="w-full px-3.5 py-2.5 pr-10 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/80 outline-none bg-white dark:bg-slate-800/90 dark:text-slate-100 transition-all text-sm font-normal placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
                  title={showLoginPassword ? 'Hide password' : 'Show password'}
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/70 dark:border-rose-900/60 text-rose-600 dark:text-rose-300 text-xs font-medium animate-scale-in">
                {error}
              </div>
            )}

            <Button className="w-full py-2.5 mt-2" onClick={handleLogin} disabled={isSubmitting}>
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                  <span>Logging In...</span>
                </div>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Log In</span>
                </>
              )}
            </Button>
          </div>
        ) : (
          <div key="signup-tab" className="space-y-3.5 animate-tab-enter">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="mb-0">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  First Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rohan"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    if (error) setError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSignUp()}
                  className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/80 outline-none bg-white dark:bg-slate-800/90 dark:text-slate-100 transition-all text-sm font-normal placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div className="mb-0">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Last Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Verma"
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    if (error) setError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSignUp()}
                  className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/80 outline-none bg-white dark:bg-slate-800/90 dark:text-slate-100 transition-all text-sm font-normal placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Institute Email ID
              </label>
              <input
                type="email"
                placeholder="e.g. cs26btech11001@iith.ac.in"
                value={signupEmail}
                onChange={(e) => {
                  setSignupEmail(e.target.value);
                  if (error) setError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSignUp()}
                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/80 outline-none bg-white dark:bg-slate-800/90 dark:text-slate-100 transition-all text-sm font-normal placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />

              {/* Live Inferred Student Metadata Preview */}
              {emailInference && emailInference.isValid && (
                <div className="mt-2.5 p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 text-xs space-y-1.5 animate-scale-in">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Inferred Academic Profile
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                    <div>
                      <span className="text-slate-400 dark:text-slate-500">Roll No: </span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {emailInference.rollNo}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 dark:text-slate-500">Branch: </span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {emailInference.branch}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 dark:text-slate-500">Admission Year: </span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {emailInference.admissionYear}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 dark:text-slate-500">Role: </span>
                      <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                        {emailInference.role}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Hostel Name
              </label>
              <select
                value={signupHostel}
                onChange={(e) => {
                  setSignupHostel(e.target.value as HostelName);
                  if (error) setError('');
                }}
                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/80 outline-none bg-white dark:bg-slate-800/90 dark:text-slate-100 transition-all text-sm font-normal cursor-pointer"
              >
                {(hostels.length > 0 ? hostels : HOSTEL_TABLE).map(h => (
                  <option key={h.id} value={h.name}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showSignupPassword ? 'text' : 'password'}
                  placeholder="Create a password"
                  value={signupPassword}
                  onChange={(e) => {
                    setSignupPassword(e.target.value);
                    if (error) setError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSignUp()}
                  className="w-full px-3.5 py-2.5 pr-10 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/80 outline-none bg-white dark:bg-slate-800/90 dark:text-slate-100 transition-all text-sm font-normal placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
                  title={showSignupPassword ? 'Hide password' : 'Show password'}
                >
                  {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Confirm Password
              </label>
              <input
                type={showSignupPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (error) setError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSignUp()}
                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/80 outline-none bg-white dark:bg-slate-800/90 dark:text-slate-100 transition-all text-sm font-normal placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/70 dark:border-rose-900/60 text-rose-600 dark:text-rose-300 text-xs font-medium animate-scale-in">
                {error}
              </div>
            )}

            <Button className="w-full py-2.5 mt-2" onClick={handleSignUp} disabled={isSubmitting}>
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                  <span>Creating Account...</span>
                </div>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Sign Up</span>
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Bottom of Card Tab Selector (Login / Sign Up) */}
      <div className="px-6 py-4 bg-slate-50/80 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-700/80">
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/70">
          <button
            type="button"
            onClick={() => switchTab('login')}
            className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-[0.98] cursor-pointer ${
              activeTab === 'login'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Log In</span>
          </button>
          <button
            type="button"
            onClick={() => switchTab('signup')}
            className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-[0.98] cursor-pointer ${
              activeTab === 'signup'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Sign Up</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const MainContent = () => {
  const { user } = useAuth();
  const { path } = useRouter();

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <main className="p-4 sm:p-6 lg:p-8 flex-1 max-w-7xl w-full">
      <div key={`${path}-${user.id}`} className="animate-tab-enter">
        {path === '/dashboard' && <Dashboard />}
        {path === '/schedules' && <Schedules />}
        {path === '/announcements' && <Announcements />}
        {path === '/forum' && <Forum />}
        {path === '/resources' && <Resources />}
        {path === '/curriculum' && <Curriculum />}
        {path === '/profile' && <EditProfile />}
      </div>
    </main>
  );
};

const AppShell = () => {
  const { isDark, toggle } = useTheme();
  const { user } = useAuth();
  const { path, navigate } = useRouter();
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Desktop sidebar collapsed by default; mobile is forcefully expanded
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);

  const handleToggleCollapse = () => {
    setIsCollapsed(prev => !prev);
  };

  // Global fluid keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        if (target && target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setIsShortcutsOpen(prev => !prev);
          return;
        }
      }

      if (e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        toggle();
        return;
      }

      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      if (e.key === '1') {
        navigate('/dashboard');
      } else if (e.key === '2') {
        navigate('/schedules');
      } else if (e.key === '3') {
        navigate('/announcements');
      } else if (e.key === '4') {
        navigate('/forum');
      } else if (e.key === '5') {
        navigate('/resources');
      } else if (e.key === '6') {
        navigate('/curriculum');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle, navigate]);

  // Subtle per-tab canvas base tints
  const getCanvasTint = () => {
    if (!user) {
      return isDark ? 'dark bg-[#0f172a] text-slate-100' : 'bg-[#f6f6fa] text-slate-800';
    }
    switch (path) {
      case '/dashboard':
      case '/schedules':
        return isDark ? 'dark bg-[#101424] text-slate-100' : 'bg-[#f6f5fb] text-slate-800';
      case '/announcements':
        return isDark ? 'dark bg-[#171510] text-slate-100' : 'bg-[#fbf9f2] text-slate-800';
      case '/forum':
        return isDark ? 'dark bg-[#0e1714] text-slate-100' : 'bg-[#f3f8f5] text-slate-800';
      case '/resources':
        return isDark ? 'dark bg-[#161510] text-slate-100' : 'bg-[#faf8f1] text-slate-800';
      case '/curriculum':
        return isDark ? 'dark bg-[#181114] text-slate-100' : 'bg-[#fbf5f6] text-slate-800';
      default:
        return isDark ? 'dark bg-[#0f172a] text-slate-100' : 'bg-slate-50/70 text-slate-800';
    }
  };

  return (
    <div className={`${getCanvasTint()} min-h-screen transition-colors duration-200 flex flex-col md:flex-row font-sans`}>
      {user ? (
        <>
          <Sidebar 
            onOpenShortcuts={() => setIsShortcutsOpen(true)}
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
            isCollapsed={isCollapsed}
            onToggleCollapse={handleToggleCollapse}
          />
          <div className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${isCollapsed ? 'md:pl-16' : 'md:pl-60'}`}>
            <MobileHeader onOpenMobile={() => setMobileOpen(true)} />
            <MainContent />
          </div>
        </>
      ) : (
        <div className="flex-1">
          <MainContent />
        </div>
      )}

      <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}

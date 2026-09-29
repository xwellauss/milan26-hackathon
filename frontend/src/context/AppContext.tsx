import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  User, Announcement, Reply, Thread, ScheduleMaster, 
  BaseEvent, ExceptionEvent, Tag, ExamItem, ResourceFolder, ResourceItem,
  Course, Enrollment, HostelInfo, HostelName, BranchInfo, HRBasicInfo, Branch, Role
} from '../types';
import { 
  HOSTEL_TABLE,
  BRANCH_TABLE,
  inferUserDetailsFromEmail
} from '../utils/institute';
import { registerUserRole, registerRepsForRoleLookup, registerUsersForRoleLookup } from '../components/UI';
import { airtableService, AirtableStatus } from '../services/airtableService';

interface AuthContextType {
  user: User | null;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  signup: (params: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    hostel: HostelName;
  }) => Promise<{ success: boolean; error?: string; user?: User }>;
  updateProfile: (params: {
    firstName: string;
    lastName: string;
    hostel: HostelName;
    avatarUrl?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (params: {
    previousPassword: string;
    newPassword: string;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

interface ThemeContextType {
  isDark: boolean;
  toggle: () => void;
}

interface RouterContextType {
  path: string;
  navigate: (p: string, subView?: 'list' | 'calendar' | 'today_summary' | 'exam_schedule') => void;
  scheduleSubView: 'list' | 'calendar' | 'today_summary' | 'exam_schedule';
  setScheduleSubView: React.Dispatch<React.SetStateAction<'list' | 'calendar' | 'today_summary' | 'exam_schedule'>>;
}

interface DataContextType {
  announcements: Announcement[];
  threads: Thread[];
  setThreads: React.Dispatch<React.SetStateAction<Thread[]>>;
  addThread: (thread: Thread) => void;
  deleteThread: (id: string) => void;
  replies: Reply[];
  addReply: (target_id: string, content: string) => void;
  deleteReply: (id: string) => void;
  editReply: (id: string, newContent: string) => void;
  addAnnouncement: (content: string, tags: Tag[]) => void;
  editAnnouncement: (id: string, content: string, tags: Tag[]) => void;
  deleteAnnouncement: (id: string) => void;
  schedules: ScheduleMaster[];
  setSchedules: React.Dispatch<React.SetStateAction<ScheduleMaster[]>>;
  baseEvents: BaseEvent[];
  setBaseEvents: React.Dispatch<React.SetStateAction<BaseEvent[]>>;
  exceptionEvents: ExceptionEvent[];
  setExceptionEvents: React.Dispatch<React.SetStateAction<ExceptionEvent[]>>;
  
  // Specific Schedule Helper Actions
  addBaseEvent: (event: Omit<BaseEvent, 'id'>) => void;
  updateBaseEvent: (id: string, event: Partial<BaseEvent>) => void;
  removeBaseEvent: (id: string) => void;
  addOrUpdateException: (exception: Omit<ExceptionEvent, 'id'> & { id?: string }) => void;
  removeException: (id: string) => void;
  removeAllExceptionsForBaseEvent: (baseEventId: string) => void;

  // Exam Schedule Actions
  exams: ExamItem[];
  setExams: React.Dispatch<React.SetStateAction<ExamItem[]>>;
  addExam: (exam: Omit<ExamItem, 'id'>) => void;
  editExam: (id: string, exam: Partial<ExamItem>) => void;
  deleteExam: (id: string) => void;

  // Resources (Folders & Files)
  folders: ResourceFolder[];
  setFolders: React.Dispatch<React.SetStateAction<ResourceFolder[]>>;
  resources: ResourceItem[];
  setResources: React.Dispatch<React.SetStateAction<ResourceItem[]>>;
  createFolder: (name: string, parent_id: string | null, branch: User['branch']) => void;
  deleteFolder: (folderId: string) => void;
  uploadResource: (resource: Omit<ResourceItem, 'id' | 'uploaded_at'>) => void;
  deleteResource: (resourceId: string) => void;

  // Curriculum & Active Courses
  courses: Course[];
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  enrollments: Enrollment[];
  setEnrollments: React.Dispatch<React.SetStateAction<Enrollment[]>>;
  hostels: HostelInfo[];
  branches: BranchInfo[];

  // Author & HR Lookup Resolvers
  resolveAuthorName: (authorId: string, fallback?: string) => string;
  resolveHRs: (hrIds?: string) => HRBasicInfo[];

  // Airtable Sync Status & Controls
  airtableStatus: AirtableStatus;
  refreshAirtable: () => Promise<void>;
  refreshCurrentData: () => Promise<boolean>;
  loadDataForTab: (tabPath: string) => Promise<boolean>;
  isAirtableLoading: boolean;
  loadingTabPath: string | null;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => ({ success: false }),
  signup: async () => ({ success: false }),
  updateProfile: async () => ({ success: false }),
  updatePassword: async () => ({ success: false }),
  logout: () => {}
});
export const ThemeContext = createContext<ThemeContextType>({ isDark: false, toggle: () => {} });
export const RouterContext = createContext<RouterContextType>({
  path: '/dashboard',
  navigate: () => {},
  scheduleSubView: 'list',
  setScheduleSubView: () => {}
});
export const DataContext = createContext<DataContextType>({} as DataContextType);

export const useAuth = () => useContext(AuthContext);
export const useTheme = () => useContext(ThemeContext);
export const useRouter = () => useContext(RouterContext);
export const useData = () => useContext(DataContext);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
      }
      return next;
    });
  }, []);

  // Secure single-session user state (re-hydrated without passwords)
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('iris_user_session');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  const [currentPath, setCurrentPath] = useState('/dashboard');
  const [scheduleSubView, setScheduleSubView] = useState<'list' | 'calendar' | 'today_summary' | 'exam_schedule'>('list');

  // Directory of public user profiles for resolving author_id -> author_name and HR details safely
  const [userDirectory, setUserDirectory] = useState<Array<{
    id: string;
    name: string;
    role: Role;
    branch: Branch;
    hostel: string;
    rollNo?: string;
    email?: string;
  }>>([]);

  const refreshUserDirectory = useCallback(async () => {
    try {
      const users = await airtableService.fetchUsersDirectory();
      if (users.length > 0) {
        setUserDirectory(users);
        registerUsersForRoleLookup(users);
      }
    } catch {}
  }, []);

  // Load public representative and user directory for instant role badging and author name resolution
  useEffect(() => {
    if (user) {
      registerUserRole(user);
    }
    refreshUserDirectory();
    airtableService.fetchReps().then(reps => {
      registerRepsForRoleLookup(reps);
    }).catch(() => {});
  }, [user, refreshUserDirectory]);

  const handleNavigate = useCallback((p: string, subView?: 'list' | 'calendar' | 'today_summary' | 'exam_schedule') => {
    setCurrentPath(p);
    if (subView) {
      setScheduleSubView(subView);
    } else if (p === '/schedules') {
      setScheduleSubView('list');
    }
  }, []);

  // Primary Data State (retrieved from Airtable database)
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [schedules, setSchedules] = useState<ScheduleMaster[]>([]);
  const [baseEvents, setBaseEvents] = useState<BaseEvent[]>([]);
  const [exceptionEvents, setExceptionEvents] = useState<ExceptionEvent[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [folders, setFolders] = useState<ResourceFolder[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [hostels, setHostels] = useState<HostelInfo[]>(HOSTEL_TABLE);
  const [branches, setBranches] = useState<BranchInfo[]>(BRANCH_TABLE);

  // Author & HR Lookup Resolvers
  const resolveAuthorName = useCallback((authorId: string, fallback?: string): string => {
    if (!authorId) return fallback || 'Student';
    if (user && (user.id === authorId || user.email.toLowerCase() === authorId.toLowerCase())) {
      return user.name;
    }
    const found = userDirectory.find(
      u => u.id === authorId || u.email?.toLowerCase() === authorId.toLowerCase()
    );
    if (found && found.name) {
      return found.name;
    }
    // Check in HOSTEL_TABLE seed HRs
    for (const h of HOSTEL_TABLE) {
      const hrMatch = h.hrs?.find(hr => hr.id === authorId || hr.email?.toLowerCase() === authorId.toLowerCase());
      if (hrMatch) return hrMatch.name;
    }
    return fallback || 'Student';
  }, [user, userDirectory]);

  const resolveHRs = useCallback((hrIds?: string): HRBasicInfo[] => {
    if (!hrIds) return [];
    const ids = hrIds.split(',').map(s => s.trim()).filter(Boolean);
    return ids.map(id => {
      if (user && (user.id === id || user.email.toLowerCase() === id.toLowerCase())) {
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          rollNo: user.rollNo,
          branch: user.branch,
          hostel: user.hostel
        };
      }
      const foundInDir = userDirectory.find(
        u => u.id === id || u.email?.toLowerCase() === id.toLowerCase()
      );
      if (foundInDir) {
        return {
          id: foundInDir.id,
          name: foundInDir.name,
          email: foundInDir.email,
          rollNo: foundInDir.rollNo,
          branch: foundInDir.branch,
          hostel: foundInDir.hostel
        };
      }
      // Check in HOSTEL_TABLE
      for (const h of HOSTEL_TABLE) {
        const hrMatch = h.hrs?.find(hr => hr.id === id || hr.email?.toLowerCase() === id.toLowerCase());
        if (hrMatch) return hrMatch;
      }
      return {
        id,
        name: `Hostel Representative (${id})`
      };
    });
  }, [user, userDirectory]);

  // Airtable Sync State
  const [airtableStatus, setAirtableStatus] = useState<AirtableStatus>({
    connected: false,
    baseId: 'appgHPiab7ZyPFj9d',
    status: 'loading',
    message: 'Initializing Airtable connection...'
  });
  const [isAirtableLoading, setIsAirtableLoading] = useState(false);
  const [loadingTabPath, setLoadingTabPath] = useState<string | null>(null);

  // Table requirements per tab
  const TAB_TABLE_MAP: Record<string, string[]> = {
    '/dashboard': [
      'INITIAL_SCHEDULES',
      'INITIAL_BASE_EVENTS',
      'INITIAL_EXCEPTIONS',
      'INITIAL_EXAMS',
      'INITIAL_ANNOUNCEMENTS',
      'INITIAL_COURSES',
      'INITIAL_ENROLLMENTS',
      'HOSTEL_INFO',
      'BRANCH_INFO'
    ],
    '/schedules': [
      'INITIAL_SCHEDULES',
      'INITIAL_BASE_EVENTS',
      'INITIAL_EXCEPTIONS',
      'INITIAL_EXAMS',
      'INITIAL_COURSES'
    ],
    '/announcements': [
      'INITIAL_ANNOUNCEMENTS'
    ],
    '/forum': [
      'INITIAL_THREADS'
    ],
    '/resources': [
      'INITIAL_FOLDERS',
      'INITIAL_RESOURCES'
    ],
    '/curriculum': [
      'INITIAL_COURSES',
      'INITIAL_ENROLLMENTS'
    ],
    '/profile': [
      'HOSTEL_INFO',
      'BRANCH_INFO'
    ]
  };

  // Evict data from temporary memory when navigating away from a tab
  const evictUnneededData = useCallback((activeTab: string) => {
    const needed = new Set(TAB_TABLE_MAP[activeTab] || TAB_TABLE_MAP['/dashboard']);

    if (!needed.has('INITIAL_FOLDERS')) {
      setFolders([]);
    }
    if (!needed.has('INITIAL_RESOURCES')) {
      setResources([]);
    }
    if (!needed.has('INITIAL_THREADS')) {
      setThreads([]);
      setReplies([]);
    }
    if (!needed.has('INITIAL_ANNOUNCEMENTS')) {
      setAnnouncements([]);
    }
    if (!needed.has('INITIAL_COURSES')) {
      setCourses([]);
    }
    if (!needed.has('INITIAL_ENROLLMENTS')) {
      setEnrollments([]);
    }
    if (!needed.has('INITIAL_SCHEDULES')) {
      setSchedules([]);
    }
    if (!needed.has('INITIAL_BASE_EVENTS')) {
      setBaseEvents([]);
    }
    if (!needed.has('INITIAL_EXCEPTIONS')) {
      setExceptionEvents([]);
    }
    if (!needed.has('INITIAL_EXAMS')) {
      setExams([]);
    }
  }, []);

  // Load only the data needed for the active tab from Airtable
  const loadDataForTab = useCallback(async (tabPath: string): Promise<boolean> => {
    setIsAirtableLoading(true);
    setLoadingTabPath(tabPath);
    setAirtableStatus(prev => ({ ...prev, status: 'syncing', message: `Loading ${tabPath}...` }));

    try {
      const tablesNeeded = TAB_TABLE_MAP[tabPath] || TAB_TABLE_MAP['/dashboard'];
      const tablesToFetch = tablesNeeded;

      if (tablesToFetch.length === 0) {
        setIsAirtableLoading(false);
        setLoadingTabPath(null);
        return true;
      }

      const res = await airtableService.fetchTables(tablesToFetch);
      if (res.success && res.data) {
        const d = res.data;

        // Build a temporary course lookup map for resolving exams & enrollments
        const loadedCourses = d.courses || [];
        const courseMap = new Map<string, Course>();
        loadedCourses.forEach(c => {
          if (c.code) courseMap.set(c.code.toUpperCase(), c);
        });

        if (tablesNeeded.includes('INITIAL_ANNOUNCEMENTS')) {
          const rawAnn = d.announcements || [];
          setAnnouncements(rawAnn.map(a => ({
            ...a,
            author_name: a.author_name || resolveAuthorName(a.author_id, 'Admin')
          })));
        }
        if (tablesNeeded.includes('INITIAL_THREADS')) {
          const rawThreads = d.threads || [];
          setThreads(rawThreads.map(t => ({
            ...t,
            author_name: t.author_name || resolveAuthorName(t.author_id, 'Student')
          })));
        }
        if (tablesNeeded.includes('INITIAL_SCHEDULES')) {
          setSchedules(d.schedules || []);
        }
        if (tablesNeeded.includes('INITIAL_BASE_EVENTS')) {
          setBaseEvents(d.baseEvents || []);
        }
        if (tablesNeeded.includes('INITIAL_EXCEPTIONS')) {
          setExceptionEvents(d.exceptionEvents || []);
        }
        if (tablesNeeded.includes('INITIAL_EXAMS')) {
          const rawExams = d.exams || [];
          setExams(rawExams.map(ex => {
            const matchedCourse = courseMap.get(ex.course_code.toUpperCase());
            return {
              ...ex,
              course_name: matchedCourse?.name || ex.course_name || ex.course_code,
              target_branch: matchedCourse?.branch || ex.target_branch || 'All'
            };
          }));
        }
        if (tablesNeeded.includes('INITIAL_FOLDERS')) {
          setFolders(d.folders || []);
        }
        if (tablesNeeded.includes('INITIAL_RESOURCES')) {
          // Store only metadata in state - file contents are loaded strictly on-demand
          setResources((d.resources || []).map(r => ({ ...r, content: undefined })));
        }
        if (tablesNeeded.includes('INITIAL_COURSES')) {
          setCourses(loadedCourses);
        }
        if (tablesNeeded.includes('INITIAL_ENROLLMENTS')) {
          const rawEns = d.enrollments || [];
          setEnrollments(rawEns.map(en => {
            const matchedCourse = courseMap.get(en.course_code.toUpperCase());
            return {
              ...en,
              semester: matchedCourse?.semester || en.semester || 'Autumn 2026'
            };
          }));
        }
        if (tablesNeeded.includes('HOSTEL_INFO')) {
          if (d.hostels && d.hostels.length > 0) {
            setHostels(d.hostels);
          }
        }
        if (tablesNeeded.includes('BRANCH_INFO')) {
          if (d.branches && d.branches.length > 0) {
            setBranches(d.branches);
          }
        }

        setAirtableStatus({
          connected: true,
          baseId: 'appgHPiab7ZyPFj9d',
          status: 'connected',
          message: `Loaded data for ${tabPath}`,
          lastSyncedAt: Date.now()
        });
        return true;
      }

      setAirtableStatus(prev => ({ ...prev, status: 'error', message: res.error || 'Failed to fetch table data' }));
      return false;
    } catch (err: any) {
      console.warn(`[Airtable] Load error for tab ${tabPath}:`, err);
      setAirtableStatus(prev => ({ ...prev, status: 'error', message: err.message || 'Network error' }));
      return false;
    } finally {
      setIsAirtableLoading(false);
      setLoadingTabPath(null);
    }
  }, [resolveAuthorName]);

  // Refresh data currently loaded and needed for the active tab (called by navbar refresh button)
  const refreshCurrentData = useCallback(async (): Promise<boolean> => {
    await refreshUserDirectory();
    return await loadDataForTab(currentPath);
  }, [currentPath, loadDataForTab, refreshUserDirectory]);

  const refreshAirtable = useCallback(async () => {
    await refreshCurrentData();
  }, [refreshCurrentData]);

  // On tab navigation: immediately discard unneeded data from memory, then load required data
  useEffect(() => {
    evictUnneededData(currentPath);
    loadDataForTab(currentPath);
  }, [currentPath, evictUnneededData, loadDataForTab]);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [isDark]);

  const login = async (email: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    const res = await airtableService.login(email, password);
    if (res.success && res.user) {
      setUser(res.user);
      try {
        localStorage.setItem('iris_user_session', JSON.stringify(res.user));
      } catch {}
      registerUserRole(res.user);
      refreshUserDirectory();
      return { success: true };
    }
    return { success: false, error: res.error || 'Invalid credentials' };
  };

  const signup = async ({
    firstName,
    lastName,
    email,
    password,
    hostel
  }: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    hostel: HostelName;
  }): Promise<{ success: boolean; error?: string; user?: User }> => {
    const res = await airtableService.signup({
      firstName,
      lastName,
      email,
      password,
      hostel
    });

    if (res.success && res.user) {
      setUser(res.user);
      try {
        localStorage.setItem('iris_user_session', JSON.stringify(res.user));
      } catch {}
      registerUserRole(res.user);
      refreshUserDirectory();
      return { success: true, user: res.user };
    }

    return { success: false, error: res.error || 'Failed to sign up' };
  };

  const updateProfile = async ({
    firstName,
    lastName,
    hostel,
    avatarUrl
  }: {
    firstName: string;
    lastName: string;
    hostel: HostelName;
    avatarUrl?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'You must be logged in to update your profile.' };
    }

    const res = await airtableService.updateProfile({
      userId: user.id,
      firstName,
      lastName,
      hostel,
      avatarUrl
    });

    if (res.success && res.user) {
      setUser(res.user);
      try {
        localStorage.setItem('iris_user_session', JSON.stringify(res.user));
      } catch {}
      registerUserRole(res.user);
      refreshUserDirectory();

      // Keep authored items' display name synced in active views
      const fullName = res.user.name;
      setAnnouncements(prev =>
        prev.map(a => (a.author_id === user.id ? { ...a, author_name: fullName } : a))
      );
      setThreads(prev =>
        prev.map(t => (t.author_id === user.id ? { ...t, author_name: fullName } : t))
      );
      setReplies(prev =>
        prev.map(r => (r.author_id === user.id ? { ...r, author_name: fullName } : r))
      );

      return { success: true };
    }

    return { success: false, error: res.error || 'Could not update profile settings.' };
  };

  const updatePassword = async ({
    previousPassword,
    newPassword
  }: {
    previousPassword: string;
    newPassword: string;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'You must be logged in to update your password.' };
    }
    return await airtableService.updatePassword({
      userId: user.id,
      previousPassword,
      newPassword
    });
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem('iris_user_session');
    } catch {}
  };

  // Reply handlers (author_name resolved via user.id + MOCK_USERS)
  const addReply = (target_id: string, content: string) => {
    if (!user) return;
    const newReply: Reply = {
      id: `r_${Date.now()}`,
      target_id,
      author_id: user.id,
      author_name: user.name,
      content,
      created_at: Date.now(),
      is_deleted: false
    };
    setReplies(prev => [...prev, newReply].sort((a, b) => a.created_at - b.created_at));

    // Persist to Airtable
    airtableService.createReply(newReply).catch(err => {
      console.warn('[Airtable] Failed to create reply in Airtable:', err);
    });
  };

  const deleteReply = (id: string) => {
    setReplies(prev => prev.map(r => r.id === id ? { ...r, is_deleted: true } : r));
    airtableService.deleteReply(id).catch(err => {
      console.warn('[Airtable] Failed to delete reply in Airtable:', err);
    });
  };

  const editReply = (id: string, newContent: string) => {
    setReplies(prev => prev.map(r => r.id === id ? { ...r, content: newContent } : r));
    airtableService.updateReply(id, newContent, false).catch(err => {
      console.warn('[Airtable] Failed to update reply in Airtable:', err);
    });
  };

  // Announcement handlers
  const addAnnouncement = (content: string, tags: Tag[]) => {
    if (!user) return;
    const newAnn: Announcement = {
      id: `a_${Date.now()}`,
      author_id: user.id,
      author_name: user.name,
      type: user.role === 'HR' ? 'hostel' : 'academic',
      target: user.role === 'HR' ? user.hostel : user.branch,
      content,
      date_time: Date.now(),
      tags
    };
    setAnnouncements(prev => [newAnn, ...prev]);

    // Persist to Airtable
    airtableService.createAnnouncement(newAnn).catch(err => {
      console.warn('[Airtable] Failed to create announcement in Airtable:', err);
    });
  };

  const editAnnouncement = (id: string, content: string, tags: Tag[]) => {
    setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, content, tags } : a));
    airtableService.updateAnnouncement(id, content, tags).catch(err => {
      console.warn('[Airtable] Failed to update announcement in Airtable:', err);
    });
  };

  const deleteAnnouncement = (id: string) => {
    setAnnouncements(prev => prev.filter(a => a.id !== id));
    airtableService.deleteAnnouncement(id).catch(err => {
      console.warn('[Airtable] Failed to delete announcement in Airtable:', err);
    });
  };

  // Thread handlers
  const addThread = (thread: Thread) => {
    const threadWithAuthor: Thread = {
      ...thread,
      author_name: thread.author_name || (user ? user.name : 'Student')
    };
    setThreads(prev => [threadWithAuthor, ...prev]);
    airtableService.createThread(threadWithAuthor).catch(err => {
      console.warn('[Airtable] Failed to create thread in Airtable:', err);
    });
  };

  const deleteThread = (id: string) => {
    setThreads(prev => prev.filter(t => t.id !== id));
    airtableService.deleteThread(id).catch(err => {
      console.warn('[Airtable] Failed to delete thread in Airtable:', err);
    });
  };

  // Base Event handlers
  const addBaseEvent = (eventData: Omit<BaseEvent, 'id'>) => {
    const newEvent: BaseEvent = {
      id: `be_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...eventData
    };
    setBaseEvents(prev => [...prev, newEvent]);
    airtableService.createBaseEvent(newEvent).catch(err => {
      console.warn('[Airtable] Failed to create base event in Airtable:', err);
    });
  };

  const updateBaseEvent = (id: string, eventData: Partial<BaseEvent>) => {
    setBaseEvents(prev => prev.map(b => b.id === id ? { ...b, ...eventData } : b));
    airtableService.updateBaseEvent(id, eventData).catch(err => {
      console.warn('[Airtable] Failed to update base event in Airtable:', err);
    });
  };

  const removeBaseEvent = (id: string) => {
    setBaseEvents(prev => prev.filter(b => b.id !== id));
    setExceptionEvents(prev => prev.filter(e => e.base_event_id !== id));
    airtableService.deleteBaseEvent(id).catch(err => {
      console.warn('[Airtable] Failed to delete base event in Airtable:', err);
    });
  };

  // Exception Event handlers
  const addOrUpdateException = (exceptionData: Omit<ExceptionEvent, 'id'> & { id?: string }) => {
    setExceptionEvents(prev => {
      if (exceptionData.id) {
        const updated = prev.map(e => e.id === exceptionData.id ? { ...e, ...exceptionData } : e);
        airtableService.updateException(exceptionData.id, exceptionData).catch(err => {
          console.warn('[Airtable] Failed to update exception in Airtable:', err);
        });
        return updated;
      }
      
      const filtered = prev.filter(e => !(
        e.schedule_id === exceptionData.schedule_id && 
        e.date === exceptionData.date && 
        e.base_event_id === exceptionData.base_event_id &&
        exceptionData.base_event_id !== null
      ));
      const newEx: ExceptionEvent = {
        id: `ex_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ...exceptionData
      };
      airtableService.createException(newEx).catch(err => {
        console.warn('[Airtable] Failed to create exception in Airtable:', err);
      });
      return [...filtered, newEx];
    });
  };

  const removeException = (id: string) => {
    setExceptionEvents(prev => prev.filter(e => e.id !== id));
    airtableService.deleteException(id).catch(err => {
      console.warn('[Airtable] Failed to delete exception in Airtable:', err);
    });
  };

  const removeAllExceptionsForBaseEvent = (baseEventId: string) => {
    const toRemove = exceptionEvents.filter(e => e.base_event_id === baseEventId);
    setExceptionEvents(prev => prev.filter(e => e.base_event_id !== baseEventId));
    toRemove.forEach(ex => {
      airtableService.deleteException(ex.id).catch(err => {
        console.warn('[Airtable] Failed to delete exception in Airtable:', err);
      });
    });
  };

  // Exam handlers (course_name & target_branch derived dynamically from courses)
  const addExam = (examData: Omit<ExamItem, 'id'>) => {
    const matchedCourse = courses.find(c => c.code.toUpperCase() === examData.course_code.toUpperCase());
    const newExam: ExamItem = {
      id: `exam_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...examData,
      course_name: matchedCourse?.name || examData.course_name || examData.course_code,
      target_branch: matchedCourse?.branch || examData.target_branch || 'All'
    };
    setExams(prev => [...prev, newExam]);
    airtableService.createExam(newExam).catch(err => {
      console.warn('[Airtable] Failed to create exam in Airtable:', err);
    });
  };

  const editExam = (id: string, examData: Partial<ExamItem>) => {
    setExams(prev => prev.map(ex => {
      if (ex.id !== id) return ex;
      const updatedCode = examData.course_code || ex.course_code;
      const matchedCourse = courses.find(c => c.code.toUpperCase() === updatedCode.toUpperCase());
      return {
        ...ex,
        ...examData,
        course_name: matchedCourse?.name || examData.course_name || ex.course_name,
        target_branch: matchedCourse?.branch || examData.target_branch || ex.target_branch
      };
    }));
    airtableService.updateExam(id, examData).catch(err => {
      console.warn('[Airtable] Failed to update exam in Airtable:', err);
    });
  };

  const deleteExam = (id: string) => {
    setExams(prev => prev.filter(ex => ex.id !== id));
    airtableService.deleteExam(id).catch(err => {
      console.warn('[Airtable] Failed to delete exam in Airtable:', err);
    });
  };

  // Resource & Folder handlers
  const createFolder = (name: string, parent_id: string | null, branch: User['branch']) => {
    if (!user) return;
    const newFolder: ResourceFolder = {
      id: `f_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      parent_id,
      branch,
      created_at: Date.now(),
      created_by: user.name
    };
    setFolders(prev => [...prev, newFolder]);
    airtableService.createFolder(newFolder).catch(err => {
      console.warn('[Airtable] Failed to create folder in Airtable:', err);
    });
  };

  const deleteFolder = (folderId: string) => {
    const idsToDelete = new Set<string>([folderId]);
    let added = true;
    while (added) {
      added = false;
      folders.forEach(f => {
        if (f.parent_id && idsToDelete.has(f.parent_id) && !idsToDelete.has(f.id)) {
          idsToDelete.add(f.id);
          added = true;
        }
      });
    }

    setFolders(prev => prev.filter(f => !idsToDelete.has(f.id)));
    setResources(prev => prev.filter(r => !r.folder_id || !idsToDelete.has(r.folder_id)));

    idsToDelete.forEach(id => {
      airtableService.deleteFolder(id).catch(err => {
        console.warn('[Airtable] Failed to delete folder in Airtable:', err);
      });
    });
  };

  const uploadResource = (resourceData: Omit<ResourceItem, 'id' | 'uploaded_at'>) => {
    const newResource: ResourceItem = {
      id: `res_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...resourceData,
      uploaded_at: Date.now()
    };
    setResources(prev => [newResource, ...prev]);
    airtableService.createResource(newResource).catch(err => {
      console.warn('[Airtable] Failed to create resource in Airtable:', err);
    });
  };

  const deleteResource = (resourceId: string) => {
    setResources(prev => prev.filter(r => r.id !== resourceId));
    airtableService.deleteResource(resourceId).catch(err => {
      console.warn('[Airtable] Failed to delete resource in Airtable:', err);
    });
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggle: toggleTheme }}>
      <AuthContext.Provider value={{ user, login, signup, updateProfile, updatePassword, logout }}>
        <DataContext.Provider value={{
          announcements, threads, setThreads, addThread, deleteThread, replies, addReply, deleteReply, editReply,
          addAnnouncement, editAnnouncement, deleteAnnouncement,
          schedules, setSchedules, baseEvents, setBaseEvents, exceptionEvents, setExceptionEvents,
          addBaseEvent, updateBaseEvent, removeBaseEvent,
          addOrUpdateException, removeException, removeAllExceptionsForBaseEvent,
          exams, setExams, addExam, editExam, deleteExam,
          folders, setFolders, resources, setResources,
          createFolder, deleteFolder, uploadResource, deleteResource,
          courses, setCourses, enrollments, setEnrollments, hostels, branches,
          resolveAuthorName, resolveHRs,
          airtableStatus, refreshAirtable, refreshCurrentData, loadDataForTab, isAirtableLoading, loadingTabPath
        }}>
          <RouterContext.Provider value={{ path: currentPath, navigate: handleNavigate, scheduleSubView, setScheduleSubView }}>
            {children}
          </RouterContext.Provider>
        </DataContext.Provider>
      </AuthContext.Provider>
    </ThemeContext.Provider>
  );
};

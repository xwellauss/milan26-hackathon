import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, Clock, MapPin, ChevronLeft, ChevronRight, 
  Plus, Edit2, Trash2, X, AlertTriangle, RotateCcw, Check, Sparkles, BookOpen, Layers,
  Lock, ArrowRight, GraduationCap, Search, FileText, ChevronDown, BellRing, Filter
} from 'lucide-react';
import { useAuth, useData, useRouter } from '../context/AppContext';
import { ScheduleMaster, BaseEvent, ExceptionEvent, Branch, ExamItem } from '../types';
import { Button, Input, Select } from './UI';
import { DatabaseLoader } from './DatabaseLoader';

// Component that dynamically measures its container and aligns the CANCELLED label with the exact diagonal line
const CancelledOverlay: React.FC<{ className?: string; badgeClassName?: string }> = ({ 
  className = '', 
  badgeClassName = '' 
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [angle, setAngle] = React.useState<number>(-25);

  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateAngle = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        // Line connects bottom-left (0, height) to top-right (width, 0)
        // Vector is (width, -height), angle relative to positive X-axis is -Math.atan2(height, width)
        const deg = -Math.atan2(rect.height, rect.width) * (180 / Math.PI);
        setAngle(deg);
      }
    };

    updateAngle();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateAngle) : null;
    if (ro) {
      ro.observe(el);
    }
    return () => {
      ro?.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className={`absolute inset-0 pointer-events-none overflow-hidden select-none ${className}`}>
      {/* Diagonal red line from bottom-left to top-right */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <line
          x1="0"
          y1="100"
          x2="100"
          y2="0"
          stroke="#dc2626"
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* Text CANCELLED perfectly angularly aligned with the diagonal red line */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 overflow-hidden">
        <div
          style={{ transform: `rotate(${angle}deg)` }}
          className="flex items-center justify-center will-change-transform max-w-full"
        >
          <span className={`text-[10px] sm:text-[11px] font-black tracking-widest text-red-600 dark:text-red-400 bg-white/95 dark:bg-slate-900/95 px-2 py-0.5 rounded border border-red-500 shadow-xs font-mono uppercase select-none whitespace-nowrap max-w-full truncate ${badgeClassName}`}>
            CANCELLED
          </span>
        </div>
      </div>
    </div>
  );
};

export const Schedules = () => {
  const { user } = useAuth();
  const { scheduleSubView, setScheduleSubView } = useRouter();
  const { 
    schedules, setSchedules, 
    baseEvents, setBaseEvents, exceptionEvents, setExceptionEvents,
    addBaseEvent, updateBaseEvent, removeBaseEvent,
    addOrUpdateException, removeException,
    exams, addExam, editExam, deleteExam,
    isAirtableLoading, loadingTabPath
  } = useData();

  const viewMode = scheduleSubView;
  const setViewMode = setScheduleSubView;
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);

  // CR Branch Selection Dropdown on top (defaults to user.branch if CR)
  const [crSelectedBranch, setCrSelectedBranch] = useState<Branch>(() => {
    if (user?.role === 'CR' && user?.branch !== '-') return user.branch;
    return 'CS';
  });

  // Effective branch filter for Today's Summary & Exam Schedule
  const effectiveBranch: Branch = (user?.role === 'CR') ? crSelectedBranch : (user?.branch || 'CS');

  // Week start date (Sunday 00:00:00)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay()); // Sunday of current week
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Schedule Master creation modal
  const [isSchModalOpen, setIsSchModalOpen] = useState(false);
  const [schForm, setSchForm] = useState<{
    title: string;
    type: 'Lecture Schedule' | 'Exam Schedule';
    target_branch: Branch;
    valid_from: string;
    valid_until: string;
  }>({
    title: '',
    type: 'Lecture Schedule',
    target_branch: (user?.role === 'CR' && user?.branch !== '-') ? user.branch : 'CS',
    valid_from: '2026-09-01',
    valid_until: '2026-11-30'
  });

  // Cell Click -> Add Event Modal (Choose Base Event vs Exception Event)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addSlotData, setAddSlotData] = useState<{ dateStr: string; dayIndex: number; hour: number } | null>(null);
  const [addEventType, setAddEventType] = useState<'base' | 'exception'>('base');
  const [eventForm, setEventForm] = useState({
    course: '',
    room: 'A-201',
    start_time: '10:00',
    end_time: '11:30'
  });

  // Event Click -> Manage / Edit / Remove Modal
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [selectedEventData, setSelectedEventData] = useState<{
    renderItem: any;
    dateStr: string;
    dayIndex: number;
  } | null>(null);

  const [manageActionTab, setManageActionTab] = useState<'details' | 'change' | 'remove'>('details');
  const [changeScope, setChangeScope] = useState<'base' | 'exception'>('exception');
  const [removeScope, setRemoveScope] = useState<'base' | 'exception'>('exception');
  const [editFormData, setEditFormData] = useState({
    course: '',
    room: '',
    start_time: '',
    end_time: ''
  });

  // Exam Search & Add Exam Modal state
  const [examSearch, setExamSearch] = useState('');
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [examModalMode, setExamModalMode] = useState<'add' | 'edit'>('add');
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [viewingExamDetails, setViewingExamDetails] = useState<ExamItem | null>(null);
  const [examForm, setExamForm] = useState<{
    date: string;
    hasTime: boolean;
    time: string;
    course_code: string;
    course_name: string;
    exam_name: string;
    hasVenue: boolean;
    venue: string;
    target_branch: Branch | 'All';
    notes: string;
  }>({
    date: '2026-10-05',
    hasTime: true,
    time: '09:30 - 12:30',
    course_code: '',
    course_name: '',
    exam_name: 'Mid-Semester Examination',
    hasVenue: true,
    venue: 'Academic Block A - LH-101',
    target_branch: user?.role === 'CR' ? user.branch : 'CS',
    notes: ''
  });

  const activeSchedule = schedules.find((s: ScheduleMaster) => s.id === activeScheduleId);

  // Permission check: CR ONLY has read-write access to their OWN branch schedule!
  const canEditSchedule = useMemo(() => {
    if (!user || !activeSchedule) return false;
    if (user.role !== 'CR') return false;
    return activeSchedule.target_branch === user.branch || activeSchedule.target_branch === '-';
  }, [user, activeSchedule]);

  // Keep target_branch synced with user branch if CR
  useEffect(() => {
    if (user?.role === 'CR' && user?.branch !== '-') {
      setSchForm(prev => ({ ...prev, target_branch: user.branch }));
      setCrSelectedBranch(user.branch);
    }
  }, [user]);

  // Keyboard navigation & ESC key to close dialogs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC closes any open modal in Schedules
      if (e.key === 'Escape') {
        if (viewingExamDetails) {
          setViewingExamDetails(null);
          return;
        }
        if (isAddModalOpen) setIsAddModalOpen(false);
        if (isManageModalOpen) setIsManageModalOpen(false);
        if (isSchModalOpen) setIsSchModalOpen(false);
        if (isExamModalOpen) setIsExamModalOpen(false);
        return;
      }

      // If typing in input or textarea, don't trigger arrow navigation
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      // Left/Right arrow keys to switch weeks when in calendar view
      if (viewMode === 'calendar' && !isAddModalOpen && !isManageModalOpen && !isSchModalOpen) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handlePrevWeek();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          handleNextWeek();
        } else if (e.key.toLowerCase() === 't') {
          e.preventDefault();
          handleToday();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddModalOpen, isManageModalOpen, isSchModalOpen, isExamModalOpen, viewMode]);

  const visibleSchedules = useMemo(() => {
    return schedules.filter((s: ScheduleMaster) => {
      if (user?.role === 'CR') {
        if (crSelectedBranch === '-') return true;
        return s.target_branch === crSelectedBranch || s.target_branch === '-';
      }
      if (user?.role === 'Normal Student') {
        return s.target_branch === user.branch || s.target_branch === '-';
      }
      return true;
    });
  }, [schedules, user, crSelectedBranch]);

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM to 8 PM

  // Calculate 7 dates for the current week
  const weekDates = useMemo(() => {
    return days.map((_, i) => {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentWeekStart]);

  const getFormattedDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Week navigation
  const handlePrevWeek = () => {
    setCurrentWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const handleToday = () => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    setCurrentWeekStart(d);
  };

  const handleJumpToStart = () => {
    if (!activeSchedule) return;
    const [y, m, d] = activeSchedule.valid_from.split('-').map(Number);
    const startDate = new Date(y, m - 1, d);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    startDate.setHours(0, 0, 0, 0);
    setCurrentWeekStart(startDate);
  };

  const handleJumpToEnd = () => {
    if (!activeSchedule) return;
    const [y, m, d] = activeSchedule.valid_until.split('-').map(Number);
    const endDate = new Date(y, m - 1, d);
    endDate.setDate(endDate.getDate() - endDate.getDay());
    endDate.setHours(0, 0, 0, 0);
    setCurrentWeekStart(endDate);
  };

  const isDateWithinSchedule = (dateStr: string) => {
    if (!activeSchedule) return true;
    return dateStr >= activeSchedule.valid_from && dateStr <= activeSchedule.valid_until;
  };

  // Compute merged events for a specific day of the week in calendar view
  const getRenderEventsForDay = (date: Date, dayIndex: number) => {
    if (!activeScheduleId) return [];

    const dateStr = getFormattedDate(date);
    const isOutOfSchedule = !isDateWithinSchedule(dateStr);

    const dayBaseEvents = baseEvents.filter(
      (b: BaseEvent) => b.schedule_id === activeScheduleId && b.day_of_week === dayIndex
    );

    const exceptionsForDate = exceptionEvents.filter(
      (e: ExceptionEvent) => e.schedule_id === activeScheduleId && e.date === dateStr
    );

    const rendered: any[] = [];

    dayBaseEvents.forEach((base: BaseEvent) => {
      const exThisDate = exceptionsForDate.find((e: ExceptionEvent) => e.base_event_id === base.id);

      if (exThisDate) {
        if (exThisDate.type === 'remove') {
          rendered.push({
            ...base,
            ...exThisDate,
            course: exThisDate.course || base.course,
            room: exThisDate.room || base.room,
            start_time: exThisDate.start_time || base.start_time,
            end_time: exThisDate.end_time || base.end_time,
            day_of_week: base.day_of_week,
            _renderType: 'remove',
            _isException: true,
            _baseId: base.id,
            _exceptionId: exThisDate.id,
            _isOutOfSchedule: isOutOfSchedule
          });
        } else if (exThisDate.type === 'change') {
          rendered.push({
            ...base,
            ...exThisDate,
            course: exThisDate.course || base.course,
            room: exThisDate.room || base.room,
            start_time: exThisDate.start_time || base.start_time,
            end_time: exThisDate.end_time || base.end_time,
            _renderType: 'change',
            _isException: true,
            _baseId: base.id,
            _exceptionId: exThisDate.id,
            _isOutOfSchedule: isOutOfSchedule
          });
        }
      } else {
        rendered.push({
          ...base,
          _renderType: 'base',
          _isException: false,
          _baseId: base.id,
          _exceptionId: null,
          _isOutOfSchedule: isOutOfSchedule
        });
      }
    });

    exceptionsForDate.filter((e: ExceptionEvent) => e.type === 'add').forEach((addEx: ExceptionEvent) => {
      rendered.push({
        id: addEx.id,
        schedule_id: addEx.schedule_id,
        course: addEx.course || 'Added Event',
        day_of_week: dayIndex,
        start_time: addEx.start_time || '10:00',
        end_time: addEx.end_time || '11:00',
        room: addEx.room || 'TBD',
        _renderType: 'add',
        _isException: true,
        _baseId: null,
        _exceptionId: addEx.id,
        _isOutOfSchedule: isOutOfSchedule
      });
    });

    return rendered;
  };

  // Convert "HH:MM" to minutes from 8:00 AM (8 * 60 = 480)
  const getMinutesFromStartOfDay = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return Math.max(0, (h * 60 + m) - 480);
  };

  const getEventDurationMinutes = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return 60;
    const [sh, sm] = startStr.split(':').map(Number);
    const [eh, em] = endStr.split(':').map(Number);
    const duration = (eh * 60 + em) - (sh * 60 + sm);
    return Math.max(30, duration);
  };

  const handleCellClick = (dateStr: string, dayIndex: number, hour: number) => {
    if (!canEditSchedule) return;
    const startHourStr = String(hour).padStart(2, '0');
    const endHourStr = String(hour + 1).padStart(2, '0');
    setAddSlotData({ dateStr, dayIndex, hour });
    setEventForm({
      course: '',
      room: 'A-201',
      start_time: `${startHourStr}:00`,
      end_time: `${endHourStr}:30`
    });
    setAddEventType('base');
    setIsAddModalOpen(true);
  };

  const handleSaveNewEvent = () => {
    if (!activeScheduleId || !addSlotData || !eventForm.course.trim()) return;

    if (addEventType === 'base') {
      addBaseEvent({
        schedule_id: activeScheduleId,
        course: eventForm.course,
        day_of_week: addSlotData.dayIndex,
        start_time: eventForm.start_time,
        end_time: eventForm.end_time,
        room: eventForm.room
      });
    } else {
      addOrUpdateException({
        schedule_id: activeScheduleId,
        base_event_id: null,
        date: addSlotData.dateStr,
        type: 'add',
        course: eventForm.course,
        start_time: eventForm.start_time,
        end_time: eventForm.end_time,
        room: eventForm.room
      });
    }

    setIsAddModalOpen(false);
  };

  const handleEventCardClick = (renderItem: any, dateStr: string, dayIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEventData({ renderItem, dateStr, dayIndex });
    setEditFormData({
      course: renderItem.course || '',
      room: renderItem.room || '',
      start_time: renderItem.start_time || '10:00',
      end_time: renderItem.end_time || '11:30'
    });
    setManageActionTab('details');
    setChangeScope('exception');
    setRemoveScope('exception');
    setIsManageModalOpen(true);
  };

  const handleConfirmChange = () => {
    if (!canEditSchedule || !selectedEventData || !activeScheduleId) return;
    const { renderItem, dateStr } = selectedEventData;

    if (changeScope === 'base') {
      if (renderItem._baseId) {
        updateBaseEvent(renderItem._baseId, {
          course: editFormData.course,
          room: editFormData.room,
          start_time: editFormData.start_time,
          end_time: editFormData.end_time
        });
      }
    } else {
      addOrUpdateException({
        id: renderItem._exceptionId || undefined,
        schedule_id: activeScheduleId,
        base_event_id: renderItem._baseId || null,
        date: dateStr,
        type: 'change',
        course: editFormData.course,
        room: editFormData.room,
        start_time: editFormData.start_time,
        end_time: editFormData.end_time
      });
    }

    setIsManageModalOpen(false);
  };

  const handleCancelThisDateOnly = () => {
    if (!canEditSchedule || !selectedEventData || !activeScheduleId) return;
    const { renderItem, dateStr } = selectedEventData;

    if (renderItem._baseId) {
      addOrUpdateException({
        id: renderItem._exceptionId || undefined,
        schedule_id: activeScheduleId,
        base_event_id: renderItem._baseId,
        date: dateStr,
        type: 'remove',
        course: renderItem.course,
        room: renderItem.room,
        start_time: renderItem.start_time,
        end_time: renderItem.end_time
      });
    } else if (renderItem._exceptionId) {
      removeException(renderItem._exceptionId);
    }

    setIsManageModalOpen(false);
  };

  const handleDeleteBaseEventPermanently = () => {
    if (!canEditSchedule || !selectedEventData) return;
    const { renderItem } = selectedEventData;
    if (renderItem._baseId) {
      removeBaseEvent(renderItem._baseId);
    } else if (renderItem._exceptionId) {
      removeException(renderItem._exceptionId);
    }
    setIsManageModalOpen(false);
  };

  const handleRevertSingleException = () => {
    if (!canEditSchedule || !selectedEventData) return;
    const { renderItem, dateStr } = selectedEventData;

    // 1. Remove by ID if present in renderItem
    if (renderItem._exceptionId) {
      removeException(renderItem._exceptionId);
    }
    if (renderItem.id && renderItem._isException) {
      removeException(renderItem.id);
    }

    // 2. Direct filter on state as a fail-safe against any date/ID mismatches
    setExceptionEvents(prev => prev.filter(e => {
      if (renderItem._exceptionId && e.id === renderItem._exceptionId) return false;
      if (renderItem.id && renderItem._isException && e.id === renderItem.id) return false;
      if (
        activeScheduleId && 
        renderItem._baseId && 
        e.schedule_id === activeScheduleId && 
        e.date === dateStr && 
        e.base_event_id === renderItem._baseId
      ) {
        return false;
      }
      return true;
    }));

    setIsManageModalOpen(false);
  };

  const handleCreateScheduleMaster = () => {
    if (!schForm.title.trim()) return;
    const branchToUse: Branch = (user?.role === 'CR' && user?.branch !== '-') 
      ? user.branch 
      : schForm.target_branch;

    const newSch: ScheduleMaster = {
      id: `sm_${Date.now()}`,
      title: schForm.title,
      type: schForm.type,
      target_branch: branchToUse,
      valid_from: schForm.valid_from,
      valid_until: schForm.valid_until
    };
    setSchedules(prev => [...prev, newSch]);
    setIsSchModalOpen(false);
  };

  // -------------------------------------------------------------
  // TODAY'S SCHEDULE SUMMARY CALCULATION
  // -------------------------------------------------------------
  const todayEvents = useMemo(() => {
    const todayDate = new Date();
    const todayDateStr = getFormattedDate(todayDate);
    const todayDayOfWeek = todayDate.getDay();

    // 1. Filter schedules visible to the current branch
    const branchSchedules = schedules.filter((s: ScheduleMaster) => {
      if (user?.role === 'CR') {
        return s.target_branch === crSelectedBranch || s.target_branch === '-';
      }
      return s.target_branch === user?.branch || s.target_branch === '-';
    });

    const results: Array<{
      id: string;
      scheduleTitle: string;
      branch: Branch;
      course: string;
      room: string;
      start_time: string;
      end_time: string;
      type: 'regular' | 'changed' | 'added' | 'cancelled';
      notes?: string;
    }> = [];

    branchSchedules.forEach(sch => {
      // Verify schedule is currently active today
      const isWithin = todayDateStr >= sch.valid_from && todayDateStr <= sch.valid_until;
      if (!isWithin) return;

      // Base events for today
      const dayBases = baseEvents.filter(b => b.schedule_id === sch.id && b.day_of_week === todayDayOfWeek);
      const dateExceptions = exceptionEvents.filter(e => e.schedule_id === sch.id && e.date === todayDateStr);

      dayBases.forEach(base => {
        const ex = dateExceptions.find(e => e.base_event_id === base.id);
        if (ex) {
          if (ex.type === 'remove') {
            // Event was cancelled today - render with red cancelled style
            results.push({
              id: ex.id || base.id,
              scheduleTitle: sch.title,
              branch: sch.target_branch,
              course: ex.course || base.course,
              room: ex.room || base.room,
              start_time: ex.start_time || base.start_time,
              end_time: ex.end_time || base.end_time,
              type: 'cancelled',
              notes: 'Cancelled for today'
            });
            return;
          } else if (ex.type === 'change') {
            results.push({
              id: ex.id,
              scheduleTitle: sch.title,
              branch: sch.target_branch,
              course: ex.course || base.course,
              room: ex.room || base.room,
              start_time: ex.start_time || base.start_time,
              end_time: ex.end_time || base.end_time,
              type: 'changed',
              notes: 'Changed timing/venue exception for today'
            });
          }
        } else {
          results.push({
            id: base.id,
            scheduleTitle: sch.title,
            branch: sch.target_branch,
            course: base.course,
            room: base.room,
            start_time: base.start_time,
            end_time: base.end_time,
            type: 'regular'
          });
        }
      });

      // Added exceptions for today
      dateExceptions.filter(e => e.type === 'add').forEach(addEx => {
        results.push({
          id: addEx.id,
          scheduleTitle: sch.title,
          branch: sch.target_branch,
          course: addEx.course || 'Special Lecture',
          room: addEx.room || 'TBD',
          start_time: addEx.start_time || '10:00',
          end_time: addEx.end_time || '11:00',
          type: 'added',
          notes: 'Special added session for today'
        });
      });
    });

    // Sort chronologically by start_time
    return results.sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [schedules, baseEvents, exceptionEvents, user, crSelectedBranch]);

  // -------------------------------------------------------------
  // EXAM SCHEDULE FILTERING & GROUPING
  // -------------------------------------------------------------
  const visibleExams = useMemo(() => {
    let list = exams.filter((ex: ExamItem) => {
      if (user?.role === 'CR') {
        if (crSelectedBranch === '-') return true;
        return ex.target_branch === crSelectedBranch || ex.target_branch === 'All';
      }
      return ex.target_branch === user?.branch || ex.target_branch === 'All' || ex.target_branch === '-';
    });

    if (examSearch.trim()) {
      const q = examSearch.trim().toLowerCase();
      list = list.filter(ex => 
        ex.course_code.toLowerCase().includes(q) ||
        (ex.course_name && ex.course_name.toLowerCase().includes(q)) ||
        ex.exam_name.toLowerCase().includes(q) ||
        (ex.venue && ex.venue.toLowerCase().includes(q))
      );
    }

    return [...list].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.time && b.time) return a.time.localeCompare(b.time);
      return 0;
    });
  }, [exams, user, crSelectedBranch, examSearch]);

  const handleOpenAddExam = () => {
    setExamModalMode('add');
    setSelectedExamId(null);
    setExamForm({
      date: getFormattedDate(new Date()),
      hasTime: true,
      time: '09:30 - 12:30',
      course_code: '',
      course_name: '',
      exam_name: 'Mid-Semester Examination',
      hasVenue: true,
      venue: 'Academic Block A - LH-101',
      target_branch: (user?.role === 'CR' ? crSelectedBranch : (user?.branch || 'CS')) as Branch,
      notes: ''
    });
    setIsExamModalOpen(true);
  };

  const handleOpenEditExam = (ex: ExamItem) => {
    setExamModalMode('edit');
    setSelectedExamId(ex.id);
    setExamForm({
      date: ex.date,
      hasTime: ex.time !== null && ex.time !== undefined,
      time: ex.time || '09:30 - 12:30',
      course_code: ex.course_code,
      course_name: ex.course_name || '',
      exam_name: ex.exam_name,
      hasVenue: ex.venue !== null && ex.venue !== undefined,
      venue: ex.venue || 'Academic Block A - LH-101',
      target_branch: (ex.target_branch || 'All') as Branch | 'All',
      notes: ex.notes || ''
    });
    setIsExamModalOpen(true);
  };

  const handleSaveExam = () => {
    if (!examForm.course_code.trim() || !examForm.exam_name.trim()) return;

    const examPayload = {
      date: examForm.date,
      time: examForm.hasTime ? examForm.time : null,
      course_code: examForm.course_code.toUpperCase(),
      course_name: examForm.course_name.trim() || undefined,
      exam_name: examForm.exam_name,
      venue: examForm.hasVenue ? examForm.venue : null,
      target_branch: examForm.target_branch,
      notes: examForm.notes || null
    };

    if (examModalMode === 'add') {
      addExam(examPayload);
    } else if (selectedExamId) {
      editExam(selectedExamId, examPayload);
    }

    setIsExamModalOpen(false);
  };

  // Available branch list for CR dropdown
  const branchOptions: Branch[] = ['CS', 'EE', 'MnC', 'AI', 'ME', 'CE', 'BT'];

  // Top Action Navigation Bar (shared across list / today / exams)
  const renderTopControls = () => (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
      <div className="flex flex-wrap items-center gap-2">
        {/* Button 1: Today's Schedule Summary */}
        <button
          onClick={() => setViewMode('today_summary')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all duration-150 active:scale-[0.97] cursor-pointer ${
            viewMode === 'today_summary'
              ? 'bg-indigo-600 text-white shadow-2xs dark:bg-indigo-500'
              : 'bg-slate-100/80 text-slate-700 hover:bg-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750 border border-slate-200/60 dark:border-slate-700/60'
          }`}
          title="View today's vertical chronological timeline"
        >
          <Clock className="w-4 h-4" />
          <span>Today's Schedule Summary</span>
        </button>

        {/* Button 2: Exam Schedule */}
        <button
          onClick={() => setViewMode('exam_schedule')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all duration-150 active:scale-[0.97] cursor-pointer ${
            viewMode === 'exam_schedule'
              ? 'bg-indigo-600 text-white shadow-2xs dark:bg-indigo-500'
              : 'bg-slate-100/80 text-slate-700 hover:bg-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750 border border-slate-200/60 dark:border-slate-700/60'
          }`}
          title="View full institute & branch examination timeline"
        >
          <GraduationCap className="w-4 h-4" />
          <span>Exam Schedule</span>
        </button>

        {/* Master Schedules button */}
        {viewMode !== 'list' && (
          <button
            onClick={() => { setViewMode('list'); setActiveScheduleId(null); }}
            className="px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-all duration-150 active:scale-[0.97] animate-scale-in cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Schedules</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {/* CR Branch Selection Dropdown on top */}
        {user?.role === 'CR' && (
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Branch:</span>
            <select
              value={crSelectedBranch}
              onChange={(e) => setCrSelectedBranch(e.target.value as Branch)}
              className="bg-transparent text-xs font-bold text-indigo-600 dark:text-indigo-400 outline-none cursor-pointer"
            >
              {branchOptions.map(b => (
                <option key={b} value={b} className="dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                  {b} {b === user.branch ? '(Your Branch)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* CR New Schedule Master Button on List View */}
        {viewMode === 'list' && user?.role === 'CR' && (
          <Button onClick={() => setIsSchModalOpen(true)} className="!text-xs !py-2">
            <Plus className="w-3.5 h-3.5" /> New Schedule ({user.branch})
          </Button>
        )}

        {/* CR Add Exam Button on Exam View */}
        {viewMode === 'exam_schedule' && user?.role === 'CR' && (
          <Button onClick={handleOpenAddExam} className="!text-xs !py-2">
            <Plus className="w-3.5 h-3.5" /> Add Exam
          </Button>
        )}
      </div>
    </div>
  );

  // Database loading state for Schedules
  if (loadingTabPath === '/schedules' || (isAirtableLoading && schedules.length === 0 && baseEvents.length === 0 && exams.length === 0)) {
    return (
      <div className="space-y-6 animate-fade-in">
        {renderTopControls()}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200/60 dark:border-slate-800 p-8 shadow-2xs">
          <DatabaseLoader 
            type="schedules_events" 
            resourceName="Timetable & Examination Schedules"
            message="Fetching weekly master timetable, lecture slots, date exceptions, and exam schedules from database..."
            variant="panel"
          />
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 1. TODAY'S SCHEDULE SUMMARY VIEW (Vertical Timeline)
  // -------------------------------------------------------------
  if (viewMode === 'today_summary') {
    const todayFormatted = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    return (
      <div className="space-y-6">
        {renderTopControls()}

        <div key={`today-${effectiveBranch}`} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-2xs animate-tab-enter">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewMode('list')}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Back to all schedules"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>Today's Schedule Summary</span>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-900/50">
                    {effectiveBranch}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {todayFormatted}
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {todayEvents.length} event{todayEvents.length !== 1 ? 's' : ''} scheduled
            </div>
          </div>

          {/* Timeline Body */}
          <div className="pt-6">
            {todayEvents.length === 0 ? (
              <div className="py-16 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50">
                <CalendarIcon className="w-10 h-10 mx-auto text-slate-400 mb-3" />
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No events or lectures scheduled for today
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  Enjoy your day or check the full weekly timetable to plan upcoming days.
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <Button variant="secondary" onClick={() => setViewMode('list')}>
                    View All Schedules
                  </Button>
                </div>
              </div>
            ) : (
              <div className="relative pl-6 md:pl-8 space-y-6 before:absolute before:left-3 md:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                {todayEvents.map((evt, idx) => {
                  const isEvtCancelled = evt.type === 'cancelled';

                  return (
                    <div key={evt.id + idx} className="relative group">
                      {/* Timeline Dot Node */}
                      <div className={`absolute -left-6 md:-left-8 top-1.5 w-6 h-6 rounded-full bg-white dark:bg-slate-900 border-2 flex items-center justify-center shadow-xs ${
                        isEvtCancelled ? 'border-red-500' : 'border-indigo-500'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${
                          isEvtCancelled ? 'bg-red-600 dark:bg-red-400' : 'bg-indigo-600 dark:bg-indigo-400'
                        }`}></div>
                      </div>

                      {/* Event Card Content */}
                      <div className={`rounded-xl p-4 transition-all relative overflow-hidden ${
                        isEvtCancelled
                          ? 'border-2 border-red-600 dark:border-red-500 bg-rose-50/80 dark:bg-rose-950/40 text-rose-950 dark:text-rose-100 shadow-red-500/10'
                          : 'bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 hover:border-indigo-300 dark:hover:border-indigo-700'
                      }`}>
                        {/* Red Diagonal Line and CANCELLED along diagonal */}
                        {isEvtCancelled && (
                          <CancelledOverlay badgeClassName="text-xs sm:text-sm !px-3 !py-1 !border-2" />
                        )}

                        <div className={`relative z-0 ${isEvtCancelled ? 'opacity-70' : ''}`}>
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                                isEvtCancelled
                                  ? 'text-red-700 dark:text-red-300 bg-red-100/60 dark:bg-red-950/60 border-red-300 dark:border-red-800'
                                  : 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200/40 dark:border-indigo-900/40'
                              }`}>
                                <Clock className="w-3 h-3" />
                                {evt.start_time} - {evt.end_time}
                              </span>

                              {evt.type === 'cancelled' && (
                                <span className="text-[10px] font-bold text-red-700 bg-red-100/80 dark:bg-red-950/60 dark:text-red-300 px-2 py-0.5 rounded border border-red-300 dark:border-red-900">
                                  ❌ Cancelled on this date
                                </span>
                              )}
                              {evt.type === 'changed' && (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900">
                                  ⚡ Exception Updated
                                </span>
                              )}
                              {evt.type === 'added' && (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900">
                                  ➕ Added Special Session
                                </span>
                              )}
                              {evt.type === 'regular' && (
                                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                  Regular Lecture
                                </span>
                              )}
                            </div>

                            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                              {evt.scheduleTitle}
                            </span>
                          </div>

                          <h4 className={`text-sm font-bold ${
                            isEvtCancelled
                              ? 'text-slate-500 dark:text-slate-400 line-through'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}>
                            {evt.course}
                          </h4>

                          <div className={`mt-2 flex items-center gap-4 text-xs ${
                            isEvtCancelled ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-300'
                          }`}>
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              <span>Room: <strong>{evt.room}</strong></span>
                            </div>
                            {evt.notes && (
                              <div className="text-slate-500 dark:text-slate-400 italic">
                                {evt.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. EXAM SCHEDULE VIEW (Vertical Timeline)
  // -------------------------------------------------------------
  if (viewMode === 'exam_schedule') {
    return (
      <div className="space-y-6">
        {renderTopControls()}

        <div key={`exams-${effectiveBranch}`} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-2xs animate-tab-enter">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewMode('list')}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Back to all schedules"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <span>Exam Schedule</span>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-900/50">
                    {effectiveBranch}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Chronological timeline of midterms, lab practicals & end-semester examinations
                </p>
              </div>
            </div>

            {/* Exam Search Bar */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search course code or exam..."
                value={examSearch}
                onChange={(e) => setExamSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              {examSearch && (
                <button
                  onClick={() => setExamSearch('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Exam Timeline Body */}
          <div className="pt-6">
            {visibleExams.length === 0 ? (
              <div className="py-16 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50">
                <FileText className="w-10 h-10 mx-auto text-slate-400 mb-3" />
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No exams found for {effectiveBranch}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  {examSearch ? 'Try adjusting your search query.' : 'There are currently no examinations scheduled for this branch.'}
                </p>
                {user?.role === 'CR' && (
                  <div className="mt-4 flex justify-center">
                    <Button onClick={handleOpenAddExam}>
                      <Plus className="w-4 h-4" /> Add Exam
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative pl-6 md:pl-8 space-y-4 before:absolute before:left-3 md:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                {visibleExams.map((ex) => {
                  const examDateObj = new Date(ex.date + 'T00:00:00');
                  const formattedExamDate = examDateObj.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });

                  const daysInfo = (() => {
                    const now = new Date();
                    now.setHours(0, 0, 0, 0);
                    const target = new Date(ex.date + 'T00:00:00');
                    target.setHours(0, 0, 0, 0);
                    const diffDays = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    if (diffDays < 0) return { days: diffDays, text: 'Completed', isPast: true };
                    if (diffDays === 0) return { days: 0, text: 'Today', isPast: false };
                    if (diffDays === 1) return { days: 1, text: 'Tomorrow', isPast: false };
                    return { days: diffDays, text: `In ${diffDays} days`, isPast: false };
                  })();

                  return (
                    <div key={ex.id} className="relative group">
                      {/* Timeline Dot Node */}
                      <div className="absolute -left-6 md:-left-8 top-3 w-6 h-6 rounded-full bg-white dark:bg-slate-900 border-2 border-purple-500 flex items-center justify-center shadow-xs">
                        <div className="w-2 h-2 rounded-full bg-purple-600 dark:bg-purple-400"></div>
                      </div>

                      {/* Minimalist Exam Card: exam name, course code, exam type, branch, date, days left */}
                      <div 
                        onClick={() => setViewingExamDetails(ex)}
                        className="bg-slate-50/80 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200/60 dark:border-slate-700/60 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:shadow-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50 shrink-0">
                            {ex.course_code}
                          </span>

                          <div className="min-w-0">
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                              {ex.exam_name}
                            </h4>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                              <span>{formattedExamDate}</span>
                              <span>•</span>
                              <span className="font-semibold text-slate-600 dark:text-slate-300">{ex.target_branch}</span>
                              {ex.course_name && (
                                <>
                                  <span>•</span>
                                  <span className="truncate">{ex.course_name}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                          {/* Days Left Badge */}
                          <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${
                            daysInfo.isPast
                              ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                              : daysInfo.days === 0
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-900 animate-pulse'
                              : daysInfo.days <= 3
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900'
                              : 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200/60 dark:border-purple-900/60'
                          }`}>
                            {daysInfo.text}
                          </span>

                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Exam Full Details Inspection Modal */}
        {viewingExamDetails && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-backdrop-enter">
            <div className="bg-white dark:bg-slate-850 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-750 w-full max-w-lg p-6 space-y-4 animate-modal-enter">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-750 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50">
                      {viewingExamDetails.course_code}
                    </span>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200/50 dark:border-purple-900/50">
                      {viewingExamDetails.exam_name}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {viewingExamDetails.course_name || viewingExamDetails.course_code}
                  </h3>
                </div>
                <button
                  onClick={() => setViewingExamDetails(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Date:</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {new Date(viewingExamDetails.date + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Timing:</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono">
                      {viewingExamDetails.time || 'To be announced (TBA)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Venue / Room:</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {viewingExamDetails.venue || 'To be announced (TBA)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Target Branch:</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {viewingExamDetails.target_branch}
                    </span>
                  </div>
                </div>

                {viewingExamDetails.notes && (
                  <div className="p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-100/60 dark:border-purple-900/40 text-purple-900 dark:text-purple-200 leading-relaxed">
                    <strong>Special Instructions:</strong> {viewingExamDetails.notes}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-750">
                {user?.role === 'CR' ? (
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="secondary" 
                      onClick={() => {
                        const ex = viewingExamDetails;
                        setViewingExamDetails(null);
                        handleOpenEditExam(ex);
                      }}
                      className="!text-xs !py-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button 
                      variant="danger" 
                      onClick={() => {
                        const id = viewingExamDetails.id;
                        setViewingExamDetails(null);
                        deleteExam(id);
                      }}
                      className="!text-xs !py-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </Button>
                  </div>
                ) : <div />}

                <Button variant="ghost" onClick={() => setViewingExamDetails(null)} className="!text-xs">
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Add / Edit Exam Modal */}
        {isExamModalOpen && user?.role === 'CR' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-backdrop-enter">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-700/80 w-full max-w-lg overflow-hidden animate-modal-enter">
              <div className="p-5 border-b border-slate-100 dark:border-slate-700/80 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-indigo-500" />
                  {examModalMode === 'add' ? 'Add Exam to Schedule' : 'Edit Exam Details'}
                </h3>
                <button 
                  onClick={() => setIsExamModalOpen(false)} 
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full cursor-pointer"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Course Code *"
                    placeholder="e.g. CS3020"
                    value={examForm.course_code}
                    onChange={(e: any) => setExamForm({ ...examForm, course_code: e.target.value })}
                    autoFocus
                  />
                </div>

                <Input
                  label="Course Title (Optional - auto-derived from courses)"
                  placeholder="e.g. Operating Systems"
                  value={examForm.course_name}
                  onChange={(e: any) => setExamForm({ ...examForm, course_name: e.target.value })}
                />

                <Select
                  label="Exam Type"
                  value={examForm.exam_name}
                  onChange={(e: any) => setExamForm({ ...examForm, exam_name: e.target.value })}
                >
                  <option value="Mid-Semester Examination">Mid-Semester Examination</option>
                  <option value="End-Semester Examination">End-Semester Examination</option>
                  <option value="Quiz 1">Quiz 1</option>
                  <option value="Quiz 2">Quiz 2</option>
                  <option value="Lab Practical Evaluation">Lab Practical Evaluation</option>
                  <option value="Course Project Presentation">Course Project Presentation</option>
                </Select>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Exam Date *"
                    type="date"
                    value={examForm.date}
                    onChange={(e: any) => setExamForm({ ...examForm, date: e.target.value })}
                  />
                  <Select
                    label="Target Branch"
                    value={examForm.target_branch}
                    onChange={(e: any) => setExamForm({ ...examForm, target_branch: e.target.value as Branch })}
                  >
                    {branchOptions.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                    <option value="All">All (Institute-wide)</option>
                  </Select>
                </div>

                {/* Nullable Time Section */}
                <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Exam Time (Nullable)
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={examForm.hasTime}
                        onChange={(e) => setExamForm({ ...examForm, hasTime: e.target.checked })}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Set Specific Time</span>
                    </label>
                  </div>
                  {examForm.hasTime ? (
                    <Input
                      placeholder="e.g. 09:30 - 12:30 or 14:00 - 17:00"
                      value={examForm.time}
                      onChange={(e: any) => setExamForm({ ...examForm, time: e.target.value })}
                    />
                  ) : (
                    <p className="text-xs text-slate-400 italic">Will be marked as 'Time TBA'</p>
                  )}
                </div>

                {/* Nullable Venue Section */}
                <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Exam Venue (Nullable)
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={examForm.hasVenue}
                        onChange={(e) => setExamForm({ ...examForm, hasVenue: e.target.checked })}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Set Specific Venue</span>
                    </label>
                  </div>
                  {examForm.hasVenue ? (
                    <Input
                      placeholder="e.g. Academic Block A - LH-101, Auditorium"
                      value={examForm.venue}
                      onChange={(e: any) => setExamForm({ ...examForm, venue: e.target.value })}
                    />
                  ) : (
                    <p className="text-xs text-slate-400 italic">Will be marked as 'Venue TBA'</p>
                  )}
                </div>

                <Input
                  label="Instructions / Notes (Optional)"
                  placeholder="e.g. Closed book, allowed calculators only."
                  value={examForm.notes}
                  onChange={(e: any) => setExamForm({ ...examForm, notes: e.target.value })}
                />
              </div>

              <div className="p-4 border-t border-slate-100 dark:border-slate-700/80 flex justify-end gap-2 bg-slate-50/50 dark:bg-slate-900/50">
                <Button variant="ghost" onClick={() => setIsExamModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveExam}>
                  {examModalMode === 'add' ? 'Save Exam' : 'Update Exam'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // 3. WEEKLY TIMELINE CALENDAR VIEW
  // -------------------------------------------------------------
  if (viewMode === 'calendar' && activeSchedule) {
    return (
      <div className="space-y-4">
        {renderTopControls()}

        <div key={`cal-${activeSchedule.id}`} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 flex flex-col h-[calc(100vh-10rem)] overflow-hidden animate-tab-enter">
          {/* Navigation & Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 flex flex-wrap gap-4 justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => { setViewMode('list'); setActiveScheduleId(null); }} 
                className="p-2 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer text-slate-700 dark:text-slate-300"
                title="Back to all schedules"
              >
                <ChevronLeft className="w-5 h-5"/>
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {activeSchedule.title}
                  </h2>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/40 dark:border-indigo-900/40">
                    {activeSchedule.target_branch}
                  </span>
                  {!canEditSchedule && (
                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Read Only
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">Validity:</span>
                  <span>{activeSchedule.valid_from} to {activeSchedule.valid_until}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <Button 
                  variant="secondary" 
                  className="!text-xs !py-1.5 !px-2.5" 
                  onClick={handleJumpToStart} 
                  title="Jump to schedule start week"
                >
                  Start
                </Button>
                <Button 
                  variant="secondary" 
                  className="!text-xs !py-1.5 !px-2.5" 
                  onClick={handleToday}
                  title="Jump to current week"
                >
                  Today
                </Button>
                <Button 
                  variant="secondary" 
                  className="!text-xs !py-1.5 !px-2.5" 
                  onClick={handleJumpToEnd} 
                  title="Jump to schedule end week"
                >
                  End
                </Button>
              </div>

              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                <button 
                  onClick={handlePrevWeek} 
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-90 transition-all rounded-lg cursor-pointer text-slate-600 dark:text-slate-300"
                  title="Previous Week"
                >
                  <ChevronLeft className="w-4 h-4"/>
                </button>
                <span key={currentWeekStart.toISOString()} className="text-xs font-semibold px-2 text-center min-w-[170px] text-slate-800 dark:text-slate-200 animate-fade-in">
                  {weekDates[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric'})} - {weekDates[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric'})}
                </span>
                <button 
                  onClick={handleNextWeek} 
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-90 transition-all rounded-lg cursor-pointer text-slate-600 dark:text-slate-300"
                  title="Next Week"
                >
                  <ChevronRight className="w-4 h-4"/>
                </button>
              </div>
            </div>
          </div>

          {/* Calendar Grid Container */}
          <div className="flex-1 overflow-auto custom-scrollbar bg-slate-50/40 dark:bg-slate-950/40 relative">
            <div className="min-w-[900px]">
              {/* UNIFIED STICKY TOP ROW */}
              <div className="sticky top-0 z-40 flex border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs select-none">
                <div className="w-16 shrink-0 border-r border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 sticky left-0 z-50"></div>

                <div className="flex-1 flex">
                  {weekDates.map((date, dayIndex) => {
                    const dateStr = getFormattedDate(date);
                    const isOutOfSchedule = !isDateWithinSchedule(dateStr);
                    const isToday = new Date().toDateString() === date.toDateString();

                    return (
                      <div 
                        key={dayIndex}
                        className={`flex-1 border-r border-slate-200/80 dark:border-slate-800 h-14 flex flex-col items-center justify-center transition-colors min-w-[120px] ${
                          isOutOfSchedule 
                            ? 'bg-slate-100 dark:bg-slate-950 text-slate-500' 
                            : isToday 
                              ? 'bg-indigo-50/80 dark:bg-indigo-950/60 border-b-2 border-b-indigo-500' 
                              : 'bg-white dark:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[11px] uppercase font-semibold tracking-wider ${
                            isOutOfSchedule 
                              ? 'text-slate-400 line-through' 
                              : isToday 
                                ? 'text-indigo-600 dark:text-indigo-400 font-bold' 
                                : 'text-slate-500 dark:text-slate-400'
                          }`}>
                            {days[dayIndex].slice(0, 3)}
                          </span>
                        </div>
                        <div className={`text-sm font-bold mt-0.5 ${
                          isOutOfSchedule 
                            ? 'text-slate-400' 
                            : isToday 
                              ? 'text-indigo-600 dark:text-indigo-400' 
                              : 'text-slate-800 dark:text-slate-200'
                        }`}>
                          {date.getDate()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* GRID BODY */}
              <div className="flex relative">
                <div className="w-16 shrink-0 border-r border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 sticky left-0 z-20">
                  <div className="relative h-[780px]">
                    {hours.map(hour => (
                      <div 
                        key={hour} 
                        className="absolute w-full text-right pr-2 text-xs text-slate-400 font-medium font-mono" 
                        style={{ top: `${(hour - 8) * 60}px`, transform: 'translateY(-50%)' }}
                      >
                        {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
                      </div>
                    ))}
                  </div>
                </div>

                <div key={currentWeekStart.toISOString()} className="flex-1 flex border-b border-slate-200/80 dark:border-slate-800 animate-fade-in">
                  {weekDates.map((date, dayIndex) => {
                    const dateStr = getFormattedDate(date);
                    const isOutOfSchedule = !isDateWithinSchedule(dateStr);
                    const isToday = new Date().toDateString() === date.toDateString();
                    const events = getRenderEventsForDay(date, dayIndex);

                    return (
                      <div 
                        key={dayIndex} 
                        className={`flex-1 border-r border-slate-200/80 dark:border-slate-800 min-w-[120px] transition-colors relative overflow-hidden ${
                          isOutOfSchedule 
                            ? 'bg-slate-100/70 dark:bg-slate-950/70' 
                            : isToday 
                              ? 'bg-indigo-50/20 dark:bg-indigo-950/10' 
                              : 'bg-white dark:bg-slate-900'
                        }`}
                      >
                        <div className="relative h-[780px] w-full overflow-hidden">
                          {hours.map(hour => (
                            <div 
                              key={hour} 
                              onClick={() => {
                                if (!isOutOfSchedule && canEditSchedule) {
                                  handleCellClick(dateStr, dayIndex, hour);
                                }
                              }}
                              className={`absolute w-full h-[60px] border-b border-slate-100 dark:border-slate-800/80 transition-colors ${
                                isOutOfSchedule || !canEditSchedule
                                  ? 'cursor-not-allowed' 
                                  : 'hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 cursor-pointer'
                              }`}
                              style={{ top: `${(hour - 8) * 60}px` }}
                            />
                          ))}

                          {events.map((evt: any) => {
                            const top = getMinutesFromStartOfDay(evt.start_time);
                            const height = getEventDurationMinutes(evt.start_time, evt.end_time);
                            const isCancelled = evt._renderType === 'remove';

                            return (
                              <div
                                key={evt.id || `${evt.day_of_week}_${evt.start_time}`}
                                onClick={(e) => handleEventCardClick(evt, dateStr, dayIndex, e)}
                                style={{
                                  top: `${top}px`,
                                  height: `${height}px`,
                                  left: '4px',
                                  right: '4px',
                                  width: 'calc(100% - 8px)',
                                  maxWidth: 'calc(100% - 8px)',
                                  boxSizing: 'border-box'
                                }}
                                className={`absolute rounded-xl p-2 text-xs shadow-2xs transition-all duration-150 hover:scale-[1.01] active:scale-[0.98] cursor-pointer overflow-hidden flex flex-col justify-between animate-scale-in select-none box-border ${
                                  isCancelled
                                    ? 'bg-rose-50/70 dark:bg-rose-950/40 border-2 border-red-500 dark:border-red-600 shadow-red-500/10'
                                    : evt._renderType === 'change'
                                      ? 'bg-amber-50/90 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100'
                                      : evt._renderType === 'add'
                                        ? 'bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100'
                                        : 'bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800 text-indigo-950 dark:text-indigo-100'
                                }`}
                              >
                                {isCancelled && (
                                  <CancelledOverlay />
                                )}

                                <div className={`relative z-0 h-full flex flex-col justify-between pointer-events-none min-w-0 overflow-hidden w-full ${
                                  isCancelled
                                    ? 'text-slate-400 dark:text-slate-500 opacity-60'
                                    : ''
                                }`}>
                                  <div className="min-w-0 overflow-hidden">
                                    <div className={`font-bold truncate text-[11px] ${
                                      isCancelled ? 'text-slate-500 dark:text-slate-400 line-through' : ''
                                    }`}>
                                      {evt.course}
                                    </div>
                                    <div className={`text-[10px] font-mono truncate ${
                                      isCancelled ? 'text-slate-400 dark:text-slate-500' : 'opacity-75'
                                    }`}>
                                      {evt.start_time} - {evt.end_time}
                                    </div>
                                  </div>
                                  <div className={`text-[10px] font-medium truncate ${
                                    isCancelled ? 'text-slate-400 dark:text-slate-500' : 'opacity-85'
                                  }`}>
                                    {evt.room}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Add Modal for Calendar Cell */}
        {isAddModalOpen && addSlotData && canEditSchedule && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-backdrop-enter">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg border border-slate-200/80 dark:border-slate-700/80 overflow-hidden animate-modal-enter">
              <div className="p-5 border-b border-slate-100 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-indigo-600" /> Add Event to Schedule
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {days[addSlotData.dayIndex]}, {addSlotData.dateStr}
                  </p>
                </div>
                <button 
                  onClick={() => setIsAddModalOpen(false)} 
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                    Select Event Scope
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div 
                      onClick={() => setAddEventType('base')}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        addEventType === 'base'
                          ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/70 text-indigo-950 dark:text-white'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="font-bold text-xs mb-1">🔄 Base Event</div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Recurring every week on {days[addSlotData.dayIndex]}.
                      </p>
                    </div>

                    <div 
                      onClick={() => setAddEventType('exception')}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        addEventType === 'exception'
                          ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/70 text-emerald-950 dark:text-white'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="font-bold text-xs mb-1">⚡ Exception Event</div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Only on {addSlotData.dateStr}.
                      </p>
                    </div>
                  </div>
                </div>

                <Input 
                  label="Course / Subject" 
                  placeholder="e.g. Operating Systems"
                  value={eventForm.course}
                  onChange={(e: any) => setEventForm({ ...eventForm, course: e.target.value })}
                  autoFocus
                />

                <div className="grid grid-cols-2 gap-3">
                  <Input 
                    label="Start Time" 
                    type="time" 
                    value={eventForm.start_time}
                    onChange={(e: any) => setEventForm({ ...eventForm, start_time: e.target.value })}
                  />
                  <Input 
                    label="End Time" 
                    type="time" 
                    value={eventForm.end_time}
                    onChange={(e: any) => setEventForm({ ...eventForm, end_time: e.target.value })}
                  />
                </div>

                <Input 
                  label="Room" 
                  placeholder="e.g. A-201, LH-1"
                  value={eventForm.room}
                  onChange={(e: any) => setEventForm({ ...eventForm, room: e.target.value })}
                />
              </div>

              <div className="p-4 border-t border-slate-100 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveNewEvent}>
                  Save Event
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Manage Event Modal */}
        {isManageModalOpen && selectedEventData && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-backdrop-enter">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg border border-slate-200/80 dark:border-slate-700/80 overflow-hidden animate-modal-enter flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-start shrink-0">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {days[selectedEventData.dayIndex]}, {selectedEventData.dateStr}
                    </span>
                    {selectedEventData.renderItem._renderType === 'remove' ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                        ⚡ Cancelled On This Date
                      </span>
                    ) : selectedEventData.renderItem._renderType === 'change' ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                        ⚡ Date-Specific Exception
                      </span>
                    ) : selectedEventData.renderItem._renderType === 'add' ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                        ➕ Added Special Session
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900">
                        🔄 Recurring Base Event
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {canEditSchedule ? 'Manage Class / Session' : 'Class Details'}
                  </h3>
                </div>
                <button 
                  onClick={() => setIsManageModalOpen(false)} 
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                {/* 1. Exception Alert & Revert Actions */}
                {canEditSchedule && selectedEventData.renderItem._isException && (
                  <div className={`p-3.5 rounded-xl border text-xs space-y-2.5 ${
                    selectedEventData.renderItem._renderType === 'remove'
                      ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200/80 dark:border-rose-900/60 text-rose-900 dark:text-rose-200'
                      : 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-200/80 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
                  }`}>
                    <div className="flex items-start gap-2">
                      <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${
                        selectedEventData.renderItem._renderType === 'remove' ? 'text-rose-600' : 'text-amber-600'
                      }`} />
                      <div>
                        <span className="font-bold">
                          {selectedEventData.renderItem._renderType === 'remove' ? 'Class Cancelled:' : 'Active Date Exception:'}
                        </span>{' '}
                        {selectedEventData.renderItem._renderType === 'remove'
                          ? `This lecture is currently cancelled for ${selectedEventData.dateStr}. Click restore below to reactivate it.`
                          : selectedEventData.renderItem._renderType === 'change'
                          ? `This class has modified timing or room overrides for ${selectedEventData.dateStr}.`
                          : `This is a one-time added special session for ${selectedEventData.dateStr}.`}
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <Button
                        variant={selectedEventData.renderItem._renderType === 'remove' ? 'primary' : 'secondary'}
                        onClick={handleRevertSingleException}
                        className={`!text-xs !py-1.5 !px-3 ${
                          selectedEventData.renderItem._renderType === 'remove'
                            ? '!bg-emerald-600 hover:!bg-emerald-700 !text-white'
                            : '!bg-white dark:!bg-slate-800 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>
                          {selectedEventData.renderItem._renderType === 'remove'
                            ? 'Uncancel & Restore Class'
                            : selectedEventData.renderItem._renderType === 'add'
                            ? 'Delete Special Session'
                            : 'Revert Exception to Base Event'}
                        </span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* 2. Cancelled Event Summary Card */}
                {selectedEventData.renderItem._renderType === 'remove' && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          Original Course Details
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                          {selectedEventData.renderItem.course}
                        </h4>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-900">
                        Cancelled
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                      <div>
                        <span className="text-slate-400">Time:</span>{' '}
                        <strong className="text-slate-700 dark:text-slate-300">{selectedEventData.renderItem.start_time} - {selectedEventData.renderItem.end_time}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Room:</span>{' '}
                        <strong className="text-slate-700 dark:text-slate-300">{selectedEventData.renderItem.room}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Event Details Form */}
                {selectedEventData.renderItem._renderType !== 'remove' && (
                  <div className="space-y-4">
                    <Input 
                      label="Course / Subject" 
                      value={editFormData.course}
                      onChange={(e: any) => setEditFormData({ ...editFormData, course: e.target.value })}
                      disabled={!canEditSchedule}
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <Input 
                        label="Start Time" 
                        type="time" 
                        value={editFormData.start_time}
                        onChange={(e: any) => setEditFormData({ ...editFormData, start_time: e.target.value })}
                        disabled={!canEditSchedule}
                      />
                      <Input 
                        label="End Time" 
                        type="time" 
                        value={editFormData.end_time}
                        onChange={(e: any) => setEditFormData({ ...editFormData, end_time: e.target.value })}
                        disabled={!canEditSchedule}
                      />
                    </div>

                    <Input 
                      label="Room" 
                      value={editFormData.room}
                      onChange={(e: any) => setEditFormData({ ...editFormData, room: e.target.value })}
                      disabled={!canEditSchedule}
                    />

                    {canEditSchedule && (
                      <div className="pt-2 flex flex-col gap-2">
                        <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">Apply Modifications To:</div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setChangeScope('exception')}
                            className={`p-2.5 rounded-xl text-left border cursor-pointer transition-all ${
                              changeScope === 'exception'
                                ? 'bg-indigo-50 border-indigo-600 text-indigo-950 dark:bg-indigo-950/70 dark:text-white dark:border-indigo-400'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="text-xs font-bold mb-0.5">⚡ This Date Only</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{selectedEventData.dateStr}</div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setChangeScope('base')}
                            className={`p-2.5 rounded-xl text-left border cursor-pointer transition-all ${
                              changeScope === 'base'
                                ? 'bg-indigo-50 border-indigo-600 text-indigo-950 dark:bg-indigo-950/70 dark:text-white dark:border-indigo-400'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="text-xs font-bold mb-0.5">🔄 All Weeks</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">Update Base Event</div>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Danger Zone Deletion Options */}
                {canEditSchedule && selectedEventData.renderItem._baseId && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-750 space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Cancellation & Deletion Options
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedEventData.renderItem._renderType !== 'remove' && (
                        <Button
                          variant="secondary"
                          onClick={handleCancelThisDateOnly}
                          className="!text-xs !py-2 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 justify-center"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Delete / Cancel on This Date</span>
                        </Button>
                      )}

                      <Button
                        variant="danger"
                        onClick={handleDeleteBaseEventPermanently}
                        className={`!text-xs !py-2 justify-center ${selectedEventData.renderItem._renderType === 'remove' ? 'col-span-2' : ''}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Base Event (All Weeks)</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-2 shrink-0">
                <Button variant="ghost" onClick={() => setIsManageModalOpen(false)}>
                  {canEditSchedule && selectedEventData.renderItem._renderType !== 'remove' ? 'Cancel' : 'Close'}
                </Button>
                {canEditSchedule && selectedEventData.renderItem._renderType !== 'remove' && (
                  <Button onClick={handleConfirmChange}>
                    Save Changes
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // 4. MAIN SCHEDULES LIST VIEW
  // -------------------------------------------------------------
  return (
    <div className="space-y-6">
      {renderTopControls()}

      <div key={`list-${effectiveBranch}`} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-tab-enter">
        {visibleSchedules.length === 0 ? (
          <div className="col-span-full py-16 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
            <CalendarIcon className="w-10 h-10 mx-auto text-slate-400 mb-2"/>
            <p className="text-slate-500 font-medium text-xs">No schedules published for your branch yet.</p>
          </div>
        ) : (
          visibleSchedules.map((sm: ScheduleMaster) => {
            const isOwnerCR = user?.role === 'CR' && (sm.target_branch === user.branch || sm.target_branch === '-');
            return (
              <div 
                key={sm.id} 
                onClick={() => { setActiveScheduleId(sm.id); setViewMode('calendar'); }}
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-sm hover:-translate-y-0.5 active:scale-[0.99] hover:border-indigo-400 dark:hover:border-indigo-600 transition-all duration-150 cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className="px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/40 dark:border-indigo-900/40">
                      {sm.type}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded-full">
                        {sm.target_branch}
                      </span>
                      {user?.role === 'CR' && (
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          isOwnerCR 
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' 
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {isOwnerCR ? 'Manage' : 'View Only'}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {sm.title}
                  </h3>
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <CalendarIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>Valid: {sm.valid_from} to {sm.valid_until}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-3 group-hover:translate-x-1 transition-transform">
                    <span>{isOwnerCR ? 'Manage & View Timetable' : 'View Weekly Timetable'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Schedule Master Creation Modal */}
      {isSchModalOpen && user?.role === 'CR' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-backdrop-enter">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-700/80 w-full max-w-md overflow-hidden animate-modal-enter">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700/80 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-indigo-500"/> Create New Schedule
              </h3>
              <button 
                onClick={() => setIsSchModalOpen(false)} 
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <Input 
                label="Schedule Name" 
                placeholder={`e.g. ${user.branch} Semester 5 Lecture Schedule`}
                value={schForm.title}
                onChange={(e: any) => setSchForm({ ...schForm, title: e.target.value })}
                autoFocus
              />

              <Select 
                label="Schedule Type" 
                value={schForm.type}
                onChange={(e: any) => setSchForm({ ...schForm, type: e.target.value })}
              >
                <option value="Lecture Schedule">Lecture Schedule</option>
                <option value="Exam Schedule">Exam Schedule</option>
              </Select>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Target Branch
                </label>
                <div className="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>{user.branch}</span>
                  <span className="text-[10px] font-normal text-slate-400">Locked to your branch</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input 
                  label="Valid From" 
                  type="date"
                  value={schForm.valid_from}
                  onChange={(e: any) => setSchForm({ ...schForm, valid_from: e.target.value })}
                />
                <Input 
                  label="Valid Until" 
                  type="date"
                  value={schForm.valid_until}
                  onChange={(e: any) => setSchForm({ ...schForm, valid_until: e.target.value })}
                />
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 dark:border-slate-700/80 flex justify-end gap-2 bg-slate-50/50 dark:bg-slate-900/50">
              <Button variant="ghost" onClick={() => setIsSchModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateScheduleMaster}>
                Create Schedule
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

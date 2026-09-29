import React, { useMemo, useState } from 'react';
import { 
  Calendar as CalendarIcon, Clock, MapPin, 
  GraduationCap, Bell, FolderKanban, BookOpen, 
  ChevronRight, ArrowUpRight, X
} from 'lucide-react';
import { useAuth, useData, useRouter } from '../context/AppContext';
import { ScheduleMaster, ExamItem, Branch } from '../types';
import { Button, UserNameWithTag } from './UI';
import { DatabaseLoader } from './DatabaseLoader';

const GREETING_VARIANTS = [
  (node: React.ReactNode) => <>Welcome back, {node}!</>,
  (node: React.ReactNode) => <>Good to see you, {node}!</>,
  (node: React.ReactNode) => <>Hello again, {node}!</>,
  (node: React.ReactNode) => <>Ready for today, {node}?</>,
  (node: React.ReactNode) => <>Hey there, {node}!</>,
  (node: React.ReactNode) => <>Glad you're back, {node}!</>,
  (node: React.ReactNode) => <>Hope your day is going great, {node}!</>,
  (node: React.ReactNode) => <>Let's make today productive, {node}!</>,
  (node: React.ReactNode) => <>Great to have you here, {node}!</>,
  (node: React.ReactNode) => <>What's on the agenda today, {node}?</>,
  (node: React.ReactNode) => <>Wishing you a focused day, {node}!</>,
  (node: React.ReactNode) => <>All set for your classes, {node}?</>,
  (node: React.ReactNode) => <>Welcome to your campus hub, {node}!</>,
  (node: React.ReactNode) => <>Good to have you back on IRIS, {node}!</>,
  (node: React.ReactNode) => <>Here's your day at a glance, {node}!</>,
  (node: React.ReactNode) => <>Stay curious and keep building, {node}!</>,
  (node: React.ReactNode) => <>Ready to tackle the semester, {node}?</>,
  (node: React.ReactNode) => <>Greetings, {node}!</>,
];

export const Dashboard = () => {
  const { user } = useAuth();
  const { 
    schedules, baseEvents, exceptionEvents, 
    exams, announcements, courses, enrollments,
    isAirtableLoading, loadingTabPath
  } = useData();
  const { navigate } = useRouter();

  const [selectedExamDetails, setSelectedExamDetails] = useState<ExamItem | null>(null);

  // Pick a greeting variant on mount (and allow cycling on click for a delightful touch)
  const [greetingIndex, setGreetingIndex] = useState<number>(() =>
    Math.floor(Math.random() * GREETING_VARIANTS.length)
  );

  const effectiveBranch: Branch = (user?.branch && user.branch !== '-') ? user.branch : 'CS';

  // 1. Current Date String Formatter
  const today = useMemo(() => new Date(), []);
  const todayDateStr = useMemo(() => {
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [today]);

  const formattedTodayLong = useMemo(() => {
    return today.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }, [today]);

  // Helper: Days remaining calculation
  const getDaysRemaining = (dateStr: string) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(dateStr + 'T00:00:00');
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // 2. Today's Schedule Summary computation
  const todayClasses = useMemo(() => {
    const todayDayOfWeek = today.getDay();

    const branchSchedules = schedules.filter((s: ScheduleMaster) => {
      return s.target_branch === effectiveBranch || s.target_branch === '-';
    });

    const results: Array<{
      id: string;
      scheduleTitle: string;
      course: string;
      room: string;
      start_time: string;
      end_time: string;
      type: 'regular' | 'changed' | 'added' | 'cancelled';
      notes?: string;
    }> = [];

    branchSchedules.forEach(sch => {
      const isWithin = todayDateStr >= sch.valid_from && todayDateStr <= sch.valid_until;
      if (!isWithin) return;

      const dayBases = baseEvents.filter(b => b.schedule_id === sch.id && b.day_of_week === todayDayOfWeek);
      const dateExceptions = exceptionEvents.filter(e => e.schedule_id === sch.id && e.date === todayDateStr);

      dayBases.forEach(base => {
        const ex = dateExceptions.find(e => e.base_event_id === base.id);
        if (ex) {
          if (ex.type === 'remove') {
            results.push({
              id: ex.id || base.id,
              scheduleTitle: sch.title,
              course: base.course,
              room: base.room,
              start_time: base.start_time,
              end_time: base.end_time,
              type: 'cancelled',
              notes: 'Cancelled for today'
            });
            return;
          } else if (ex.type === 'change') {
            results.push({
              id: ex.id,
              scheduleTitle: sch.title,
              course: ex.course || base.course,
              room: ex.room || base.room,
              start_time: ex.start_time || base.start_time,
              end_time: ex.end_time || base.end_time,
              type: 'changed',
              notes: 'Changed timing/venue for today'
            });
          }
        } else {
          results.push({
            id: base.id,
            scheduleTitle: sch.title,
            course: base.course,
            room: base.room,
            start_time: base.start_time,
            end_time: base.end_time,
            type: 'regular'
          });
        }
      });

      dateExceptions.filter(e => e.type === 'add').forEach(addEx => {
        results.push({
          id: addEx.id,
          scheduleTitle: sch.title,
          course: addEx.course || 'Special Lecture',
          room: addEx.room || 'TBD',
          start_time: addEx.start_time || '10:00',
          end_time: addEx.end_time || '11:00',
          type: 'added',
          notes: 'Special added session for today'
        });
      });
    });

    return results.sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [schedules, baseEvents, exceptionEvents, effectiveBranch, today, todayDateStr]);

  // 3. Upcoming Exams within 15 Days (remaining days <= 15 and >= 0)
  const upcomingExams = useMemo(() => {
    return exams
      .filter(ex => {
        const branchMatch = ex.target_branch === effectiveBranch || ex.target_branch === 'All' || ex.target_branch === '-';
        if (!branchMatch) return false;
        const daysLeft = getDaysRemaining(ex.date);
        return daysLeft >= 0 && daysLeft <= 15;
      })
      .map(ex => ({
        ...ex,
        daysLeft: getDaysRemaining(ex.date)
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [exams, effectiveBranch]);

  // Quick Stats Count
  const userEnrolledCount = useMemo(() => {
    if (!user) return 0;
    const userEns = enrollments.filter(e => e.user_id === user.id && e.status === 'Active');
    if (userEns.length > 0) return userEns.length;
    return courses.filter(c => c.branch === effectiveBranch || c.branch === 'All').length;
  }, [user, enrollments, courses, effectiveBranch]);

  const recentAnnouncementsCount = useMemo(() => {
    return announcements.filter(a => a.target === effectiveBranch || a.target === 'All' || a.target === user?.hostel).length;
  }, [announcements, effectiveBranch, user]);

  const renderGreeting = GREETING_VARIANTS[greetingIndex % GREETING_VARIANTS.length];
  const userFirstName = useMemo(() => {
    if (!user) return 'Student';
    if (user.firstName && user.firstName.trim()) {
      return user.firstName.trim().split(/\s+/)[0];
    }
    return user.name.trim().split(/\s+/)[0] || 'Student';
  }, [user]);

  if (loadingTabPath === '/dashboard' || (isAirtableLoading && schedules.length === 0 && courses.length === 0 && announcements.length === 0)) {
    return (
      <div className="space-y-6 select-none animate-fade-in">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-indigo-100/80 dark:border-slate-800 p-8 shadow-2xs">
          <DatabaseLoader 
            type="dashboard_workspace" 
            resourceName="Academic Workspace"
            message="Querying today's schedule, enrolled courses, and announcements from database..."
            variant="panel"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none">
      {/* 1. Header Overview & Greeting (with greeting variants & CR/HR tag) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-indigo-100/80 dark:border-slate-800 p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {formattedTodayLong}
              </span>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-900/50">
                {effectiveBranch} • {user?.admissionYear || 2026} Batch
              </span>
              {user?.rollNo && (
                <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                  {user.rollNo}
                </span>
              )}
            </div>
            <h1 
              onClick={() => setGreetingIndex(prev => (prev + 1) % GREETING_VARIANTS.length)}
              className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight inline-flex flex-wrap items-center gap-2 cursor-pointer active:scale-[0.99] transition-transform"
              title="Click for another greeting"
            >
              <span key={greetingIndex} className="inline-flex flex-wrap items-center gap-2 animate-tab-enter">
                {renderGreeting(
                  <UserNameWithTag 
                    user={user} 
                    name={userFirstName}
                    tagClassName="text-xs px-2 py-0.5 font-semibold bg-indigo-50/90 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-800/60" 
                  />
                )}
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Here is your daily academic briefing, upcoming exams, and quick access portals.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Main Dashboard Split: Today's Schedule & Upcoming Exams */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Widget: Today's Schedule Summary */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-indigo-100/80 dark:border-slate-800 p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Today's Schedule Summary
                  </h2>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Scheduled lectures & lab sessions
                  </p>
                </div>
              </div>

              {/* Today's Classes Counter in Top Right */}
              <div className="px-3 py-1.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/50 dark:border-indigo-900/50 flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-semibold text-indigo-600/90 dark:text-indigo-400 uppercase tracking-wider">
                  Today's Classes
                </span>
                <span className="text-sm font-extrabold font-mono tabular-nums text-indigo-700 dark:text-indigo-300">
                  {todayClasses.length}
                </span>
              </div>
            </div>

            {/* Schedule List */}
            <div className="pt-4">
              {todayClasses.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/40 dark:bg-slate-900/30">
                  <CalendarIcon className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    No scheduled lectures or labs today
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    You have no active class slots scheduled for {formattedTodayLong}.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {todayClasses.map((item, idx) => {
                    const isItemCancelled = item.type === 'cancelled';
                    return (
                      <div
                        key={item.id + idx}
                        className={`p-3 rounded-xl transition-all flex items-center justify-between gap-3 relative overflow-hidden ${
                          isItemCancelled
                            ? 'border-2 border-red-600 dark:border-red-500 bg-rose-50/80 dark:bg-rose-950/40 text-rose-950 dark:text-rose-100 shadow-red-500/10'
                            : 'border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-indigo-50/30 dark:hover:bg-slate-800'
                        }`}
                      >
                        {isItemCancelled && (
                          <>
                            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" preserveAspectRatio="none" viewBox="0 0 100 100">
                              <line x1="0" y1="100" x2="100" y2="0" stroke="#dc2626" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 overflow-hidden">
                              <div className="transform -rotate-6 sm:-rotate-12 flex items-center justify-center">
                                <span className="text-[11px] sm:text-xs font-black tracking-widest text-red-600 dark:text-red-400 bg-white/95 dark:bg-slate-900/95 px-2.5 py-0.5 rounded border border-red-500 shadow-xs font-mono uppercase select-none">
                                  CANCELLED
                                </span>
                              </div>
                            </div>
                          </>
                        )}

                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`px-2 py-1 text-[11px] font-mono font-bold rounded-lg border shrink-0 tabular-nums ${
                            isItemCancelled
                              ? 'text-red-700 dark:text-red-300 bg-red-100/60 dark:bg-red-950/60 border-red-300 dark:border-red-800'
                              : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200/50 dark:border-indigo-900/50'
                          }`}>
                            {item.start_time} - {item.end_time}
                          </span>

                          <div className="min-w-0">
                            <h4 className={`text-xs font-bold truncate ${
                              isItemCancelled ? 'text-slate-500 dark:text-slate-400 line-through' : 'text-slate-900 dark:text-slate-100'
                            }`}>
                              {item.course}
                            </h4>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span>Room: {item.room}</span>
                            </p>
                          </div>
                        </div>

                        {item.type === 'cancelled' ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-100/80 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-900 shrink-0">
                            Cancelled
                          </span>
                        ) : item.type === 'changed' ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/60 shrink-0">
                            Rescheduled
                          </span>
                        ) : item.type === 'added' ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/60 shrink-0">
                            Special Session
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <Button 
              variant="secondary" 
              onClick={() => navigate('/schedules', 'today_summary')} 
              className="!text-xs !py-1.5 !px-3 w-full sm:w-auto"
            >
              <span>Today's Timeline</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Right Widget: Upcoming Exams (Remaining Days <= 15) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-purple-100/80 dark:border-slate-800 p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Upcoming Exams
                  </h2>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Examinations within the next 15 days
                  </p>
                </div>
              </div>

              {/* Upcoming Exams Counter in Top Right */}
              <div className="px-3 py-1.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200/50 dark:border-purple-900/50 flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-semibold text-purple-600/90 dark:text-purple-400 uppercase tracking-wider">
                  Exams (≤15d)
                </span>
                <span className="text-sm font-extrabold font-mono tabular-nums text-purple-700 dark:text-purple-300">
                  {upcomingExams.length}
                </span>
              </div>
            </div>

            {/* Exam List */}
            <div className="pt-4">
              {upcomingExams.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/40 dark:bg-slate-900/30">
                  <GraduationCap className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    No exams in the next 15 days
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Check the full exam schedule for mid-terms and end-sems later in the term.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {upcomingExams.map((ex) => {
                    const examDateObj = new Date(ex.date + 'T00:00:00');
                    const formattedDate = examDateObj.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    });

                    return (
                      <div
                        key={ex.id}
                        onClick={() => setSelectedExamDetails(ex)}
                        className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50/20 dark:hover:bg-slate-800 transition-all cursor-pointer flex items-center justify-between gap-3 group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="px-2 py-1 text-xs font-mono font-bold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50 shrink-0">
                            {ex.course_code}
                          </span>

                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                              {ex.exam_name}
                            </h4>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1.5 truncate">
                              <span>{formattedDate}</span>
                              {ex.time && <span>• {ex.time}</span>}
                              {ex.venue && <span>• {ex.venue}</span>}
                            </p>
                          </div>
                        </div>

                        {/* Days Remaining Badge */}
                        <div className="shrink-0 flex items-center gap-2">
                          <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border tabular-nums ${
                            ex.daysLeft === 0
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-900'
                              : ex.daysLeft <= 3
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900'
                              : 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200/60 dark:border-purple-900/60'
                          }`}>
                            {ex.daysLeft === 0 ? 'Today' : ex.daysLeft === 1 ? 'Tomorrow' : `In ${ex.daysLeft} days`}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <Button 
              variant="secondary" 
              onClick={() => navigate('/schedules', 'exam_schedule')} 
              className="!text-xs !py-1.5 !px-3 w-full sm:w-auto"
            >
              <span>Exam Timeline</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* 3. Quick Action Navigation Cards Grid (No "QUICK PORTALS & NAVIGATION" header) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Schedules (Purple tint) */}
        <div
          onClick={() => navigate('/schedules')}
          className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-sm hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
              Schedules & Timetable
            </h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Weekly master lecture schedule, lab slots and exam calendar.
            </p>
          </div>
        </div>

        {/* Card 2: Announcements (Bell Yellow tint) */}
        <div
          onClick={() => navigate('/announcements')}
          className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-sm hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <Bell className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
              Announcements
            </h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Academic circulars, hostel notices and official updates ({recentAnnouncementsCount} active).
            </p>
          </div>
        </div>

        {/* Card 3: Curriculum (Light Red tint) */}
        <div
          onClick={() => navigate('/curriculum')}
          className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-rose-300 dark:hover:border-rose-700 hover:shadow-sm hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
              Curriculum & Courses
            </h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Enrolled courses ({userEnrolledCount} active), segment mapping and instructor details.
            </p>
          </div>
        </div>

        {/* Card 4: Resources (File Explorer Yellow tint) */}
        <div
          onClick={() => navigate('/resources')}
          className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-yellow-300 dark:hover:border-yellow-700 hover:shadow-sm hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-yellow-50 dark:bg-yellow-950/50 text-yellow-600 dark:text-yellow-400">
              <FolderKanban className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-yellow-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">
              Educational Resources
            </h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Study notes, past question papers, lab manual codes and markdown docs.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Exam Inspection Modal */}
      {selectedExamDetails && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-backdrop-enter">
          <div className="bg-white dark:bg-slate-850 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-750 w-full max-w-lg p-6 space-y-4 animate-modal-enter">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-750 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50">
                    {selectedExamDetails.course_code}
                  </span>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200/50 dark:border-purple-900/50">
                    {selectedExamDetails.exam_name}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {selectedExamDetails.course_name || selectedExamDetails.course_code}
                </h3>
              </div>
              <button
                onClick={() => setSelectedExamDetails(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Date:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {new Date(selectedExamDetails.date + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Timing:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {selectedExamDetails.time || 'To be announced (TBA)'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Venue / Room:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {selectedExamDetails.venue || 'To be announced (TBA)'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Target Branch:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {selectedExamDetails.target_branch}
                  </span>
                </div>
              </div>

              {selectedExamDetails.notes && (
                <div className="p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-100/60 dark:border-purple-900/40 text-purple-900 dark:text-purple-200">
                  <strong>Notes / Instructions:</strong> {selectedExamDetails.notes}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-750">
              <Button variant="secondary" onClick={() => setSelectedExamDetails(null)} className="!text-xs">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

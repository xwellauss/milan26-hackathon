import React, { useState, useMemo, useEffect } from 'react';
import { 
  GraduationCap, BookOpen, User as UserIcon, Mail, MapPin, 
  Search, CheckCircle2, Clock, 
  ExternalLink, Building2, Copy, Check, ChevronRight, X, Layers
} from 'lucide-react';
import { useAuth, useData } from '../context/AppContext';
import { Course, Instructor } from '../types';
import { Button, HighlightText } from './UI';
import { DatabaseLoader } from './DatabaseLoader';

export const Curriculum = () => {
  const { user } = useAuth();
  const { courses, enrollments, isAirtableLoading, loadingTabPath } = useData();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // Close modal on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedCourse) {
        setSelectedCourse(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCourse]);

  // Compute active courses for the current user
  const activeUserCourses = useMemo(() => {
    if (!user) return [];

    const userEnrollments = enrollments.filter(
      en => en.user_id === user.id && en.status === 'Active'
    );

    const enrolledCourseIds = new Set(userEnrollments.map(en => en.course_id));

    if (enrolledCourseIds.size === 0) {
      courses.forEach(c => {
        if (c.branch === user.branch || c.branch === 'All') {
          enrolledCourseIds.add(c.id);
        }
      });
    }

    let userCoursesList = courses.filter(c => enrolledCourseIds.has(c.id));

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      userCoursesList = userCoursesList.filter(c => 
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        `segment ${c.segment_start}-${c.segment_end}`.toLowerCase().includes(q) ||
        `seg ${c.segment_start}-${c.segment_end}`.toLowerCase().includes(q)
      );
    }

    return userCoursesList;
  }, [user, courses, enrollments, searchQuery]);

  // Summary Metrics
  const totalCredits = useMemo(() => {
    return activeUserCourses.reduce((acc, c) => acc + c.credits, 0);
  }, [activeUserCourses]);

  const copyEmailToClipboard = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const formatSegment = (start: number, end: number) => {
    if (start === end) return `Segment ${start}`;
    return `Segments ${start}–${end}`;
  };

  return (
    <div className="space-y-5 select-none animate-fade-in">
      {/* 1. Header Overview Card (Light Red / Rose Base Tint) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-200/70 dark:border-slate-800 p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200/60 dark:border-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0 shadow-2xs">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Curriculum
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-900/50 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Enrolled & Active</span>
                </span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Active registered courses for <strong>Autumn Semester 2026</strong>. Click any course to inspect full details and instructors.
              </p>
            </div>
          </div>

          {/* Quick Stat Badges */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-center min-w-[100px]">
              <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Active Courses
              </div>
              <div className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                {activeUserCourses.length}
              </div>
            </div>

            <div className="px-4 py-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 text-center min-w-[100px]">
              <div className="text-[11px] font-semibold text-rose-600/90 dark:text-rose-400 uppercase tracking-wider">
                Total Credits
              </div>
              <div className="text-lg font-extrabold text-rose-700 dark:text-rose-300">
                {totalCredits.toFixed(1)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Active Courses Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-200/60 dark:border-slate-800 p-6 shadow-2xs space-y-4">
        {/* Section Header & Search */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-rose-500" />
              <span>Active Courses</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-rose-50 dark:bg-slate-800 text-rose-700 dark:text-rose-300 border border-rose-200/50 dark:border-slate-700">
                {activeUserCourses.length}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select a course to view faculty, venue, and syllabus information
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search course code or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8.5 pr-4 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400"
            />
          </div>
        </div>

        {/* Course Summary List Elements */}
        {(loadingTabPath === '/curriculum' || (isAirtableLoading && courses.length === 0)) ? (
          <div className="py-6">
            <DatabaseLoader 
              type="curriculum_courses" 
              resourceName="Curriculum & Courses"
              message="Fetching enrolled courses, faculty instructors, and syllabus data from database..."
              variant="panel"
            />
          </div>
        ) : activeUserCourses.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/40 dark:bg-slate-900/30 animate-tab-enter">
            <BookOpen className="w-8 h-8 mx-auto text-slate-400 mb-2" />
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {searchQuery ? 'No courses match your search criteria.' : 'No active course enrollments found.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 rounded-xl border border-rose-100/80 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
            {activeUserCourses.map((course: Course) => (
              <div
                key={course.id}
                onClick={() => setSelectedCourse(course)}
                className="group p-3.5 sm:px-4 sm:py-3 hover:bg-rose-50/35 dark:hover:bg-slate-800/60 active:scale-[0.99] transition-all duration-150 cursor-pointer flex items-center justify-between gap-4"
              >
                {/* Course Summary: Name, Course Code, Segment */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/50 shrink-0 transition-transform duration-150 group-hover:scale-105">
                    <HighlightText text={course.code} query={searchQuery} />
                  </span>

                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                      <HighlightText text={course.name} query={searchQuery} />
                    </h3>
                  </div>
                </div>

                {/* Segment & Chevron */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="px-2.5 py-0.5 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                    {formatSegment(course.segment_start, course.segment_end)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-rose-500 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Detailed Course Inspection Modal */}
      {selectedCourse && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in"
          onClick={() => setSelectedCourse(null)}
        >
          <div
            className="bg-white dark:bg-slate-850 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-700/80 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-750 flex items-start justify-between gap-4 bg-rose-50/40 dark:bg-slate-900/60 shrink-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/50">
                    {selectedCourse.code}
                  </span>
                  <span className="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-rose-50/80 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200/50 dark:border-rose-800/50">
                    {formatSegment(selectedCourse.segment_start, selectedCourse.segment_end)}
                  </span>
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-md border ${
                    selectedCourse.type === 'Core'
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200/50 dark:border-blue-900/50'
                      : selectedCourse.type === 'Department Elective'
                      ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200/50 dark:border-purple-900/50'
                      : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200/50 dark:border-amber-900/50'
                  }`}>
                    {selectedCourse.type}
                  </span>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {selectedCourse.credits} Credits
                  </span>
                </div>

                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">
                  {selectedCourse.name}
                </h2>
              </div>

              <button
                onClick={() => setSelectedCourse(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-750 cursor-pointer shrink-0"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1 select-text">
              {/* Schedule, Venue & Segment Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Clock className="w-4 h-4 text-rose-500 shrink-0" />
                  <span><strong>Schedule:</strong> {selectedCourse.slot}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                  <span><strong>Venue:</strong> {selectedCourse.venue}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 sm:col-span-2">
                  <Layers className="w-4 h-4 text-rose-500 shrink-0" />
                  <span><strong>Segment Coverage:</strong> {formatSegment(selectedCourse.segment_start, selectedCourse.segment_end)} (Autumn 2026)</span>
                </div>
              </div>

              {/* Course Description */}
              {selectedCourse.description && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                    Course Description
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50/50 dark:bg-slate-900/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    {selectedCourse.description}
                  </p>
                </div>
              )}

              {/* Course Instructors */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5 flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-rose-500" />
                  <span>Course Instructor{selectedCourse.instructors.length > 1 ? 's' : ''}</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedCourse.instructors.map((inst: Instructor) => (
                    <div
                      key={inst.email}
                      className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-750 flex flex-col justify-between gap-2.5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-slate-700 text-rose-700 dark:text-rose-300 flex items-center justify-center font-bold text-xs shrink-0 border border-rose-200/60 dark:border-slate-600">
                          {inst.name.split(' ').slice(-1)[0].charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {inst.name}
                          </h5>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {inst.designation}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            {inst.department}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50 text-[11px] text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{inst.office}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <a
                            href={`mailto:${inst.email}`}
                            className="text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
                          >
                            <Mail className="w-3 h-3" />
                            <span>{inst.email}</span>
                          </a>
                          <button
                            onClick={() => copyEmailToClipboard(inst.email)}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded cursor-pointer"
                            title="Copy email"
                          >
                            {copiedEmail === inst.email ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Teaching Assistants */}
              {selectedCourse.teaching_assistants && selectedCourse.teaching_assistants.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                    Teaching Assistants
                  </h4>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedCourse.teaching_assistants.map((ta, idx) => (
                      <span key={idx} className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                        {ta}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Moodle Link if present */}
              {selectedCourse.moodle_link && (
                <div className="pt-1">
                  <a
                    href={selectedCourse.moodle_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                  >
                    <span>Open Moodle LMS Course Page</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-750 flex items-center justify-end bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
              <Button variant="secondary" onClick={() => setSelectedCourse(null)} className="!text-xs !py-1.5">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

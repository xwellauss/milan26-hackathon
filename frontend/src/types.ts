export type Role = 'Normal Student' | 'CR' | 'HR';
export type Branch = 'CS' | 'EE' | 'MnC' | 'AI' | 'ME' | 'CE' | 'BT' | '-';
export type HostelName = 'Vivekananda' | 'S.N. Bose' | 'Kalpana Chawla';
export type Tag = 'URGENT' | 'IMPORTANT' | 'INFO' | 'EXAM' | 'LECTURE';
export type ThreadTag = 'Academic' | 'Announcement Discussion' | 'TimePass';

export interface HostelInfo {
  id: string;
  name: HostelName;
  code: string;
  warden_name: string;
  warden_email: string;
  hr_id: string;
  hr_name?: string;
  hr_email?: string;
  hr_rollNo?: string;
}

export interface User {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  password?: string;
  rollNo: string;
  admissionYear: number;
  role: Role;
  branch: Branch;
  hostel: string;
  avatarUrl?: string;
}

export interface CRTableEntry {
  email: string;
  branch: Branch;
}

export interface HRTableEntry {
  email: string;
  hostel: string;
}

export interface Announcement {
  id: string;
  author_id: string;
  author_name: string;
  type: 'academic' | 'hostel';
  target: string;
  content: string;
  date_time: number;
  tags: Tag[];
}

export interface Reply {
  id: string;
  target_id: string;
  author_id: string;
  author_name: string;
  content: string;
  created_at: number;
  is_deleted: boolean;
}

export interface Thread {
  id: string;
  author_id: string;
  author_name: string;
  title: string;
  created_at: number;
  tags: ThreadTag[];
  linked_resource?: {
    type: 'announcement' | 'schedule';
    id: string;
  } | null;
  visibility_branch?: Branch | 'public';
  visibility_hostel?: string | 'public';
}

export interface ScheduleMaster {
  id: string;
  title: string;
  type: 'Lecture Schedule' | 'Exam Schedule';
  target_branch: Branch;
  valid_from: string; // YYYY-MM-DD
  valid_until: string; // YYYY-MM-DD
}

export interface BaseEvent {
  id: string;
  schedule_id: string;
  course: string;
  day_of_week: number; // 0 (Sun) - 6 (Sat)
  start_time: string; // "HH:MM" 24h
  end_time: string; // "HH:MM" 24h
  room: string;
}

export interface ExceptionEvent {
  id: string;
  schedule_id: string;
  base_event_id: string | null; // null if standalone 'add'
  date: string; // YYYY-MM-DD
  type: 'add' | 'change' | 'remove';
  course?: string;
  start_time?: string;
  end_time?: string;
  room?: string;
}

export interface ExamItem {
  id: string;
  date: string; // YYYY-MM-DD
  time: string | null; // e.g. "09:30 - 12:30", "14:30 - 17:30", or null
  course_code: string; // e.g. "CS3020"
  course_name?: string; // e.g. "Operating Systems"
  exam_name: string; // e.g. "Mid-Semester Exam", "End-Semester Exam", "Quiz 1", "Practical Lab Exam"
  venue: string | null; // e.g. "Academic Block A - LH-101", "Lab 2", or null
  target_branch: Branch | 'All';
  slot?: string | null; // e.g. "Slot A"
  notes?: string | null;
}

export interface ResourceFolder {
  id: string;
  name: string;
  parent_id: string | null; // null for top-level root folders
  branch: Branch;
  created_at: number;
  created_by: string; // author name
}

export interface ResourceItem {
  id: string;
  name: string; // e.g. "OS_Process_Synchronization.md"
  folder_id: string | null; // null if in branch root, or folder id
  branch: Branch;
  size: string; // e.g. "245 KB", "1.4 MB"
  type: 'md' | 'pdf' | 'code' | 'doc' | 'archive' | 'other';
  content?: string; // Markdown or text contents for viewing/rendering and downloading
  download_url?: string;
  description?: string;
  uploaded_at: number;
  uploaded_by: string;
}

export interface Instructor {
  name: string;
  email: string;
  designation: string; // e.g. "Associate Professor", "Professor", "Assistant Professor"
  department: string;
  office: string; // e.g. "Academic Block C, Room 412"
}

export interface Course {
  id: string;
  code: string; // e.g. "CS3020"
  name: string; // e.g. "Operating Systems"
  credits: number; // e.g. 3
  semester: string; // e.g. "Autumn 2026 (Sem 5)"
  segment_start: number; // 1 to 6
  segment_end: number; // 1 to 6
  type: 'Core' | 'Department Elective' | 'Free Elective' | 'Institute Core';
  branch: Branch | 'All';
  slot: string; // e.g. "Slot A"
  venue: string; // e.g. "Academic Block A - LH-101"
  instructors: Instructor[];
  teaching_assistants?: string[];
  description?: string;
  moodle_link?: string;
}

export interface Enrollment {
  id: string;
  user_id: string; // user id or email
  course_id: string;
  semester: string;
  status: 'Active' | 'Completed' | 'Dropped';
  enrolled_date: string;
}


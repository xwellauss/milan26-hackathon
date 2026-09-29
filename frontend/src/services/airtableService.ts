import {
  User, Announcement, Reply, Thread, ScheduleMaster,
  BaseEvent, ExceptionEvent, ExamItem, ResourceFolder, ResourceItem,
  Course, Enrollment, Tag, ThreadTag, Branch, Role, Instructor
} from '../types';
import { inferUserDetailsFromEmail } from '../utils/institute';

export interface AirtableStatus {
  connected: boolean;
  baseId: string;
  status: 'connected' | 'permission_denied' | 'error' | 'syncing' | 'loading' | 'network_error';
  statusCode?: number;
  message?: string;
  lastSyncedAt?: number;
}

const DEFAULT_BASE_ID = 'appgHPiab7ZyPFj9d';
const DEFAULT_TOKEN = 'patgVaWQpRAOkDEwi.787a9f6e60e476ff3bc7aa9587df2323092bac7df5ac0ce68bedd75560a5a8b6';

const getBaseId = (): string => {
  return (import.meta as any).env?.VITE_AIRTABLE_BASE_ID || DEFAULT_BASE_ID;
};

const getToken = (): string => {
  return (import.meta as any).env?.VITE_AIRTABLE_TOKEN || DEFAULT_TOKEN;
};

const TABLE_NAMES = [
  'INITIAL_ANNOUNCEMENTS',
  'INITIAL_THREADS',
  'INITIAL_REPLIES',
  'INITIAL_SCHEDULES',
  'INITIAL_BASE_EVENTS',
  'INITIAL_EXCEPTIONS',
  'INITIAL_EXAMS',
  'INITIAL_FOLDERS',
  'INITIAL_RESOURCES',
  'INITIAL_COURSES',
  'INITIAL_ENROLLMENTS'
];

// Global record ID mapping: entityId -> airtableRecId
const recordIdMap = new Map<string, string>();

export const getAirtableRecordId = (entityId: string): string | undefined => {
  return recordIdMap.get(entityId);
};

export const setAirtableRecordId = (entityId: string, airtableId: string): void => {
  recordIdMap.set(entityId, airtableId);
};

// Safe date/number parser helper
const parseTimestamp = (val: any, fallback = Date.now()): number => {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.includes('Date.now()')) {
      const match = trimmed.match(/Date\.now\(\)\s*([+-])\s*(\d+)/);
      if (match) {
        const sign = match[1] === '-' ? -1 : 1;
        const diff = parseInt(match[2], 10);
        return Date.now() + sign * diff;
      }
      return Date.now();
    }
    const num = Number(trimmed);
    if (!isNaN(num) && num > 1000000) return num;
    const parsedDate = Date.parse(trimmed);
    if (!isNaN(parsedDate)) return parsedDate;
  }
  return fallback;
};

// Safe exception date parser (handles 'This Monday', 'This Wednesday', or ISO dates)
const parseExceptionDate = (val: any): string => {
  if (!val || val === 'N/A' || val === 'null') return new Date().toISOString().split('T')[0];
  const str = String(val).trim();
  const lower = str.toLowerCase();
  const today = new Date();
  const currentDay = today.getDay(); // 0 = Sun
  const dayOfWeek = currentDay === 0 ? 7 : currentDay;
  if (lower.includes('this monday') || lower === 'monday') {
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek + 1);
    return monday.toISOString().split('T')[0];
  }
  if (lower.includes('this wednesday') || lower === 'wednesday') {
    const wed = new Date(today);
    wed.setDate(today.getDate() - dayOfWeek + 3);
    return wed.toISOString().split('T')[0];
  }
  return str;
};

// Parse tags from either string "EXAM, URGENT" or array
const parseTags = (val: any): Tag[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val as Tag[];
  if (typeof val === 'string') {
    return val
      .split(',')
      .map(t => t.trim().toUpperCase())
      .filter(Boolean) as Tag[];
  }
  return [];
};

// Parse thread tags
const parseThreadTags = (val: any): ThreadTag[] => {
  if (!val) return ['Academic'];
  if (Array.isArray(val)) return val as ThreadTag[];
  if (typeof val === 'string') {
    return val
      .split(',')
      .map(t => t.trim())
      .filter(Boolean) as ThreadTag[];
  }
  return ['Academic'];
};

// Parse linked resource
const parseLinkedResource = (val: any): { type: 'announcement' | 'schedule'; id: string } | null => {
  if (!val || val === 'null' || val === 'None') return null;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return null;
    }
  }
  return null;
};

// Parse instructors
const parseInstructors = (val: any, defaultBranch: Branch = 'CS'): Instructor[] => {
  if (!val || val === 'None' || val === 'null') return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    return val.split(';').map(part => {
      const name = part.trim();
      return {
        name,
        email: `${name.toLowerCase().replace(/[^a-z]/g, '')}@iith.ac.in`,
        designation: 'Faculty',
        department: defaultBranch,
        office: 'Academic Block'
      };
    });
  }
  return [];
};

// Parse teaching assistants
const parseTeachingAssistants = (val: any): string[] => {
  if (!val || val === 'None' || val === 'null') return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    return val.split(';').map(t => t.trim()).filter(Boolean);
  }
  return [];
};

// Direct client-side Airtable REST API requester (for Netlify/static hosting)
async function directAirtableApiRequest(
  endpoint: string,
  method: string = 'GET',
  body?: any,
  retries: number = 2
): Promise<{ status: number; data: any }> {
  const baseId = getBaseId();
  const token = getToken();
  const url = `https://api.airtable.com/v0/${baseId}${endpoint}`;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (response.status === 429 && retries > 0) {
      await new Promise(r => setTimeout(r, 750));
      return directAirtableApiRequest(endpoint, method, body, retries - 1);
    }

    let data;
    try {
      data = await response.json();
    } catch {
      data = { error: { message: 'Invalid JSON response from Airtable API' } };
    }

    return { status: response.status, data };
  } catch (err: any) {
    return { status: 500, data: { error: { message: err.message || 'Network error connecting to Airtable' } } };
  }
}

// Fetch all records for a table directly from Airtable API (with pagination)
async function directFetchAllTableRecords(tableName: string): Promise<{ success: boolean; records?: any[]; error?: any; status: number }> {
  let allRecords: any[] = [];
  let offset: string | undefined = undefined;

  do {
    const query = offset ? `?offset=${encodeURIComponent(offset)}` : '';
    const res = await directAirtableApiRequest(`/${encodeURIComponent(tableName)}${query}`, 'GET');
    
    if (res.status >= 400) {
      return { success: false, error: res.data, status: res.status };
    }

    if (res.data?.records) {
      allRecords = allRecords.concat(res.data.records);
    }
    offset = res.data?.offset;
  } while (offset);

  return { success: true, records: allRecords, status: 200 };
}

// Find Airtable rec ID directly by entity ID
async function directFindRecordIdByEntityId(tableName: string, entityId: string): Promise<string | null> {
  if (entityId.startsWith('rec')) return entityId;
  const cached = recordIdMap.get(entityId);
  if (cached) return cached;

  const filter = encodeURIComponent(`{id}='${entityId.replace(/'/g, "\\'")}'`);
  const res = await directAirtableApiRequest(`/${encodeURIComponent(tableName)}?filterByFormula=${filter}&maxRecords=1`, 'GET');
  if (res.status === 200 && res.data?.records?.length > 0) {
    const recId = res.data.records[0].id;
    recordIdMap.set(entityId, recId);
    return recId;
  }
  return null;
}

export class AirtableService {
  private useDirectApi: boolean = false;

  private parseRawTables(tables: Record<string, any>): any {
    const parsedData: any = {};

    // 1. INITIAL_ANNOUNCEMENTS
    if (tables.INITIAL_ANNOUNCEMENTS?.success && tables.INITIAL_ANNOUNCEMENTS.records?.length > 0) {
      parsedData.announcements = tables.INITIAL_ANNOUNCEMENTS.records.map((r: any) => {
        const f = r.fields || {};
        const id = String(f.id || r.id);
        recordIdMap.set(id, r.id);
        return {
          id,
          author_id: String(f.author_id || ''),
          author_name: String(f.author_name || 'Admin'),
          type: f.type === 'hostel' ? 'hostel' : 'academic',
          target: String(f.target || 'CS'),
          content: String(f.content || ''),
          date_time: parseTimestamp(f.date_time),
          tags: parseTags(f.tags)
        } as Announcement;
      });
    }

    // 3. INITIAL_THREADS
    if (tables.INITIAL_THREADS?.success && tables.INITIAL_THREADS.records?.length > 0) {
      parsedData.threads = tables.INITIAL_THREADS.records.map((r: any) => {
        const f = r.fields || {};
        const id = String(f.id || r.id);
        recordIdMap.set(id, r.id);
        return {
          id,
          author_id: String(f.author_id || ''),
          author_name: String(f.author_name || 'Student'),
          title: String(f.title || ''),
          created_at: parseTimestamp(f.created_at),
          tags: parseThreadTags(f.tags),
          linked_resource: parseLinkedResource(f.linked_resource),
          visibility_branch: f.visibility_branch || undefined,
          visibility_hostel: f.visibility_hostel || undefined
        } as Thread;
      });
    }

    // 4. INITIAL_REPLIES
    if (tables.INITIAL_REPLIES?.success && tables.INITIAL_REPLIES.records?.length > 0) {
      parsedData.replies = tables.INITIAL_REPLIES.records.map((r: any) => {
        const f = r.fields || {};
        const id = String(f.id || r.id);
        recordIdMap.set(id, r.id);
        return {
          id,
          target_id: String(f.target_id || ''),
          author_id: String(f.author_id || ''),
          author_name: String(f.author_name || 'Student'),
          content: String(f.content || ''),
          created_at: parseTimestamp(f.created_at),
          is_deleted: f.is_deleted === true || f.is_deleted === 'true'
        } as Reply;
      }).sort((a: Reply, b: Reply) => a.created_at - b.created_at);
    }

    // 5. INITIAL_SCHEDULES
    if (tables.INITIAL_SCHEDULES?.success && tables.INITIAL_SCHEDULES.records?.length > 0) {
      parsedData.schedules = tables.INITIAL_SCHEDULES.records.map((r: any) => {
        const f = r.fields || {};
        const id = String(f.id || r.id);
        recordIdMap.set(id, r.id);
        return {
          id,
          title: String(f.title || ''),
          type: (f.type as any) || 'Lecture Schedule',
          target_branch: (f.target_branch as Branch) || 'CS',
          valid_from: String(f.valid_from || '2026-09-01'),
          valid_until: String(f.valid_until || '2026-12-31')
        } as ScheduleMaster;
      });
    }

    // 6. INITIAL_BASE_EVENTS
    if (tables.INITIAL_BASE_EVENTS?.success && tables.INITIAL_BASE_EVENTS.records?.length > 0) {
      parsedData.baseEvents = tables.INITIAL_BASE_EVENTS.records.map((r: any) => {
        const f = r.fields || {};
        const id = String(f.id || r.id);
        recordIdMap.set(id, r.id);
        return {
          id,
          schedule_id: String(f.schedule_id || 'sm1'),
          course: String(f.course || ''),
          day_of_week: Number(f.day_of_week ?? 1),
          start_time: String(f.start_time || '10:00'),
          end_time: String(f.end_time || '11:30'),
          room: String(f.room || 'LH-1')
        } as BaseEvent;
      });
    }

    // 7. INITIAL_EXCEPTIONS
    if (tables.INITIAL_EXCEPTIONS?.success && tables.INITIAL_EXCEPTIONS.records?.length > 0) {
      parsedData.exceptionEvents = tables.INITIAL_EXCEPTIONS.records.map((r: any) => {
        const f = r.fields || {};
        const id = String(f.id || r.id);
        recordIdMap.set(id, r.id);
        const baseId = f.base_event_id && f.base_event_id !== 'null' && f.base_event_id !== 'N/A' ? String(f.base_event_id) : null;
        return {
          id,
          schedule_id: String(f.schedule_id || 'sm1'),
          base_event_id: baseId,
          date: parseExceptionDate(f.date),
          type: (f.type as any) || 'change',
          course: f.course && f.course !== 'N/A' ? String(f.course) : undefined,
          start_time: f.start_time && f.start_time !== 'N/A' ? String(f.start_time) : undefined,
          end_time: f.end_time && f.end_time !== 'N/A' ? String(f.end_time) : undefined,
          room: f.room && f.room !== 'N/A' ? String(f.room) : undefined
        } as ExceptionEvent;
      });
    }

    // 8. INITIAL_EXAMS
    if (tables.INITIAL_EXAMS?.success && tables.INITIAL_EXAMS.records?.length > 0) {
      parsedData.exams = tables.INITIAL_EXAMS.records.map((r: any) => {
        const f = r.fields || {};
        const id = String(f.id || r.id);
        recordIdMap.set(id, r.id);
        return {
          id,
          date: String(f.date || ''),
          time: f.time && f.time !== 'null' ? String(f.time) : null,
          course_code: String(f.course_code || ''),
          course_name: f.course_name ? String(f.course_name) : undefined,
          exam_name: String(f.exam_name || 'Examination'),
          venue: f.venue && f.venue !== 'null' ? String(f.venue) : null,
          target_branch: (f.target_branch as any) || 'CS',
          slot: f.slot && f.slot !== 'null' ? String(f.slot) : null,
          notes: f.notes && f.notes !== 'null' ? String(f.notes) : null
        } as ExamItem;
      });
    }

    // 9. INITIAL_FOLDERS
    if (tables.INITIAL_FOLDERS?.success && tables.INITIAL_FOLDERS.records?.length > 0) {
      parsedData.folders = tables.INITIAL_FOLDERS.records.map((r: any) => {
        const f = r.fields || {};
        const id = String(f.id || r.id);
        recordIdMap.set(id, r.id);
        return {
          id,
          name: String(f.name || 'Folder'),
          parent_id: f.parent_id && f.parent_id !== 'null' ? String(f.parent_id) : null,
          branch: (f.branch as Branch) || 'CS',
          created_at: parseTimestamp(f.created_at),
          created_by: String(f.created_by || 'Admin')
        } as ResourceFolder;
      });
    }

    // 10. INITIAL_RESOURCES (Metadata only - content loaded on-demand to save memory)
    if (tables.INITIAL_RESOURCES?.success && tables.INITIAL_RESOURCES.records?.length > 0) {
      parsedData.resources = tables.INITIAL_RESOURCES.records.map((r: any) => {
        const f = r.fields || {};
        const id = String(f.id || r.id);
        recordIdMap.set(id, r.id);
        let downloadUrl: string | undefined = undefined;
        if (Array.isArray(f.content) && f.content.length > 0 && f.content[0]?.url) {
          downloadUrl = f.content[0].url;
        }
        return {
          id,
          name: String(f.name || 'Resource'),
          folder_id: f.folder_id && f.folder_id !== 'null' ? String(f.folder_id) : null,
          branch: (f.branch as Branch) || 'CS',
          size: String(f.size || '10 KB'),
          type: (f.type as any) || 'md',
          uploaded_at: parseTimestamp(f.uploaded_at),
          uploaded_by: String(f.uploaded_by || 'Admin'),
          description: f.description ? String(f.description) : undefined,
          content: undefined,
          download_url: downloadUrl
        } as ResourceItem;
      });
    }

    // 11. INITIAL_COURSES
    if (tables.INITIAL_COURSES?.success && tables.INITIAL_COURSES.records?.length > 0) {
      parsedData.courses = tables.INITIAL_COURSES.records.map((r: any) => {
        const f = r.fields || {};
        const id = String(f.id || r.id);
        recordIdMap.set(id, r.id);
        const branch = (f.branch as any) || 'CS';
        return {
          id,
          code: String(f.code || ''),
          name: String(f.name || ''),
          credits: Number(f.credits || 3),
          semester: String(f.semester || 'Autumn 2026 (Sem 5)'),
          segment_start: Number(f.seg_start ?? f.segment_start ?? 1),
          segment_end: Number(f.seg_end ?? f.segment_end ?? 6),
          type: (f.type as any) || 'Core',
          branch,
          slot: String(f.slot || ''),
          venue: String(f.venue || ''),
          moodle_link: f.moodle_link ? String(f.moodle_link) : undefined,
          instructors: parseInstructors(f.instructors, branch === 'All' ? 'CS' : branch),
          teaching_assistants: parseTeachingAssistants(f.teaching_assistants),
          description: f.description ? String(f.description) : undefined
        } as Course;
      });
    }

    // 12. INITIAL_ENROLLMENTS
    if (tables.INITIAL_ENROLLMENTS?.success && tables.INITIAL_ENROLLMENTS.records?.length > 0) {
      parsedData.enrollments = tables.INITIAL_ENROLLMENTS.records.map((r: any) => {
        const f = r.fields || {};
        const id = String(f.id || r.id);
        recordIdMap.set(id, r.id);
        return {
          id,
          user_id: String(f.user_id || '').split(' ')[0].trim(),
          course_id: String(f.course_id || ''),
          semester: String(f.semester || 'Autumn 2026'),
          status: (f.status as any) || 'Active',
          enrolled_date: String(f.enrolled_date || '2026-08-01')
        } as Enrollment;
      });
    }

    return parsedData;
  }

  async checkStatus(): Promise<AirtableStatus> {
    const currentBaseId = getBaseId();

    if (!this.useDirectApi) {
      try {
        const res = await fetch('/api/airtable/status');
        const contentType = res.headers.get('content-type') || '';
        
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          if (data && typeof data.connected === 'boolean') {
            return {
              connected: data.connected ?? false,
              baseId: data.baseId || currentBaseId,
              status: data.status || (data.connected ? 'connected' : 'error'),
              statusCode: data.statusCode,
              message: data.message,
              lastSyncedAt: Date.now()
            };
          }
        }
      } catch (err) {
        console.warn('[Airtable] Proxy unavailable, switching to direct client Airtable API mode.');
      }
      this.useDirectApi = true;
    }

    // Direct mode fallback (Netlify / Static client host)
    const result = await directAirtableApiRequest('/INITIAL_ANNOUNCEMENTS?maxRecords=1', 'GET');
    if (result.status === 200) {
      return {
        connected: true,
        baseId: currentBaseId,
        status: 'connected',
        message: 'Successfully connected directly to Airtable database',
        lastSyncedAt: Date.now()
      };
    }

    return {
      connected: false,
      baseId: currentBaseId,
      status: result.status === 403 ? 'permission_denied' : 'error',
      statusCode: result.status,
      message: result.status === 403
        ? `Personal Access Token requires permission for base ${currentBaseId} and scopes (data.records:read, data.records:write). Check airtable.com/create/tokens.`
        : (result.data?.error?.message || 'Failed to connect directly to Airtable API')
    };
  }

  // Load all 12 tables from Airtable
  async fetchAllData(): Promise<{
    success: boolean;
    error?: any;
    data?: {
      users?: User[];
      announcements?: Announcement[];
      threads?: Thread[];
      replies?: Reply[];
      schedules?: ScheduleMaster[];
      baseEvents?: BaseEvent[];
      exceptionEvents?: ExceptionEvent[];
      exams?: ExamItem[];
      folders?: ResourceFolder[];
      resources?: ResourceItem[];
      courses?: Course[];
      enrollments?: Enrollment[];
    };
  }> {
    return this.fetchTables(TABLE_NAMES);
  }

  // Load only requested tables from Airtable on-demand
  async fetchTables(tableNames: string[]): Promise<{
    success: boolean;
    error?: any;
    data?: {
      users?: User[];
      announcements?: Announcement[];
      threads?: Thread[];
      replies?: Reply[];
      schedules?: ScheduleMaster[];
      baseEvents?: BaseEvent[];
      exceptionEvents?: ExceptionEvent[];
      exams?: ExamItem[];
      folders?: ResourceFolder[];
      resources?: ResourceItem[];
      courses?: Course[];
      enrollments?: Enrollment[];
    };
  }> {
    if (!tableNames || tableNames.length === 0) {
      return { success: true, data: {} };
    }

    if (!this.useDirectApi) {
      try {
        const res = await fetch(`/api/airtable/tables?names=${encodeURIComponent(tableNames.join(','))}`);
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const result = await res.json();
          if (result.success && result.tables) {
            return {
              success: true,
              data: this.parseRawTables(result.tables)
            };
          }
        }
      } catch (err) {
        console.warn('[Airtable] Proxy fetchTables failed, switching to direct client API...');
      }
      this.useDirectApi = true;
    }

    // Direct client fetch logic (Netlify / SPA host)
    try {
      const results: Record<string, { success: boolean; records?: any[]; error?: any }> = {};
      let hasAnySuccess = false;
      let primaryError: any = null;

      const batchSize = 4;
      for (let i = 0; i < tableNames.length; i += batchSize) {
        const batch = tableNames.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (table) => {
            const tableResult = await directFetchAllTableRecords(table);
            results[table] = tableResult;
            if (tableResult.success) {
              hasAnySuccess = true;
            } else if (!primaryError) {
              primaryError = tableResult.error;
            }
          })
        );
        if (i + batchSize < tableNames.length) {
          await new Promise(r => setTimeout(r, 100));
        }
      }

      if (!hasAnySuccess) {
        return { success: false, error: primaryError || 'Failed to fetch Airtable records directly' };
      }

      return {
        success: true,
        data: this.parseRawTables(results)
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Direct Airtable fetch failed' };
    }
  }

  // Generic write helpers
  private async createRecord(table: string, fields: Record<string, any>): Promise<any> {
    if (!this.useDirectApi) {
      try {
        const res = await fetch(`/api/airtable/${encodeURIComponent(table)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields })
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (res.ok) {
            if (data.record?.id && fields.id) {
              recordIdMap.set(fields.id, data.record.id);
            }
          }
          return data;
        }
      } catch (err) {
        console.warn(`[Airtable] Server write network error for ${table}, using direct client API.`);
        this.useDirectApi = true;
      }
    }

    const res = await directAirtableApiRequest(`/${encodeURIComponent(table)}`, 'POST', { fields, typecast: true });
    if (res.data?.id && fields.id) {
      recordIdMap.set(fields.id, res.data.id);
    }
    return res.data;
  }

  private async updateRecord(table: string, id: string, fields: Record<string, any>): Promise<any> {
    if (!this.useDirectApi) {
      try {
        const targetId = recordIdMap.get(id) || id;
        const res = await fetch(`/api/airtable/${encodeURIComponent(table)}/${encodeURIComponent(targetId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields })
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          return await res.json();
        }
      } catch (err) {
        console.warn(`[Airtable] Server update network error for ${table}, using direct client API.`);
        this.useDirectApi = true;
      }
    }

    const targetAirtableId = await directFindRecordIdByEntityId(table, id);
    if (!targetAirtableId) return null;
    const res = await directAirtableApiRequest(`/${encodeURIComponent(table)}/${targetAirtableId}`, 'PATCH', { fields, typecast: true });
    return res.data;
  }

  private async deleteRecord(table: string, id: string): Promise<any> {
    if (!this.useDirectApi) {
      try {
        const targetId = recordIdMap.get(id) || id;
        const res = await fetch(`/api/airtable/${encodeURIComponent(table)}/${encodeURIComponent(targetId)}`, {
          method: 'DELETE'
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          recordIdMap.delete(id);
          return await res.json();
        }
      } catch (err) {
        console.warn(`[Airtable] Server delete network error for ${table}, using direct client API.`);
        this.useDirectApi = true;
      }
    }

    const targetAirtableId = await directFindRecordIdByEntityId(table, id);
    if (!targetAirtableId) return null;
    const res = await directAirtableApiRequest(`/${encodeURIComponent(table)}/${targetAirtableId}`, 'DELETE');
    recordIdMap.delete(id);
    return res.data;
  }

  // --- Specific Table Handlers ---

  // --- Secure Authentication & Credential Handlers (Talk to server /api/auth/*) ---

  async login(email: string, password?: string): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Login failed' };
      }
      return { success: true, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error connecting to auth server' };
    }
  }

  async signup(params: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    hostel: string;
  }): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Sign up failed' };
      }
      return { success: true, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error connecting to auth server' };
    }
  }

  async updateProfile(params: {
    userId: string;
    firstName: string;
    lastName: string;
    hostel: string;
    avatarUrl?: string;
  }): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const res = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to update profile' };
      }
      return { success: true, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error updating profile' };
    }
  }

  async updatePassword(params: {
    userId: string;
    previousPassword: string;
    newPassword: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to update password' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error updating password' };
    }
  }

  async fetchReps(): Promise<Array<{ id: string; name: string; role: Role; branch: Branch; hostel: string }>> {
    try {
      const res = await fetch('/api/auth/reps');
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.reps)) {
        return data.reps;
      }
      return [];
    } catch {
      return [];
    }
  }

  async fetchPublicUser(userId: string): Promise<{ id: string; name: string; role: Role; branch: Branch; hostel: string } | null> {
    try {
      const res = await fetch(`/api/auth/public-user/${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        return data.user;
      }
      return null;
    } catch {
      return null;
    }
  }

  // Announcements
  async createAnnouncement(ann: Announcement): Promise<void> {
    const fields = {
      id: ann.id,
      author_id: ann.author_id,
      author_name: ann.author_name,
      type: ann.type,
      target: ann.target,
      content: ann.content,
      date_time: new Date(ann.date_time).toISOString(),
      tags: ann.tags
    };
    await this.createRecord('INITIAL_ANNOUNCEMENTS', fields);
  }

  async updateAnnouncement(id: string, content: string, tags: Tag[]): Promise<void> {
    const fields = {
      content,
      tags: tags
    };
    await this.updateRecord('INITIAL_ANNOUNCEMENTS', id, fields);
  }

  async deleteAnnouncement(id: string): Promise<void> {
    await this.deleteRecord('INITIAL_ANNOUNCEMENTS', id);
  }

  // Threads
  async createThread(t: Thread): Promise<void> {
    const fields = {
      id: t.id,
      author_id: t.author_id,
      author_name: t.author_name,
      title: t.title,
      created_at: new Date(t.created_at).toISOString(),
      tags: t.tags[0] || 'Academic',
      linked_resource: t.linked_resource ? JSON.stringify(t.linked_resource) : 'null'
    };
    await this.createRecord('INITIAL_THREADS', fields);
  }

  async deleteThread(id: string): Promise<void> {
    await this.deleteRecord('INITIAL_THREADS', id);
  }

  // Replies
  async createReply(r: Reply): Promise<void> {
    const fields = {
      id: r.id,
      target_id: r.target_id,
      author_id: r.author_id,
      author_name: r.author_name,
      content: r.content,
      created_at: new Date(r.created_at).toISOString(),
      is_deleted: r.is_deleted ? 'true' : 'false'
    };
    await this.createRecord('INITIAL_REPLIES', fields);
  }

  async updateReply(id: string, content: string, isDeleted: boolean = false): Promise<void> {
    const fields: Record<string, any> = {
      content,
      is_deleted: isDeleted ? 'true' : 'false'
    };
    await this.updateRecord('INITIAL_REPLIES', id, fields);
  }

  async deleteReply(id: string): Promise<void> {
    await this.updateRecord('INITIAL_REPLIES', id, { is_deleted: 'true' });
  }

  // Schedules
  async createSchedule(s: ScheduleMaster): Promise<void> {
    const fields = {
      id: s.id,
      title: s.title,
      type: s.type,
      target_branch: s.target_branch,
      valid_from: s.valid_from,
      valid_until: s.valid_until
    };
    await this.createRecord('INITIAL_SCHEDULES', fields);
  }

  // Base Events
  async createBaseEvent(be: BaseEvent): Promise<void> {
    const fields = {
      id: be.id,
      schedule_id: be.schedule_id,
      course: be.course,
      day_of_week: be.day_of_week,
      start_time: be.start_time,
      end_time: be.end_time,
      room: be.room
    };
    await this.createRecord('INITIAL_BASE_EVENTS', fields);
  }

  async updateBaseEvent(id: string, event: Partial<BaseEvent>): Promise<void> {
    await this.updateRecord('INITIAL_BASE_EVENTS', id, event);
  }

  async deleteBaseEvent(id: string): Promise<void> {
    await this.deleteRecord('INITIAL_BASE_EVENTS', id);
  }

  // Exceptions
  async createException(ex: ExceptionEvent): Promise<void> {
    const fields = {
      id: ex.id,
      schedule_id: ex.schedule_id,
      base_event_id: ex.base_event_id || 'null',
      date: ex.date,
      type: ex.type,
      course: ex.course || 'N/A',
      start_time: ex.start_time || 'N/A',
      end_time: ex.end_time || 'N/A',
      room: ex.room || 'N/A'
    };
    await this.createRecord('INITIAL_EXCEPTIONS', fields);
  }

  async updateException(id: string, ex: Partial<ExceptionEvent>): Promise<void> {
    await this.updateRecord('INITIAL_EXCEPTIONS', id, ex);
  }

  async deleteException(id: string): Promise<void> {
    await this.deleteRecord('INITIAL_EXCEPTIONS', id);
  }

  // Exams
  async createExam(exam: ExamItem): Promise<void> {
    const fields = {
      id: exam.id,
      date: exam.date,
      time: exam.time || 'null',
      course_code: exam.course_code,
      course_name: exam.course_name || '',
      exam_name: exam.exam_name,
      venue: exam.venue || 'null',
      target_branch: exam.target_branch,
      slot: exam.slot || 'null',
      notes: exam.notes || 'null'
    };
    await this.createRecord('INITIAL_EXAMS', fields);
  }

  async updateExam(id: string, exam: Partial<ExamItem>): Promise<void> {
    await this.updateRecord('INITIAL_EXAMS', id, exam);
  }

  async deleteExam(id: string): Promise<void> {
    await this.deleteRecord('INITIAL_EXAMS', id);
  }

  // Folders
  async createFolder(f: ResourceFolder): Promise<void> {
    const fields = {
      id: f.id,
      name: f.name,
      parent_id: f.parent_id || 'null',
      branch: f.branch,
      created_at: new Date(f.created_at).toISOString(),
      created_by: f.created_by
    };
    await this.createRecord('INITIAL_FOLDERS', fields);
  }

  async deleteFolder(id: string): Promise<void> {
    await this.deleteRecord('INITIAL_FOLDERS', id);
  }

  // Resources
  async createResource(r: ResourceItem): Promise<void> {
    const fields: Record<string, any> = {
      id: r.id,
      name: r.name,
      folder_id: r.folder_id || 'null',
      branch: r.branch,
      size: r.size,
      type: r.type,
      uploaded_at: new Date(r.uploaded_at).toISOString(),
      uploaded_by: r.uploaded_by,
      description: r.description || ''
    };

    // 1. Create the resource record in INITIAL_RESOURCES
    const createRes = await this.createRecord('INITIAL_RESOURCES', fields);

    // 2. If content is provided, upload it as an attachment to the "content" column
    if (r.content) {
      const targetRecordId = createRes?.record?.id || recordIdMap.get(r.id) || r.id;
      let contentType = 'text/plain';
      const lowerName = r.name.toLowerCase();
      if (lowerName.endsWith('.md')) contentType = 'text/markdown';
      else if (lowerName.endsWith('.pdf')) contentType = 'application/pdf';
      else if (lowerName.endsWith('.c') || lowerName.endsWith('.h')) contentType = 'text/x-c';
      else if (lowerName.endsWith('.cpp')) contentType = 'text/x-c++';
      else if (lowerName.endsWith('.py')) contentType = 'text/x-python';
      else if (lowerName.endsWith('.json')) contentType = 'application/json';
      else if (lowerName.endsWith('.zip')) contentType = 'application/zip';
      else if (lowerName.endsWith('.png')) contentType = 'image/png';
      else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) contentType = 'image/jpeg';

      await this.uploadAttachment(
        'INITIAL_RESOURCES',
        targetRecordId,
        'content',
        r.content,
        r.name,
        contentType
      );
    }
  }

  async uploadAttachment(
    table: string,
    recordId: string,
    fieldName: string,
    fileData: string,
    filename: string,
    contentType: string = 'text/plain'
  ): Promise<any> {
    // 1. Try server proxy first
    if (!this.useDirectApi) {
      try {
        const res = await fetch('/api/airtable/upload_attachment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table,
            recordId,
            fieldName,
            file: fileData,
            filename,
            contentType
          })
        });
        const contentTypeHeader = res.headers.get('content-type') || '';
        if (contentTypeHeader.includes('application/json')) {
          const data = await res.json();
          if (res.ok && data.success) {
            return data;
          }
          console.warn('[Airtable] Server upload_attachment returned:', data);
        }
      } catch (err) {
        console.warn('[Airtable] Server upload_attachment network error, falling back to direct API:', err);
        this.useDirectApi = true;
      }
    }

    // 2. Direct Airtable content API fallback
    let airtableRecordId = recordId;
    if (!airtableRecordId.startsWith('rec')) {
      const resolved = await directFindRecordIdByEntityId(table, airtableRecordId);
      if (resolved) airtableRecordId = resolved;
    }

    let cleanBase64 = fileData;
    let detectedContentType = contentType;
    if (fileData.startsWith('data:')) {
      const match = fileData.match(/^data:([^;]+);base64,(.+)$/s);
      if (match) {
        detectedContentType = match[1];
        cleanBase64 = match[2];
      } else {
        const commaIdx = fileData.indexOf(',');
        if (commaIdx !== -1) {
          const raw = decodeURIComponent(fileData.substring(commaIdx + 1));
          cleanBase64 = btoa(unescape(encodeURIComponent(raw)));
          const mimeMatch = fileData.substring(0, commaIdx).match(/^data:([^;]+)/);
          if (mimeMatch) detectedContentType = mimeMatch[1];
        }
      }
    } else {
      const isAscii = /^[\x00-\x7F]*$/.test(fileData);
      if (isAscii && (fileData.includes(' ') || fileData.includes('\n') || fileData.includes('#') || fileData.includes('='))) {
        cleanBase64 = btoa(unescape(encodeURIComponent(fileData)));
      }
    }

    const uploadUrl = `https://content.airtable.com/v0/${getBaseId()}/${airtableRecordId}/${encodeURIComponent(fieldName)}/uploadAttachment`;
    try {
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contentType: detectedContentType,
          file: cleanBase64,
          filename
        })
      });
      const data = await res.json();
      return data;
    } catch (e) {
      console.error('[Airtable] Direct uploadAttachment error:', e);
      return { success: false, error: e };
    }
  }

  async deleteResource(id: string): Promise<void> {
    await this.deleteRecord('INITIAL_RESOURCES', id);
  }

  // Enrollments
  async createEnrollment(en: Enrollment): Promise<void> {
    const fields = {
      id: en.id,
      user_id: en.user_id,
      course_id: en.course_id,
      semester: en.semester,
      status: en.status,
      enrolled_date: en.enrolled_date
    };
    await this.createRecord('INITIAL_ENROLLMENTS', fields);
  }

  async deleteEnrollment(id: string): Promise<void> {
    await this.deleteRecord('INITIAL_ENROLLMENTS', id);
  }

  // Targeted fetch for replies (used by 1-second auto-refresh when viewing threads or announcements)
  async fetchRepliesForTarget(targetId: string): Promise<Reply[]> {
    if (!targetId) return [];

    let rawRecords: any[] = [];

    if (!this.useDirectApi) {
      try {
        const res = await fetch(`/api/airtable/replies_by_target/${encodeURIComponent(targetId)}`);
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const result = await res.json();
          if (result.success && Array.isArray(result.records)) {
            rawRecords = result.records;
          }
        }
      } catch (err) {
        console.warn('[Airtable] Proxy replies fetch failed, falling back to direct API.');
        this.useDirectApi = true;
      }
    }

    if (this.useDirectApi) {
      const filter = encodeURIComponent(`{target_id}='${targetId.replace(/'/g, "\\'")}'`);
      const res = await directAirtableApiRequest(`/INITIAL_REPLIES?filterByFormula=${filter}`, 'GET');
      if (res.status === 200 && Array.isArray(res.data?.records)) {
        rawRecords = res.data.records;
      }
    }

    return rawRecords.map((r: any) => {
      const f = r.fields || {};
      const id = String(f.id || r.id);
      recordIdMap.set(id, r.id);
      return {
        id,
        target_id: String(f.target_id || targetId),
        author_id: String(f.author_id || ''),
        author_name: String(f.author_name || 'Student'),
        content: String(f.content || ''),
        created_at: parseTimestamp(f.created_at),
        is_deleted: f.is_deleted === true || f.is_deleted === 'true'
      } as Reply;
    }).sort((a, b) => a.created_at - b.created_at);
  }

  // Targeted fetch for resource file content (loaded strictly on-demand when viewing or downloading)
  async fetchResourceContent(resourceId: string): Promise<string> {
    if (!resourceId) return '';

    // 1. Try server proxy endpoint
    if (!this.useDirectApi) {
      try {
        const res = await fetch(`/api/airtable/resource_content/${encodeURIComponent(resourceId)}`);
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const result = await res.json();
          if (result.success && typeof result.content === 'string') {
            const clean = result.content;
            if (clean !== '[object Object]' && clean !== '[object Objects]' && !clean.startsWith('[object')) {
              return clean;
            }
          }
        }
      } catch (err) {
        console.warn('[Airtable] Proxy resource content fetch failed, falling back to direct API.');
        this.useDirectApi = true;
      }
    }

    // 2. Direct Airtable client fallback
    let targetAirtableId: string | null | undefined = recordIdMap.get(resourceId);
    if (!targetAirtableId) {
      targetAirtableId = await directFindRecordIdByEntityId('INITIAL_RESOURCES', resourceId);
    }
    if (!targetAirtableId && resourceId.startsWith('rec')) {
      targetAirtableId = resourceId;
    }

    if (targetAirtableId) {
      const res = await directAirtableApiRequest(`/INITIAL_RESOURCES/${targetAirtableId}`, 'GET');
      if (res.status === 200 && res.data?.fields?.content) {
        const raw = res.data.fields.content;
        let fileUrl = '';
        let fileName = String(res.data.fields.name || '');

        if (Array.isArray(raw) && raw.length > 0 && raw[0]?.url) {
          fileUrl = raw[0].url;
          if (raw[0].filename) fileName = raw[0].filename;
        } else if (typeof raw === 'object' && raw?.url) {
          fileUrl = raw.url;
        } else if (typeof raw === 'string') {
          if (raw.startsWith('http://') || raw.startsWith('https://')) {
            fileUrl = raw;
          } else if (raw !== '[object Object]' && raw !== '[object Objects]' && !raw.startsWith('[object')) {
            return raw;
          }
        }

        if (fileUrl) {
          const lowerFile = fileName.toLowerCase();
          const isText = lowerFile.endsWith('.md') || lowerFile.endsWith('.txt') || lowerFile.endsWith('.c') || lowerFile.endsWith('.cpp') || lowerFile.endsWith('.h') || lowerFile.endsWith('.py') || lowerFile.endsWith('.json') || lowerFile.endsWith('.csv');

          try {
            const fileRes = await fetch(fileUrl);
            if (fileRes.ok) {
              const mime = fileRes.headers.get('content-type') || '';
              if (isText || mime.includes('text') || mime.includes('json') || mime.includes('markdown')) {
                return await fileRes.text();
              } else {
                const blob = await fileRes.blob();
                return new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string || fileUrl);
                  reader.readAsDataURL(blob);
                });
              }
            }
          } catch (e) {
            return fileUrl;
          }
          return fileUrl;
        }
      }
    }
    return '';
  }
}

export const airtableService = new AirtableService();

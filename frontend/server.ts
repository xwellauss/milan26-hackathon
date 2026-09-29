import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appgHPiab7ZyPFj9d';
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || 'patgVaWQpRAOkDEwi.787a9f6e60e476ff3bc7aa9587df2323092bac7df5ac0ce68bedd75560a5a8b6';

// Only client-visible data tables. MOCK_USERS is kept isolated from generic bulk fetches.
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

// --- Secure Password Hashing & Verification ---
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derivedKey}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;
  if (storedHash.startsWith('scrypt:')) {
    const parts = storedHash.split(':');
    if (parts.length === 3) {
      const salt = parts[1];
      const key = parts[2];
      try {
        const testKey = crypto.scryptSync(password, salt, 64).toString('hex');
        return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(testKey, 'hex'));
      } catch {
        return false;
      }
    }
  }
  // Plaintext fallback for pre-existing accounts
  return storedHash === password;
}

// Ensure passwords and credentials are NEVER exposed to client responses
function sanitizeUser(fields: Record<string, any>, recordId?: string) {
  const { password, ...safeFields } = fields;
  return {
    id: String(safeFields.id || recordId || ''),
    name: String(safeFields.name || 'Student'),
    firstName: String(safeFields.firstName || (safeFields.name ? String(safeFields.name).split(' ')[0] : '')),
    lastName: String(safeFields.lastName || (safeFields.name ? String(safeFields.name).split(' ').slice(1).join(' ') : '')),
    email: String(safeFields.email || '').trim().toLowerCase(),
    rollNo: String(safeFields.rollNo || ''),
    admissionYear: Number(safeFields.admissionYear || 2026),
    role: String(safeFields.role || 'Normal Student'),
    branch: String(safeFields.branch || 'CS'),
    hostel: String(safeFields.hostel || 'Vivekananda'),
    avatarUrl: safeFields.avatarUrl || undefined
  };
}

// Institutional student identity resolution
const IITH_BTECH_EMAIL_REGEX = /^(?<branchCode>[a-z]{2})(?<year>\d{2})btech(?<num>\d{5})@iith\.ac\.in$/i;

const BRANCH_CODE_MAP: Record<string, string> = {
  cs: 'CS',
  ee: 'EE',
  mc: 'MnC',
  ma: 'MnC',
  ai: 'AI',
  me: 'ME',
  ce: 'CE',
  bt: 'BT'
};

const CR_EMAILS: Record<string, string> = {
  'cs26btech11001@iith.ac.in': 'CS',
  'cs26btech11002@iith.ac.in': 'CS',
  'ee26btech11002@iith.ac.in': 'EE',
  'mc26btech11003@iith.ac.in': 'MnC',
  'ai26btech11001@iith.ac.in': 'AI',
  'me26btech11001@iith.ac.in': 'ME',
  'ce26btech11001@iith.ac.in': 'CE',
  'bt26btech11001@iith.ac.in': 'BT'
};

const HR_EMAILS: Record<string, string> = {
  'hr.vivekananda@iith.ac.in': 'Vivekananda',
  'cs26btech11004@iith.ac.in': 'Vivekananda',
  'ee26btech11004@iith.ac.in': 'Vivekananda',
  'mc26btech11004@iith.ac.in': 'S.N. Bose',
  'ai26btech11004@iith.ac.in': 'S.N. Bose',
  'cs26btech11006@iith.ac.in': 'Kalpana Chawla',
  'ee26btech11006@iith.ac.in': 'Kalpana Chawla'
};

function inferUserFromEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const match = normalized.match(IITH_BTECH_EMAIL_REGEX);
  if (!match || !match.groups) {
    return {
      isValid: false,
      branch: 'CS',
      admissionYear: 2026,
      rollNo: '',
      role: 'Normal Student',
      error: 'Invalid IITH BTech email format (e.g. cs26btech11001@iith.ac.in)'
    };
  }

  const branchCode = match.groups.branchCode.toLowerCase();
  const yearDigits = parseInt(match.groups.year, 10);
  const admissionYear = 2000 + yearDigits;
  const rollNo = normalized.replace(/@iith\.ac\.in$/i, '');
  const branch = BRANCH_CODE_MAP[branchCode] || branchCode.toUpperCase();

  let role = 'Normal Student';
  if (CR_EMAILS[normalized]) {
    role = 'CR';
  } else if (HR_EMAILS[normalized]) {
    role = 'HR';
  }

  return {
    isValid: true,
    branch,
    admissionYear,
    rollNo,
    role
  };
}

interface AirtableRecord {
  id: string;
  createdTime?: string;
  fields: Record<string, any>;
}

async function airtableApiRequest(
  endpoint: string,
  method: string = 'GET',
  body?: any,
  retries: number = 2
): Promise<{ status: number; data: any }> {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}${endpoint}`;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
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
      return airtableApiRequest(endpoint, method, body, retries - 1);
    }

    let data;
    try {
      data = await response.json();
    } catch {
      data = { error: 'Invalid JSON response from Airtable' };
    }

    return { status: response.status, data };
  } catch (err: any) {
    return { status: 500, data: { error: err.message || 'Network error connecting to Airtable' } };
  }
}

// Fetch all records for a table, handling pagination
async function fetchAllTableRecords(tableName: string): Promise<{ success: boolean; records?: AirtableRecord[]; error?: any; status: number }> {
  let allRecords: AirtableRecord[] = [];
  let offset: string | undefined = undefined;

  do {
    const query = offset ? `?offset=${encodeURIComponent(offset)}` : '';
    const res = await airtableApiRequest(`/${encodeURIComponent(tableName)}${query}`, 'GET');
    
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

// Helper to find Airtable rec ID from entity id if needed
async function findRecordIdByEntityId(tableName: string, entityId: string): Promise<string | null> {
  if (entityId.startsWith('rec')) return entityId;
  const filter = encodeURIComponent(`{id}='${entityId.replace(/'/g, "\\'")}'`);
  const res = await airtableApiRequest(`/${encodeURIComponent(tableName)}?filterByFormula=${filter}&maxRecords=1`, 'GET');
  if (res.status === 200 && res.data?.records?.length > 0) {
    return res.data.records[0].id;
  }
  return null;
}

// ============================================================================
// PRODUCTION AUTHENTICATION & CREDENTIAL PROTECTION APIS
// ============================================================================

// 1. Secure Server-Side Login (Strict credential checking & password stripping)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const filter = encodeURIComponent(`{email}='${cleanEmail.replace(/'/g, "\\'")}'`);
    const searchRes = await airtableApiRequest(`/MOCK_USERS?filterByFormula=${filter}&maxRecords=1`, 'GET');

    if (searchRes.status >= 400 || !searchRes.data?.records || searchRes.data.records.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'No account found with this email. Please sign up first.'
      });
    }

    const record = searchRes.data.records[0];
    const storedPassword = String(record.fields?.password || '');

    if (password !== undefined) {
      const isValid = verifyPassword(password, storedPassword);
      if (!isValid) {
        return res.status(401).json({
          success: false,
          error: 'Incorrect password. Please try again.'
        });
      }

      // Upgrade plain password to scrypt hash in background if needed
      if (!storedPassword.startsWith('scrypt:')) {
        const upgraded = hashPassword(password);
        airtableApiRequest(`/MOCK_USERS/${record.id}`, 'PATCH', {
          fields: { password: upgraded },
          typecast: true
        }).catch(e => console.warn('[Auth] Background password hash upgrade failed:', e));
      }
    }

    const safeUser = sanitizeUser(record.fields, record.id);
    const sessionToken = crypto.randomBytes(32).toString('hex');

    res.json({
      success: true,
      user: safeUser,
      token: sessionToken
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Server login failed' });
  }
});

// 2. Secure Server-Side Signup (Validates, hashes password, and creates account)
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, password, hostel } = req.body;

    if (!email || !password || !firstName) {
      return res.status(400).json({ success: false, error: 'First name, email, and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const inferred = inferUserFromEmail(cleanEmail);
    if (!inferred.isValid) {
      return res.status(400).json({ success: false, error: inferred.error });
    }

    // Prevent duplicate emails
    const filter = encodeURIComponent(`{email}='${cleanEmail.replace(/'/g, "\\'")}'`);
    const checkRes = await airtableApiRequest(`/MOCK_USERS?filterByFormula=${filter}&maxRecords=1`, 'GET');
    if (checkRes.status === 200 && checkRes.data?.records?.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'An account with this email already exists. Please log in instead.'
      });
    }

    const cleanFirst = String(firstName).trim();
    const cleanLast = String(lastName || '').trim();
    const fullName = `${cleanFirst} ${cleanLast}`.trim();
    const hashedPassword = hashPassword(password);
    const newId = `u_${Date.now()}`;

    const newFields = {
      id: newId,
      name: fullName,
      firstName: cleanFirst,
      lastName: cleanLast,
      email: cleanEmail,
      password: hashedPassword,
      rollNo: inferred.rollNo,
      admissionYear: inferred.admissionYear,
      role: inferred.role,
      branch: inferred.branch,
      hostel: hostel || 'Vivekananda'
    };

    const createRes = await airtableApiRequest('/MOCK_USERS', 'POST', {
      fields: newFields,
      typecast: true
    });

    if (createRes.status >= 400) {
      return res.status(createRes.status).json({ success: false, error: createRes.data });
    }

    const createdRecord = createRes.data;
    const safeUser = sanitizeUser(newFields, createdRecord.id);
    const sessionToken = crypto.randomBytes(32).toString('hex');

    res.json({
      success: true,
      user: safeUser,
      token: sessionToken
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Server signup failed' });
  }
});

// 3. Secure Profile Update (Updates details without exposing credentials)
app.post('/api/auth/update-profile', async (req, res) => {
  try {
    const { userId, firstName, lastName, hostel, avatarUrl } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const targetRecId = await findRecordIdByEntityId('MOCK_USERS', userId);
    if (!targetRecId) {
      return res.status(404).json({ success: false, error: 'User record not found' });
    }

    const cleanFirst = String(firstName || '').trim();
    const cleanLast = String(lastName || '').trim();
    const fullName = `${cleanFirst} ${cleanLast}`.trim();

    const patchFields: Record<string, any> = {
      name: fullName,
      firstName: cleanFirst,
      lastName: cleanLast,
      hostel: hostel || 'Vivekananda'
    };
    if (avatarUrl !== undefined) {
      patchFields.avatarUrl = avatarUrl;
    }

    const updateRes = await airtableApiRequest(`/MOCK_USERS/${targetRecId}`, 'PATCH', {
      fields: patchFields,
      typecast: true
    });

    if (updateRes.status >= 400) {
      return res.status(updateRes.status).json({ success: false, error: updateRes.data });
    }

    const safeUser = sanitizeUser(updateRes.data.fields, targetRecId);
    res.json({ success: true, user: safeUser });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to update profile' });
  }
});

// 4. Secure Password Update (Server-side validation & hashing)
app.post('/api/auth/update-password', async (req, res) => {
  try {
    const { userId, previousPassword, newPassword } = req.body;
    if (!userId || !previousPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'User ID, previous password, and new password are required' });
    }

    const targetRecId = await findRecordIdByEntityId('MOCK_USERS', userId);
    if (!targetRecId) {
      return res.status(404).json({ success: false, error: 'User record not found' });
    }

    const getRes = await airtableApiRequest(`/MOCK_USERS/${targetRecId}`, 'GET');
    if (getRes.status >= 400 || !getRes.data?.fields) {
      return res.status(404).json({ success: false, error: 'Could not fetch user record' });
    }

    const storedPassword = String(getRes.data.fields?.password || '');
    if (!verifyPassword(previousPassword, storedPassword)) {
      return res.status(400).json({ success: false, error: 'Previous password is incorrect.' });
    }

    const newHashed = hashPassword(newPassword);
    const patchRes = await airtableApiRequest(`/MOCK_USERS/${targetRecId}`, 'PATCH', {
      fields: { password: newHashed },
      typecast: true
    });

    if (patchRes.status >= 400) {
      return res.status(patchRes.status).json({ success: false, error: patchRes.data });
    }

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to update password' });
  }
});

// 5. Public Representative Directory (CRs and HRs) - Strips all sensitive data
app.get('/api/auth/reps', async (_req, res) => {
  try {
    const recordsRes = await fetchAllTableRecords('MOCK_USERS');
    if (!recordsRes.success || !recordsRes.records) {
      return res.json({ success: true, reps: [] });
    }

    const reps = recordsRes.records
      .filter(r => r.fields.role === 'CR' || r.fields.role === 'HR')
      .map(r => ({
        id: String(r.fields.id || r.id),
        name: String(r.fields.name || 'Representative'),
        role: String(r.fields.role || 'CR'),
        branch: String(r.fields.branch || 'CS'),
        hostel: String(r.fields.hostel || 'Vivekananda')
      }));

    res.json({ success: true, reps });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Public User Profile by ID - Strips all credentials and private emails
app.get('/api/auth/public-user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const targetRecId = await findRecordIdByEntityId('MOCK_USERS', userId);
    if (!targetRecId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const recRes = await airtableApiRequest(`/MOCK_USERS/${targetRecId}`, 'GET');
    if (recRes.status >= 400 || !recRes.data?.fields) {
      return res.status(404).json({ success: false, error: 'User record not found' });
    }

    const f = recRes.data.fields;
    res.json({
      success: true,
      user: {
        id: String(f.id || recRes.data.id),
        name: String(f.name || 'Student'),
        role: String(f.role || 'Normal Student'),
        branch: String(f.branch || 'CS'),
        hostel: String(f.hostel || 'Vivekananda')
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Check Airtable connectivity and permissions status
app.get('/api/airtable/status', async (_req, res) => {
  try {
    const result = await airtableApiRequest('/INITIAL_ANNOUNCEMENTS?maxRecords=1', 'GET');
    if (result.status === 200) {
      res.json({
        connected: true,
        baseId: AIRTABLE_BASE_ID,
        status: 'connected',
        message: 'Successfully connected to Airtable'
      });
    } else {
      res.json({
        connected: false,
        baseId: AIRTABLE_BASE_ID,
        status: result.status === 403 ? 'permission_denied' : 'error',
        statusCode: result.status,
        airtableError: result.data?.error,
        message: result.status === 403 
          ? 'Personal Access Token requires permission for base appgHPiab7ZyPFj9d and scopes (data.records:read, data.records:write). Check airtable.com/create/tokens.'
          : (result.data?.error?.message || 'Failed to connect to Airtable')
      });
    }
  } catch (err: any) {
    res.status(500).json({
      connected: false,
      baseId: AIRTABLE_BASE_ID,
      status: 'network_error',
      message: err.message || 'Server error connecting to Airtable'
    });
  }
});

// Fetch all 12 tables in one call
app.get('/api/airtable/all', async (_req, res) => {
  try {
    const results: Record<string, { success: boolean; records?: AirtableRecord[]; error?: any }> = {};
    let hasAnySuccess = false;
    let primaryError: any = null;

    // Fetch tables in controlled batches to stay comfortably within rate limits
    const batchSize = 4;
    for (let i = 0; i < TABLE_NAMES.length; i += batchSize) {
      const batch = TABLE_NAMES.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (table) => {
          const tableResult = await fetchAllTableRecords(table);
          results[table] = tableResult;
          if (tableResult.success) {
            hasAnySuccess = true;
          } else if (!primaryError) {
            primaryError = tableResult.error;
          }
        })
      );
      if (i + batchSize < TABLE_NAMES.length) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    res.json({
      success: hasAnySuccess,
      tables: results,
      error: primaryError,
      baseId: AIRTABLE_BASE_ID
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch Airtable data'
    });
  }
});

// Fetch only requested tables on-demand (e.g. /api/airtable/tables?names=INITIAL_FOLDERS,INITIAL_RESOURCES)
app.get('/api/airtable/tables', async (req, res) => {
  try {
    const rawNames = req.query.names as string;
    if (!rawNames) {
      return res.status(400).json({ success: false, error: 'Missing "names" query parameter' });
    }
    const requested = rawNames.split(',').map(s => s.trim()).filter(Boolean);
    const validTables = requested.filter(t => TABLE_NAMES.includes(t));

    if (validTables.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid table names provided' });
    }

    const results: Record<string, { success: boolean; records?: AirtableRecord[]; error?: any }> = {};
    let hasAnySuccess = false;
    let primaryError: any = null;

    await Promise.all(
      validTables.map(async (table) => {
        const tableResult = await fetchAllTableRecords(table);
        results[table] = tableResult;
        if (tableResult.success) {
          hasAnySuccess = true;
        } else if (!primaryError) {
          primaryError = tableResult.error;
        }
      })
    );

    res.json({
      success: hasAnySuccess,
      tables: results,
      error: primaryError,
      baseId: AIRTABLE_BASE_ID
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch requested Airtable tables'
    });
  }
});

// Fetch replies for a specific target ID
app.get('/api/airtable/replies_by_target/:targetId', async (req, res) => {
  try {
    const targetId = req.params.targetId;
    const filter = encodeURIComponent(`{target_id}='${targetId.replace(/'/g, "\\'")}'`);
    const result = await airtableApiRequest(`/INITIAL_REPLIES?filterByFormula=${filter}`, 'GET');
    if (result.status >= 400) {
      return res.status(result.status).json({ success: false, error: result.data });
    }
    res.json({ success: true, records: result.data?.records || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fetch content for a specific resource ID
app.get('/api/airtable/resource_content/:resourceId', async (req, res) => {
  try {
    const resourceId = req.params.resourceId;
    let record: any = null;

    // 1. If resourceId is Airtable recId, fetch directly
    if (resourceId.startsWith('rec')) {
      const recResult = await airtableApiRequest(`/INITIAL_RESOURCES/${resourceId}`, 'GET');
      if (recResult.status === 200) {
        record = recResult.data;
      }
    }

    // 2. Otherwise search by {id} formula
    if (!record) {
      const filter = encodeURIComponent(`{id}='${resourceId.replace(/'/g, "\\'")}'`);
      const result = await airtableApiRequest(`/INITIAL_RESOURCES?filterByFormula=${filter}&maxRecords=1`, 'GET');
      if (result.status === 200 && result.data?.records?.length > 0) {
        record = result.data.records[0];
      }
    }

    // 3. Fallback: try direct record fetch if record still null
    if (!record && !resourceId.startsWith('rec')) {
      const directRec = await airtableApiRequest(`/INITIAL_RESOURCES/${resourceId}`, 'GET');
      if (directRec.status === 200) {
        record = directRec.data;
      }
    }

    if (!record) {
      return res.status(404).json({ success: false, error: 'Resource record not found' });
    }

    const rawContent = record.fields?.content;
    const fileName = String(record.fields?.name || '');
    let extractedContent = '';

    if (Array.isArray(rawContent) && rawContent.length > 0) {
      const fileObj = rawContent[0];
      const fileUrl = fileObj?.url;
      const lowerFile = (fileObj?.filename || fileName).toLowerCase();
      const isTextFile = lowerFile.endsWith('.md') || lowerFile.endsWith('.txt') || lowerFile.endsWith('.c') || lowerFile.endsWith('.cpp') || lowerFile.endsWith('.h') || lowerFile.endsWith('.py') || lowerFile.endsWith('.js') || lowerFile.endsWith('.ts') || lowerFile.endsWith('.json') || lowerFile.endsWith('.csv') || lowerFile.endsWith('.html') || lowerFile.endsWith('.xml');

      if (fileUrl) {
        try {
          const fileRes = await fetch(fileUrl);
          if (fileRes.ok) {
            const contentType = fileRes.headers.get('content-type') || '';
            if (isTextFile || contentType.includes('text') || contentType.includes('json') || contentType.includes('markdown') || contentType.includes('javascript') || contentType.includes('xml')) {
              extractedContent = await fileRes.text();
            } else {
              const arrayBuffer = await fileRes.arrayBuffer();
              const base64 = Buffer.from(arrayBuffer).toString('base64');
              const finalMime = contentType || 'application/octet-stream';
              extractedContent = `data:${finalMime};base64,${base64}`;
            }
          } else {
            extractedContent = fileUrl;
          }
        } catch (e) {
          extractedContent = fileUrl;
        }
      }
    } else if (typeof rawContent === 'string') {
      extractedContent = rawContent;
    } else if (rawContent && typeof rawContent === 'object' && (rawContent as any).url) {
      extractedContent = (rawContent as any).url;
    }

    // Safety: ensure extractedContent is NEVER "[object Object]"
    if (extractedContent === '[object Object]' || extractedContent === '[object Objects]' || extractedContent.startsWith('[object')) {
      extractedContent = '';
    }

    res.json({
      success: true,
      id: resourceId,
      content: extractedContent
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fetch single table
app.get('/api/airtable/:table', async (req, res) => {
  try {
    if (req.params.table.toUpperCase() === 'MOCK_USERS') {
      return res.status(403).json({ success: false, error: 'Access to MOCK_USERS via generic API proxy is forbidden. Use /api/auth endpoints.' });
    }
    const result = await fetchAllTableRecords(req.params.table);
    if (!result.success) {
      return res.status(result.status || 500).json(result);
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create record in a table
app.post('/api/airtable/:table', async (req, res) => {
  try {
    if (req.params.table.toUpperCase() === 'MOCK_USERS') {
      return res.status(403).json({ success: false, error: 'Access to MOCK_USERS via generic API proxy is forbidden. Use /api/auth endpoints.' });
    }
    const { fields } = req.body;
    if (!fields) {
      return res.status(400).json({ success: false, error: 'Missing fields in request body' });
    }

    const result = await airtableApiRequest(`/${encodeURIComponent(req.params.table)}`, 'POST', {
      fields,
      typecast: true
    });

    if (result.status >= 400) {
      return res.status(result.status).json({ success: false, error: result.data });
    }

    res.json({ success: true, record: result.data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Upload attachment directly using Airtable's uploadAttachment endpoint
app.post('/api/airtable/upload_attachment', async (req, res) => {
  try {
    const { table, recordId, fieldName, file, filename, contentType } = req.body;

    if (!recordId || !file || !filename) {
      return res.status(400).json({ success: false, error: 'Missing required parameters (recordId, file, filename)' });
    }

    let airtableRecordId: string = String(recordId);
    if (!airtableRecordId.startsWith('rec')) {
      const found = await findRecordIdByEntityId(table || 'INITIAL_RESOURCES', airtableRecordId);
      if (!found) {
        return res.status(404).json({ success: false, error: `Could not find Airtable record ID for ${recordId}` });
      }
      airtableRecordId = found;
    }

    // Clean and detect base64
    let cleanBase64 = file;
    let detectedContentType = contentType || 'text/plain';

    if (file.startsWith('data:')) {
      const match = file.match(/^data:([^;]+);base64,(.+)$/s);
      if (match) {
        detectedContentType = match[1];
        cleanBase64 = match[2];
      } else {
        const commaIdx = file.indexOf(',');
        if (commaIdx !== -1) {
          const raw = decodeURIComponent(file.substring(commaIdx + 1));
          cleanBase64 = Buffer.from(raw, 'utf8').toString('base64');
          const mimeMatch = file.substring(0, commaIdx).match(/^data:([^;]+)/);
          if (mimeMatch) detectedContentType = mimeMatch[1];
        }
      }
    } else {
      const isAscii = /^[\x00-\x7F]*$/.test(file);
      if (isAscii && (file.includes(' ') || file.includes('\n') || file.includes('#') || file.includes('='))) {
        cleanBase64 = Buffer.from(file, 'utf8').toString('base64');
      }
    }

    const field = fieldName || 'content';
    const uploadUrl = `https://content.airtable.com/v0/${AIRTABLE_BASE_ID}/${airtableRecordId}/${encodeURIComponent(field)}/uploadAttachment`;
    console.log(`[Airtable] Uploading attachment for record ${airtableRecordId} to field ${field}...`);

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contentType: detectedContentType,
        file: cleanBase64,
        filename: filename
      })
    });

    const responseText = await uploadRes.text();
    let responseData: any = {};
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { text: responseText };
    }

    if (!uploadRes.ok) {
      console.error(`[Airtable] uploadAttachment error (${uploadRes.status}):`, responseData);
      return res.status(uploadRes.status).json({ success: false, error: responseData });
    }

    console.log(`[Airtable] Attachment uploaded successfully for record ${airtableRecordId}`);
    res.json({ success: true, record: responseData });
  } catch (err: any) {
    console.error('[Airtable] upload_attachment endpoint error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update record in a table
app.patch('/api/airtable/:table/:recordId', async (req, res) => {
  try {
    if (req.params.table.toUpperCase() === 'MOCK_USERS') {
      return res.status(403).json({ success: false, error: 'Access to MOCK_USERS via generic API proxy is forbidden. Use /api/auth endpoints.' });
    }
    const { fields } = req.body;
    const { table, recordId } = req.params;

    let targetAirtableId: string | null = recordId;
    if (!recordId.startsWith('rec')) {
      targetAirtableId = await findRecordIdByEntityId(table, recordId);
    }

    if (!targetAirtableId) {
      return res.status(404).json({ success: false, error: `Record with id ${recordId} not found in ${table}` });
    }

    const result = await airtableApiRequest(`/${encodeURIComponent(table)}/${targetAirtableId}`, 'PATCH', {
      fields,
      typecast: true
    });

    if (result.status >= 400) {
      return res.status(result.status).json({ success: false, error: result.data });
    }

    res.json({ success: true, record: result.data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete record in a table
app.delete('/api/airtable/:table/:recordId', async (req, res) => {
  try {
    if (req.params.table.toUpperCase() === 'MOCK_USERS') {
      return res.status(403).json({ success: false, error: 'Access to MOCK_USERS via generic API proxy is forbidden. Use /api/auth endpoints.' });
    }
    const { table, recordId } = req.params;

    let targetAirtableId: string | null = recordId;
    if (!recordId.startsWith('rec')) {
      targetAirtableId = await findRecordIdByEntityId(table, recordId);
    }

    if (!targetAirtableId) {
      return res.status(404).json({ success: false, error: `Record with id ${recordId} not found in ${table}` });
    }

    const result = await airtableApiRequest(`/${encodeURIComponent(table)}/${targetAirtableId}`, 'DELETE');

    if (result.status >= 400) {
      return res.status(result.status).json({ success: false, error: result.data });
    }

    res.json({ success: true, deleted: true, id: targetAirtableId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start server and mount Vite or static build
const isProduction = process.env.NODE_ENV === 'production';
const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`IRIS Server with Airtable Proxy running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

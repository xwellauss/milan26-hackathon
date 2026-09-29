import { Branch, Role, HostelInfo, CRTableEntry, HRTableEntry } from '../types';

export const HOSTEL_TABLE: HostelInfo[] = [
  {
    id: 'h_vivekananda',
    name: 'Vivekananda',
    code: 'VK',
    warden_name: 'Dr. Rajesh Kumar',
    warden_email: 'warden.vivekananda@iith.ac.in',
    hr_id: 'u4',
    hr_name: 'Aditya Patel',
    hr_email: 'cs26btech11004@iith.ac.in',
    hr_rollNo: 'cs26btech11004'
  },
  {
    id: 'h_snbose',
    name: 'S.N. Bose',
    code: 'SNB',
    warden_name: 'Dr. Vikramaditya Sen',
    warden_email: 'warden.snbose@iith.ac.in',
    hr_id: 'u8',
    hr_name: 'Siddharth Roy',
    hr_email: 'mc26btech11004@iith.ac.in',
    hr_rollNo: 'mc26btech11004'
  },
  {
    id: 'h_kalpanachawla',
    name: 'Kalpana Chawla',
    code: 'KC',
    warden_name: 'Dr. Anjali Deshmukh',
    warden_email: 'warden.kalpanachawla@iith.ac.in',
    hr_id: 'u9',
    hr_name: 'Pooja Reddy',
    hr_email: 'cs26btech11006@iith.ac.in',
    hr_rollNo: 'cs26btech11006'
  }
];

export const CR_TABLE: CRTableEntry[] = [
  { email: 'cs26btech11001@iith.ac.in', branch: 'CS' },
  { email: 'cs26btech11002@iith.ac.in', branch: 'CS' },
  { email: 'ee26btech11002@iith.ac.in', branch: 'EE' },
  { email: 'mc26btech11003@iith.ac.in', branch: 'MnC' },
  { email: 'ai26btech11001@iith.ac.in', branch: 'AI' },
  { email: 'me26btech11001@iith.ac.in', branch: 'ME' },
  { email: 'ce26btech11001@iith.ac.in', branch: 'CE' },
  { email: 'bt26btech11001@iith.ac.in', branch: 'BT' },
];

export const HR_TABLE: HRTableEntry[] = [
  { email: 'hr.vivekananda@iith.ac.in', hostel: 'Vivekananda' },
  { email: 'cs26btech11004@iith.ac.in', hostel: 'Vivekananda' },
  { email: 'ee26btech11004@iith.ac.in', hostel: 'Vivekananda' },
  { email: 'mc26btech11004@iith.ac.in', hostel: 'S.N. Bose' },
  { email: 'ai26btech11004@iith.ac.in', hostel: 'S.N. Bose' },
  { email: 'cs26btech11006@iith.ac.in', hostel: 'Kalpana Chawla' },
  { email: 'ee26btech11006@iith.ac.in', hostel: 'Kalpana Chawla' },
];

export const BRANCH_CODE_MAP: Record<string, Branch> = {
  cs: 'CS',
  ee: 'EE',
  mc: 'MnC',
  ma: 'MnC',
  ai: 'AI',
  me: 'ME',
  ce: 'CE',
  bt: 'BT',
};

// Format: (2 digit branch code)(year of admission)(btech)(5 digit num)@iith.ac.in
export const IITH_BTECH_EMAIL_REGEX = /^(?<branchCode>[a-z]{2})(?<year>\d{2})btech(?<num>\d{5})@iith\.ac\.in$/i;

export const inferUserDetailsFromEmail = (rawEmail: string): {
  isValid: boolean;
  branch: Branch;
  admissionYear: number;
  rollNo: string;
  role: Role;
  hostel: string;
  error?: string;
} => {
  const email = rawEmail.trim().toLowerCase();
  const match = email.match(IITH_BTECH_EMAIL_REGEX);

  if (!match || !match.groups) {
    return {
      isValid: false,
      branch: 'CS',
      admissionYear: 2026,
      rollNo: '',
      role: 'Normal Student',
      hostel: 'Vivekananda',
      error: 'Email must match format: (2-letter branch)(2-digit year)btech(5-digit number)@iith.ac.in (e.g. cs26btech11001@iith.ac.in)'
    };
  }

  const branchCode = match.groups.branchCode.toLowerCase();
  const yearDigits = parseInt(match.groups.year, 10);
  const admissionYear = 2000 + yearDigits;
  const rollNo = email.replace(/@iith\.ac\.in$/i, '');

  const inferredBranch: Branch = BRANCH_CODE_MAP[branchCode] || (branchCode.toUpperCase() as Branch);

  const crEntry = CR_TABLE.find(entry => entry.email.toLowerCase() === email);
  const hrEntry = HR_TABLE.find(entry => entry.email.toLowerCase() === email);

  let role: Role = 'Normal Student';
  if (crEntry) {
    role = 'CR';
  } else if (hrEntry) {
    role = 'HR';
  }

  const hostel = hrEntry?.hostel || (inferredBranch === 'MnC' ? 'S.N. Bose' : 'Vivekananda');

  return {
    isValid: true,
    branch: crEntry?.branch || inferredBranch,
    admissionYear,
    rollNo,
    role,
    hostel,
  };
};

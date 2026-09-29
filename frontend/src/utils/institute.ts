import { Branch, Role, HostelInfo, BranchInfo, CRTableEntry, HRTableEntry } from '../types';

export const HOSTEL_TABLE: HostelInfo[] = [
  {
    id: 'h_vivekananda',
    hostel_name: 'Vivekananda',
    hostel_code: 'VK',
    name: 'Vivekananda',
    code: 'VK',
    warden_name: 'Dr. Rajesh Kumar',
    warden_email: 'warden.vivekananda@iith.ac.in',
    warden_number: '+91 40 2301 6021',
    hr_ids: 'u4, u5',
    hrs: [
      {
        id: 'u4',
        name: 'Aditya Patel',
        email: 'cs26btech11004@iith.ac.in',
        rollNo: 'cs26btech11004',
        branch: 'CS26',
        hostel: 'Vivekananda'
      },
      {
        id: 'u5',
        name: 'Rohit Sharma',
        email: 'ee26btech11004@iith.ac.in',
        rollNo: 'ee26btech11004',
        branch: 'EE26',
        hostel: 'Vivekananda'
      }
    ]
  },
  {
    id: 'h_snbose',
    hostel_name: 'S.N. Bose',
    hostel_code: 'SNB',
    name: 'S.N. Bose',
    code: 'SNB',
    warden_name: 'Dr. Vikramaditya Sen',
    warden_email: 'warden.snbose@iith.ac.in',
    warden_number: '+91 40 2301 6022',
    hr_ids: 'u8',
    hrs: [
      {
        id: 'u8',
        name: 'Siddharth Roy',
        email: 'mc26btech11004@iith.ac.in',
        rollNo: 'mc26btech11004',
        branch: 'MnC26',
        hostel: 'S.N. Bose'
      }
    ]
  },
  {
    id: 'h_kalpanachawla',
    hostel_name: 'Kalpana Chawla',
    hostel_code: 'KC',
    name: 'Kalpana Chawla',
    code: 'KC',
    warden_name: 'Dr. Anjali Deshmukh',
    warden_email: 'warden.kalpanachawla@iith.ac.in',
    warden_number: '+91 40 2301 6023',
    hr_ids: 'u9, u10',
    hrs: [
      {
        id: 'u9',
        name: 'Pooja Reddy',
        email: 'cs26btech11006@iith.ac.in',
        rollNo: 'cs26btech11006',
        branch: 'CS26',
        hostel: 'Kalpana Chawla'
      },
      {
        id: 'u10',
        name: 'Sneha Verma',
        email: 'ee26btech11006@iith.ac.in',
        rollNo: 'ee26btech11006',
        branch: 'EE26',
        hostel: 'Kalpana Chawla'
      }
    ]
  }
];

export const BRANCH_TABLE: BranchInfo[] = [
  {
    id: 'b_cs26',
    branch_code: 'CS26',
    branch_name: 'Computer Science and Engineering (2026 Batch)',
    fa_name: 'Dr. Maunendra Desarkar',
    fa_email: 'fa.cs26@iith.ac.in',
    fa_number: '+91 40 2301 6101'
  },
  {
    id: 'b_cs25',
    branch_code: 'CS25',
    branch_name: 'Computer Science and Engineering (2025 Batch)',
    fa_name: 'Dr. Subrahmanyam Kalyanasundaram',
    fa_email: 'fa.cs25@iith.ac.in',
    fa_number: '+91 40 2301 6102'
  },
  {
    id: 'b_ee26',
    branch_code: 'EE26',
    branch_name: 'Electrical Engineering (2026 Batch)',
    fa_name: 'Dr. Ketan Rajawat',
    fa_email: 'fa.ee26@iith.ac.in',
    fa_number: '+91 40 2301 6103'
  },
  {
    id: 'b_ee25',
    branch_code: 'EE25',
    branch_name: 'Electrical Engineering (2025 Batch)',
    fa_name: 'Dr. P. Rajalakshmi',
    fa_email: 'fa.ee25@iith.ac.in',
    fa_number: '+91 40 2301 6104'
  },
  {
    id: 'b_mnc26',
    branch_code: 'MnC26',
    branch_name: 'Mathematics & Computing (2026 Batch)',
    fa_name: 'Dr. C. S. Sastry',
    fa_email: 'fa.mnc26@iith.ac.in',
    fa_number: '+91 40 2301 6105'
  },
  {
    id: 'b_ai26',
    branch_code: 'AI26',
    branch_name: 'Artificial Intelligence (2026 Batch)',
    fa_name: 'Dr. Vineeth N Balasubramanian',
    fa_email: 'fa.ai26@iith.ac.in',
    fa_number: '+91 40 2301 6106'
  },
  {
    id: 'b_me26',
    branch_code: 'ME26',
    branch_name: 'Mechanical & Aerospace Engineering (2026 Batch)',
    fa_name: 'Dr. Ashok Kumar Pandey',
    fa_email: 'fa.me26@iith.ac.in',
    fa_number: '+91 40 2301 6107'
  },
  {
    id: 'b_ce26',
    branch_code: 'CE26',
    branch_name: 'Civil Engineering (2026 Batch)',
    fa_name: 'Dr. Sireesh Saride',
    fa_email: 'fa.ce26@iith.ac.in',
    fa_number: '+91 40 2301 6108'
  },
  {
    id: 'b_bt26',
    branch_code: 'BT26',
    branch_name: 'Biomedical Engineering & Biotechnology (2026 Batch)',
    fa_name: 'Dr. Renu John',
    fa_email: 'fa.bt26@iith.ac.in',
    fa_number: '+91 40 2301 6109'
  }
];

export const CR_TABLE: CRTableEntry[] = [
  { email: 'cs26btech11001@iith.ac.in', branch: 'CS26' },
  { email: 'cs26btech11002@iith.ac.in', branch: 'CS26' },
  { email: 'ee26btech11002@iith.ac.in', branch: 'EE26' },
  { email: 'mc26btech11003@iith.ac.in', branch: 'MnC26' },
  { email: 'ai26btech11001@iith.ac.in', branch: 'AI26' },
  { email: 'me26btech11001@iith.ac.in', branch: 'ME26' },
  { email: 'ce26btech11001@iith.ac.in', branch: 'CE26' },
  { email: 'bt26btech11001@iith.ac.in', branch: 'BT26' },
  { email: 'cs25btech11001@iith.ac.in', branch: 'CS25' },
  { email: 'ee25btech11001@iith.ac.in', branch: 'EE25' }
];

export const HR_TABLE: HRTableEntry[] = [
  { email: 'hr.vivekananda@iith.ac.in', hostel: 'Vivekananda' },
  { email: 'cs26btech11004@iith.ac.in', hostel: 'Vivekananda' },
  { email: 'ee26btech11004@iith.ac.in', hostel: 'Vivekananda' },
  { email: 'mc26btech11004@iith.ac.in', hostel: 'S.N. Bose' },
  { email: 'ai26btech11004@iith.ac.in', hostel: 'S.N. Bose' },
  { email: 'cs26btech11006@iith.ac.in', hostel: 'Kalpana Chawla' },
  { email: 'ee26btech11006@iith.ac.in', hostel: 'Kalpana Chawla' }
];

export const BRANCH_PREFIX_MAP: Record<string, string> = {
  cs: 'CS',
  ee: 'EE',
  mc: 'MnC',
  ma: 'MnC',
  ai: 'AI',
  me: 'ME',
  ce: 'CE',
  bt: 'BT'
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
      branch: 'CS26',
      admissionYear: 2026,
      rollNo: '',
      role: 'Normal Student',
      hostel: 'Vivekananda',
      error: 'Email must match format: (2-letter branch)(2-digit year)btech(5-digit number)@iith.ac.in (e.g. cs26btech11001@iith.ac.in)'
    };
  }

  const rawBranchCode = match.groups.branchCode.toLowerCase();
  const yearDigitsStr = match.groups.year;
  const yearDigits = parseInt(yearDigitsStr, 10);
  const admissionYear = 2000 + yearDigits;
  const rollNo = email.replace(/@iith\.ac\.in$/i, '');

  const branchPrefix = BRANCH_PREFIX_MAP[rawBranchCode] || rawBranchCode.toUpperCase();
  // Form branch code like CS26, CS25, EE26, MnC26
  const inferredBranch: Branch = `${branchPrefix}${yearDigitsStr}`;

  const crEntry = CR_TABLE.find(entry => entry.email.toLowerCase() === email);
  const hrEntry = HR_TABLE.find(entry => entry.email.toLowerCase() === email);

  let role: Role = 'Normal Student';
  if (crEntry) {
    role = 'CR';
  } else if (hrEntry) {
    role = 'HR';
  }

  const hostel = hrEntry?.hostel || (branchPrefix === 'MnC' ? 'S.N. Bose' : 'Vivekananda');

  return {
    isValid: true,
    branch: crEntry?.branch || inferredBranch,
    admissionYear,
    rollNo,
    role,
    hostel
  };
};

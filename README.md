# IRIS — IITH Resources & Information System

A comprehensive, responsive campus management portal and academic scheduling system designed specifically for **Indian Institute of Technology Hyderabad (IIT Hyderabad) (IITH)** students, Class Representatives (CRs), and Hostel Representatives (HRs).

## 🚀 Key Features

- **Personalized Dashboard (`/dashboard`)**: Daily schedule briefing, live lecture status (Ongoing/Upcoming), enrolled course summary, priority announcements, and campus forum highlights.
- **Dynamic Weekly Timetables & Schedules (`/schedules`)**:
  - Weekly recurring lecture slots with schedule validity bounds.
  - Date-specific exception overrides (cancellations, room swaps, extra makeup classes).
  - Mid-Semester, End-Semester, and Quiz exam timelines with assigned halls and slots.
  - Three viewing modes: Weekly List View, Interactive Calendar Grid View, and Today's Summary Timeline.
- **Institute Announcements (`/announcements`)**:
  - Role-gated publishing: CRs broadcast academic announcements to branches; HRs broadcast hostel notices to residents.
  - Priority tags (`URGENT`, `IMPORTANT`, `EXAM`, `LECTURE`, `INFO`).
  - Rich text Markdown editor with KaTeX LaTeX math formula rendering.
- **Collaborative Campus Forum (`/forum`)**:
  - Scoped discussion channels (`Academic`, `Announcement Discussion`, `TimePass`).
  - Visibility access levels: Public (institute-wide), Branch-only, or Hostel-only.
  - Threaded replies, comment editing, soft deletion, and search.
- **Academic Resources Repository (`/resources`)**:
  - Branch-specific hierarchical folder tree.
  - In-browser preview for Markdown notes and code files.
  - Native file downloads and file metadata tracking.
- **Curriculum Catalog & Course Enrollment (`/curriculum`)**:
  - Built for IITH's 6-segment fractal academic calendar.
  - Faculty directory with designations, emails, and office locations.
  - Course enrollment toggle (active course tracking & credit calculation).
- **Airtable Live Cloud Sync**:
  - Bidirectional synchronization across 12 Airtable database tables.
  - Express server proxy with rate-limit handling and real-time status diagnostics.
- **Role-Based Access Control (RBAC)**:
  - Normal Student, Class Representative (CR), and Hostel Representative (HR).
  - Automated identity inference from standard IITH email format (`<branch><year>btech<roll>@iith.ac.in`).

---

## 🛠️ Quick Start

```bash
# Install all dependencies
npm install

# Run development server (Express + Vite)
npm run dev
# Build for production
npm run build
```

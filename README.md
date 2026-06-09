# Portal Sana - Cavite State University Bacoor Student Portal

A Next.js 15 student portal for Cavite State University Bacoor City Campus, supporting grade management, student administration, curriculum tracking, and COG (Certificate of Grades) PDF generation.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui (Radix), TanStack Table |
| Backend | Next.js API Routes & Server Actions, Node.js |
| Database | PostgreSQL + Prisma ORM |
| Caching/Rate Limiting | Redis (Upstash) |
| Auth | Clerk (multi-role RBAC) |
| File Processing | SheetJS (xlsx), PapaParse, jsPDF |
| Validation | Zod |
| Fuzzy Matching | fast-fuzzy |

---

## Getting Started

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
# Opens at http://localhost:3000
```

### Environment Variables

Create a `.env` file with:

```
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."
UPSTASH_REDIS_URL="redis://..."
UPSTASH_REDIS_TOKEN="..."
```

---

## User Roles & Permissions

| Role | Description | Key Capabilities |
|---|---|---|
| `student` | Enrolled student | View own grades, checklists, COG, enrollment |
| `faculty` | Faculty member | Upload grades (Excel/manual), view students |
| `registrar` | Registrar staff | Grade CRUD, approve students, COG generation |
| `admin` | Administrator | Full system management, upload toggle |
| `superuser` | Super admin | Admin creation, all permissions |
| `csg` | Student government | Announcements, events |

---

---

## Faculty Grade Upload Flow

This section documents the complete workflow for how a **faculty member** uploads student grades to the portal, covering both Excel batch upload and manual single-grade entry.

### 1. Authentication & Access Control

```
Faculty logs in → Clerk Auth → Middleware checks role → Route access granted to /list/uploading
```

- **Auth Provider**: Clerk handles sign-in/sign-up with role stored in `publicMetadata.role = "faculty"`
- **Middleware** (`middleware.ts`): Verifies session claims, checks `routeAccessMap` — only `["admin", "superuser", "faculty"]` can access `/list/uploading(.*)`
- **Page-level check**: The upload page (`app/(dashboard)/list/uploading/page.tsx`) also verifies:
  - `UPLOAD_GRADES_ENABLED` system setting (admins can toggle this globally)
  - If disabled for non-admins, shows `<UploadSystemDisabled />` with a lock message

### 2. Upload Page Overview

**Route**: `/list/uploading`

The page has **two tabs**:

| Tab | Component | Purpose |
|---|---|---|
| **Excel Upload** | `<UploadGrades />` | Drag-and-drop/select `.xlsx` or `.csv` file for batch upload |
| **Manual Entry** | `<ManualGradeEntry />` | Search a student and enter a single grade via form |

**Admin toggles** (visible to admin/superuser only):

| Toggle | System Setting Key | Effect |
|---|---|---|
| `<AdminUploadToggle />` | `UPLOAD_GRADES_ENABLED` | Enables/disables the entire upload system |
| `<GradeVisibilityToggle />` | `GRADES_VISIBLE` | Shows/hides grades from students |

### 3. Excel Batch Upload Flow (Faculty)

#### 3a. File Requirements

| Property | Constraint |
|---|---|
| Format | `.xlsx` (Excel) or `.csv` |
| Max file size | 2 MB |
| Max rows per file | 5,000 |

#### 3b. Expected Excel Column Headers

| Column | Required | Format | Notes |
|---|---|---|---|
| `studentNumber` | **Yes** | String (e.g., `2023101234`) | Dashes stripped, used for primary lookup |
| `courseCode` | **Yes** | e.g., `CS 101`, `MATH204A` | Validated against regex `(Letters)(Numbers)(OptLetters)` |
| `grade` | **Yes** | `1.00`-`5.00`, `INC`, `DRP`, `P`, `F` | Matches `GRADE_HIERARCHY` in `lib/utils.ts` |
| `firstName` | No | String | Used for name-based fuzzy matching fallback |
| `lastName` | No | String | Used for name-based fuzzy matching fallback |
| `courseTitle` | No | String | Fuzzy-matched against curriculum as fallback |
| `creditUnit` | No | Number | Auto-corrected from curriculum if mismatch detected |
| `reExam` | No | Grade string | Re-examination grade if applicable |
| `remarks` | No | String | Passed/Failed/Conditioned/etc. |
| `instructor` | No | String | **Faculty**: auto-forced to own name; mismatches rejected |

> **Template:** See the "Download Template" button in the UI or use the example at the bottom of this README.

#### 3c. Step-by-Step Upload Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│ STEP 1: Faculty navigates to /list/uploading                              │
│   • Page checks: is authenticated? is upload enabled?                    │
│   • Faculty sees the "Excel Upload" tab (default)                        │
└───────────────────────┬──────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ STEP 2: Faculty selects academic year & semester                         │
│   • Faculty restricted to CURRENT academic year only                     │
│   • Dropdown populates from AcademicTerm table                           │
│   • Faculty CANNOT upload to: FIRST semester or MIDYEAR (validation)     │
└───────────────────────┬──────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ STEP 3: Faculty drags-and-drops or selects .xlsx/.csv file               │
│   • react-dropzone handles file selection                                │
│   • Client-side validation via Zod schema (gradeRowSchema)               │
│   • File parsed: XLSX → JSON via SheetJS, CSV → JSON via PapaParse       │
│   • Preview table displayed with parsed data                             │
└───────────────────────┬──────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ STEP 4: Faculty chooses upload mode                                      │
│   • "Validate Only" (dry-run): validates without saving — safe preview   │
│   • "Upload Grades": full commit                                         │
│   • "Save Draft": persists state to localStorage + Redis (24hr TTL)      │
└───────────────────────┬──────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ STEP 5: Client sends batches (50 rows each) to POST /api/upload-grades   │
│   • Each batch is a JSON payload: { academicYear, semester, grades[] }   │
│   • validateOnly flag controls dry-run vs. commit                        │
└───────────────────────┬──────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ STEP 6: Server-side processing (per batch) — see Section 4 below         │
└───────────────────────┬──────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ STEP 7: Results displayed with color-coded match quality                 │
│   • ✅ Green (exact)     — Perfect ID+code match, no changes             │
│   • 🟡 Yellow (fuzzy)    — Fuzzy name/code match, auto-corrected         │
│   • 🟠 Orange (warning)  — Cross-program, credit corrected, legacy       │
│   • 🔵 Blue (updated)    — Existing grade updated (shows what changed)    │
│   • 🔴 Red (error)       — Validation failure, student not found, etc.   │
│   • ⬜ Gray (unchanged)  — Grade already existed, identical values        │
│   • Export button available to download results as .xlsx                 │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4. Server-Side Processing Pipeline (`POST /api/upload-grades`)

This is the core engine (1112 lines in `app/api/upload-grades/route.ts`):

#### 4a. Pre-Flight Checks

1. **Authentication**: `auth()` + `currentUser()` from Clerk — returns 401 if not authenticated
2. **Rate Limiting**: Faculty: **15 requests per 15 minutes** (Redis-based `rate-limiter-flexible`). Admins: 60 req/15min. Returns 429 with retry-after on limit.
3. **System Disabled Check**: Queries `SystemSettings` table for `UPLOAD_GRADES_ENABLED` — returns 403 for faculty if disabled
4. **Batch Size Guard**: Max 5,000 rows per request — returns 413 if exceeded
5. **Term Validation**: Academic year + semester must exist in `AcademicTerm` table — returns 404 if not initialized

#### 4b. Student Resolution (Multi-Pass Fuzzy Matching)

```
For each row in batch:
  ├─ Primary: Exact match on studentNumber in Student table
  ├─ Secondary: Fuzzy name matching (fast-fuzzy, threshold 0.85)
  ├─ ID + Name cross-validation (see matching rules below)
  └─ Fallback: Name-only recovery when studentNumber is missing/wrong
```

**ID + Name resolution matrix:**

| DB studentNumber match? | DB name match? | Result |
|---|---|---|
| ✅ Yes | ✅ Exact match | `ID_MATCH` — ID confirmed |
| ✅ Yes | ⚠️ Fuzzy (≥0.70 relaxed) | `ID_MATCH_FUZZY` — likely typo, proceed |
| ✅ Yes | ❌ No match | ❌ Error: "Name mismatch: ID belongs to X but file says Y" |
| ❌ No | ✅ Name found | `NAME_RECOVERY` — recovered by name, warning issued |
| ❌ No | ❌ Name not found | ❌ Error: "Student not found" |

#### 4c. Course Code Validation & Resolution

```
For each row:
  ├─ Validate format: regex /^([A-Za-z]+)(\d+)([A-Za-z]*)$/
  │   • "CS101" → valid → normalized to "CS 101"
  │   • "c.s.101" → valid → normalized to "CS 101"
  │   • "COMPSCI" → INVALID (no numbers) → rejected
  │
  ├─ Match against curriculum (4 priority levels):
  │   1. CourseCode + Student's Course + Student's Major → exact program match
  │   2. CourseCode + Student's Course (ignore major) → program match
  │   3. CourseCode across all curricula (GE/shared subjects) → cross-check
  │      ⚠️ If subject belongs to a DIFFERENT program → REJECTED
  │   4. Fuzzy course code match (threshold 0.85) in student's curriculum
  │   5. Course title fuzzy match (threshold 0.80) as fallback
  │
  └─ If no match and NOT legacy mode → ❌ "Subject not found in any curriculum"
```

#### 4d. Faculty-Specific Restrictions

1. **Instructor Name Verification**: If the Excel file includes an instructor column, the value is normalized (strips titles like "Prof", "Dr", "Engr") and fuzzy-matched against the faculty user's Clerk profile name. If score < 0.80 → **REJECTED**
2. **Forced Instructor Name**: If the instructor column passes verification (or is empty), the server forcibly sets `instructor` to the faculty user's full name (uppercased)
3. **Overwrite Protection**: Faculty can only overwrite grades where `uploadedBy === faculty's own name`. Cannot overwrite grades uploaded by other faculty/admins → **REJECTED**
4. **Academic Year Restriction**: Faculty is restricted to the current academic year only

#### 4e. Grade Normalization & Deduplication

- Grade values normalized via `GRADE_HIERARCHY` constant: `1.00`, `1.25`, `1.50`, ..., `5.00`, `INC`, `DRP`, `P`, `F`
- Numeric grades converted to 2-decimal strings (e.g., `1.5` → `1.50`)
- Within a batch: duplicate `[studentNumber, courseCode]` pairs detected — last entry wins, warning issued
- Existing grade check: if grade is identical (grade, reExam, remarks, instructor) → skipped with "no changes" status
- Credit unit auto-correction: if Excel credit units differ from curriculum → overwritten from curriculum, warning issued

#### 4f. Database Transaction

All successful grades in a batch are committed in a **single Prisma transaction**:

```typescript
await prisma.$transaction([
  // Upsert each grade (create if new, update if exists)
  ...gradesToUpsert.map((gradeData) =>
    prisma.grade.upsert({
      where: { studentNumber_courseCode_academicYear_semester },
      create: { /* all fields + subjectOffering link */ },
      update: { /* grade, reExam, remarks, instructor */ },
    })
  ),
  // Bulk insert audit logs
  prisma.gradeLog.createMany({ data: logsToCreate, skipDuplicates: true }),
]);
```

**Failed row logs** are saved separately (outside transaction) so they persist even if the main transaction fails:

```typescript
prisma.gradeLog.createMany({ data: failedLogsToCreate, skipDuplicates: true });
```

### 5. Manual Grade Entry Flow

**Location**: `components/ManualGradeEntry.tsx` (1362 lines)
**Access**: Admins, superusers, and registrars only (not faculty via this method)

```
┌──────────────────────────────────────────────────────────────┐
│ STEP 1: Select "Manual Entry" tab                            │
└───────────────┬──────────────────────────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 2: Search for a student                                 │
│   • By Student Number (partial match)                        │
│   • By Name (first or last name, partial match)              │
│   • Results shown in paginated table                         │
└───────────────┬──────────────────────────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 3: Select student → fills form with their details       │
│   • Shows: studentNumber, name, course, major, status        │
│   • Shows: existing grades for selected term                 │
└───────────────┬──────────────────────────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 4: Enter grade details                                  │
│   • Academic Year + Semester (dropdown)                      │
│   • Course Code + Course Title + Credit Units                │
│   • Grade (dropdown: 1.00-5.00, INC, DRP)                   │
│   • Re-examination grade (optional)                          │
│   • Remarks (Passed/Failed/Conditioned/Incomplete/Dropped)   │
│   • Instructor name                                          │
└───────────────┬──────────────────────────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 5: Validation before submit                             │
│   • Checks for duplicate grade (same student+course+term)    │
│   • Validates all required fields                            │
│   • Confirms via SweetAlert2 dialog                          │
└───────────────┬──────────────────────────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 6: Calls addManualGrade() server action                 │
│   • Creates AcademicTerm if it doesn't exist                 │
│   • Links to SubjectOffering if available                    │
│   • Inserts GradeLog audit entry                             │
└──────────────────────────────────────────────────────────────┘
```

### 6. Audit Trail (GradeLog)

Every grade operation creates a `GradeLog` entry recording:

| Field | Description |
|---|---|
| `studentNumber` | Student affected |
| `courseCode` | Course code |
| `grade` | Grade value |
| `action` | `CREATED`, `UPDATED`, `FAILED`, `LEGACY_ENTRY`, `MANUAL_ENTRY` |
| `remarks` | Error reason or success context |
| `instructor` | Instructor name used |
| `performedAt` | Timestamp (auto) |

Failed upload rows are also logged with `action: "FAILED"` and the specific error message in `remarks`.

### 7. Rate Limiting Summary

| Endpoint | Faculty Limit | Admin Limit |
|---|---|---|
| `POST /api/upload-grades` | 15 req / 15 min | 60 req / 15 min |
| `POST /api/upload` (student bulk) | N/A | 20 req / 10 sec (by IP) |

Rate limits are enforced server-side via Redis using `rate-limiter-flexible`. When exceeded, returns HTTP 429 with retry-after information.

### 8. System Settings Toggles

| Key | Values | Effect |
|---|---|---|
| `UPLOAD_GRADES_ENABLED` | `"true"` / `"false"` | Globally enables/disables grade upload |
| `GRADES_VISIBLE` | `"true"` / `"false"` | Shows/hides grades from students |
| `ALLOW_LEGACY_UPLOAD` | — | Allows subjects not in curriculum (admin/registrar only) |

### 9. Database Models (Grade-Related)

```
Grade
├── studentNumber (FK → Student)
├── courseCode, courseTitle, creditUnit
├── grade, reExam?, remarks?
├── instructor
├── academicYear, semester (FK → AcademicTerm)
├── uploadedBy (who performed the upload)
├── attemptNumber (default: 1)
├── isRetaken, retakenAYSem?
└── subjectOfferingId? (FK → SubjectOffering)

GradeLog (audit trail)
├── studentNumber, courseCode, courseTitle, creditUnit
├── grade, remarks, instructor
├── academicYear, semester
├── action (CREATED | UPDATED | FAILED | LEGACY_ENTRY | MANUAL_ENTRY)
├── importedName (what the file/entry had)
└── performedAt (timestamp)

unique_grade_per_term: [studentNumber, courseCode, academicYear, semester]
```

### 10. API Endpoints Reference

| Endpoint | Method | Roles | Purpose |
|---|---|---|---|
| `/api/upload-grades` | POST | admin, superuser, registrar, faculty | Batch grade upload |
| `/api/preview-grades` | GET | all (own grades only) | View grades |
| `/api/preview-grades` | PATCH | admin, superuser, registrar | Edit grade |
| `/api/preview-grades` | DELETE | admin, superuser, registrar | Delete grade |
| `/api/academic-terms` | GET | all | List academic terms |
| `/api/upload-state` | GET/POST/DELETE | all | Upload form state (Redis) |
| `/api/subject-offerings` | GET | admin, superuser | Active subject offerings |

---

## Excel Template Example

Faculty can download the template from the UI. Expected format:

| studentNumber | firstName | lastName | courseCode | grade | courseTitle | creditUnit | reExam | remarks | instructor |
|---|---|---|---|---|---|---|---|---|---|
| 2023101234 | Juan | Dela Cruz | CS 101 | 1.50 | Intro to Computing | 3 | | Passed | |
| 2023101234 | Juan | Dela Cruz | MATH 204A | 2.75 | Calculus II | 4 | 2.00 | Conditioned | |
| 2023105678 | Maria | Santos | CS 101 | 1.25 | Intro to Computing | 3 | | Passed | |

> **Note for Faculty**: The `instructor` column is optional in the file. If provided, it must match your account name (case-insensitive, titles stripped). If empty, the system automatically uses your name.

---

## Development

```bash
# Run dev server
npm run dev

# Run tests
npm test

# Run specific test
npm test -- upload-grades-security

# Prisma studio (database GUI)
npx prisma studio

# Lint
npm run lint
```

## Deployment

This application is designed for deployment on **Vercel** with:
- PostgreSQL (Vercel Postgres / Supabase / Railway)
- Redis (Upstash Redis) for rate limiting and state persistence
- Clerk for authentication

```bash
npx prisma migrate deploy
npm run build
```

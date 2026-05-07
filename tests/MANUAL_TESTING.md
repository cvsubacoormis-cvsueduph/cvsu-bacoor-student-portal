# Manual Testing Guide — Security Fixes

## Prerequisites

```bash
npm run dev   # Start dev server on http://localhost:3000
```

---

## 1. Testing API Route Auth Guards (without Clerk session)

These tests verify that unauthenticated requests return 401. Use **curl** or PowerShell:

### 1a. DELETE /api/students — no auth → 401

```bash
curl -s -o /dev/null -w "%{http_code}" -X DELETE "http://localhost:3000/api/students?id=test-123"
# Expected: 401
```

```powershell
Invoke-WebRequest -Method DELETE -Uri "http://localhost:3000/api/students?id=test-123" | Select-Object StatusCode
# Expected: 401
```

### 1b. DELETE /api/bulk-delete — no auth → 401

```bash
curl -s -o /dev/null -w "%{http_code}" -X DELETE "http://localhost:3000/api/bulk-delete"
# Expected: 401
```

### 1c. POST /api/announcements — no auth → 401

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:3000/api/announcements" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","dateFrom":"2025-01-01","startTime":"2025-01-01","endTime":"2025-01-01"}'
# Expected: 401
```

### 1d. POST /api/events — no auth → 401

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:3000/api/events" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","dateFrom":"2025-01-01","startTime":"2025-01-01","endTime":"2025-01-01"}'
# Expected: 401
```

### 1e. POST /api/news — no auth → 401

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:3000/api/news" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","category":"General","content":"Desc","important":false,"author":"Admin"}'
# Expected: 401
```

### 1f. News POST with malformed JSON → 401 (not 500)

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:3000/api/news" \
  -H "Content-Type: application/json" \
  -d '{malformed'
# Expected: 401
```

### 1g. GET /api/check-approval — no auth → 401

```bash
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/check-approval"
# Expected: 401
```

### 1h. Spoofed header check — still 401

```bash
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/check-approval" \
  -H "x-user-id: admin-123"
# Expected: 401 (header is no longer trusted)
```

---

## 2. Testing Role-Based Access (with Clerk session)

### Setup
1. Open `http://localhost:3000` in your browser
2. Sign in as each role: **Student**, **Faculty**, **Admin**
3. For each role, open **DevTools → Console** and run the fetch commands below

### 2a. Student tries to delete another student → 403

```js
// In browser console, signed in as STUDENT
fetch("/api/students?id=some-student-id", { method: "DELETE" })
  .then(r => console.log(r.status, r.statusText))
// Expected: 403 Forbidden
```

### 2b. Faculty tries to bulk-delete → 403

```js
// In browser console, signed in as FACULTY
fetch("/api/bulk-delete", { method: "DELETE" })
  .then(r => console.log(r.status, r.statusText))
// Expected: 403 Forbidden
```

### 2c. Student tries to create an announcement → 403

```js
// In browser console, signed in as STUDENT
fetch("/api/announcements", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: "Hacked", dateFrom: new Date(), startTime: new Date(), endTime: new Date() })
}).then(r => console.log(r.status, r.statusText))
// Expected: 403 Forbidden
```

### 2d. Student tries to create an event → 403

```js
// In browser console, signed in as STUDENT
fetch("/api/events", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: "Hacked", dateFrom: new Date(), startTime: new Date(), endTime: new Date() })
}).then(r => console.log(r.status, r.statusText))
// Expected: 403 Forbidden
```

### 2e. Student tries to create news → 403

```js
// In browser console, signed in as STUDENT
fetch("/api/news", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: "Hacked", category: "General", content: "X", important: false, author: "Me" })
}).then(r => console.log(r.status, r.statusText))
// Expected: 403 Forbidden
```

### 2f. Admin creates announcement → 201

```js
// In browser console, signed in as ADMIN
fetch("/api/announcements", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: "Test", dateFrom: new Date(), startTime: new Date(), endTime: new Date() })
}).then(r => console.log(r.status, r.statusText))
// Expected: 201 Created
```

### 2g. Admin deletes announcement → 200

```js
// Replace 1 with the actual announcement ID created above
fetch("/api/announcements?id=1", { method: "DELETE" })
  .then(r => console.log(r.status, r.statusText))
// Expected: 200 OK
```

---

## 3. Testing Password Generation (via UI)

### 3a. Create a user (Admin → Create User form)
1. Sign in as **Admin**
2. Navigate to `/list/create-user`
3. Fill out the form and submit
4. **Check the response** in DevTools → Network tab — look for `generatedPassword` in the response. It should be a 24-character hex string like `a1b2c3d4e5f6...`
5. **New**: The password should be displayed in a toast notification (frontend update needed — see notes)

### 3b. Create a single student
1. Sign in as **Admin**
2. Navigate to `/list/students/create`
3. Fill out the form and submit
4. Check DevTools → Network → Response for `generatedPassword`

### 3c. Bulk upload students
1. Sign in as **Admin**
2. Navigate to `/list/uploading`
3. Upload an Excel file with student data
4. Check DevTools → Network → Response for `createdStudents` array with `{ studentNumber, generatedPassword }` pairs

---

## 4. Testing UI Navigation (Middleware Enforced)

### 4a. Student tries to access admin pages
1. Sign in as **Student**
2. Try navigating to `/admin`, `/list/students`, `/list/approve-students`
3. **Expected**: Redirected to `/student`

### 4b. Admin accesses admin pages
1. Sign in as **Admin**
2. Navigate to `/list/students`, `/list/announcements`, `/list/approve-students`
3. **Expected**: Pages load normally

---

## 5. Quick Smoketest (Admin)

After signing in as admin, verify these pages still work:

| Page | URL | Expected |
|------|-----|----------|
| Dashboard | `/admin` | Loads with stats |
| Students List | `/list/students` | Shows student table |
| Create Student | `/list/students/create` | Form renders |
| Announcements | `/list/announcements` | Shows table, create/delete works |
| Events | `/list/events` | Shows table, create/delete works |
| News | `/list/news` | Shows content, CRUD works |
| Curriculum | `/list/curriculum` | Shows table, delete works |
| Subject Offering | `/list/subject-offering` | Shows offerings |
| Grade Upload | `/list/uploading` | Shows upload form |
| Grade Lists | `/list/grades-lists` | Shows grade data |
| Bulk Upload Users | `/list/create-user` | Shows forms |
| Admin Lists | `/list/admin-lists` | Shows user list, delete works |
| Approve Students | `/list/approve-students` | Shows pending, approve/reject works |
| Faculty Monitoring | `/list/faculty-monitoring` | Shows faculty status |
| Logs | `/list/logs` | Shows grade logs |

---

## Notes

- **Password display in UI**: The backend now returns `generatedPassword` but the frontend components (`create-user-form.tsx`, `students/create/page.tsx`, `bulk-upload-users.tsx`) don't yet display it. You'll see the password in Network tab responses but not in a toast. This is a follow-up UI task.

- **Clerk session required**: For API calls that test role-based access (section 2), you MUST be signed in through the browser. The Clerk session cookie will automatically be included in `fetch()` calls.

- **Automated tests**: Run `npx vitest run` to execute the 43 automated tests that verify all auth/role guards.

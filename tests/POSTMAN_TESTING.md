# Postman / Manual Testing Guide

## Getting Your Auth Token

### Option A — From Browser (easiest)

1. Open `http://localhost:3000` and sign in as **Admin**
2. Open DevTools (F12) → **Application** tab → **Cookies** → `localhost`
3. Copy the value of `__session` (the Clerk JWT token)
4. In Postman, under **Authorization** tab:
   - Type: `Bearer Token`
   - Paste the `__session` value

### Option B — From a fetch in Console

1. Sign in as admin in the browser
2. In DevTools Console, run:
```js
copy(document.cookie.match(/__session=([^;]+)/)[1])
```
3. This copies the token to your clipboard — paste it into Postman's Bearer Token field

### Option C — Create test tokens via Clerk Dashboard

1. Go to Clerk Dashboard → your app → JWT Templates
2. Create a test token with the right metadata (`role: "admin"` or `role: "student"`)
3. Use that in Postman

---

## Postman Tests

### 1. Auth Guard Tests (no token needed)

| Method | URL | Expected |
|--------|-----|----------|
| `DELETE` | `http://localhost:3000/api/students?id=any` | `401 Unauthorized` |
| `DELETE` | `http://localhost:3000/api/bulk-delete` | `401 Unauthorized` |
| `GET`   | `http://localhost:3000/api/check-approval` | `401 Unauthorized` |
| `POST`  | `http://localhost:3000/api/events` | `401 Unauthorized` |

### 2. Role Guard Tests (student token)

Use Postman's **Environment Variables** to save your student Bearer token:

1. Create environment → add variable `student_token`
2. All requests below use `Authorization: Bearer {{student_token}}`

| Method | URL | Expected |
|--------|-----|----------|
| `DELETE` | `http://localhost:3000/api/students?id=any` | `403 Forbidden` |
| `DELETE` | `http://localhost:3000/api/bulk-delete` | `403 Forbidden` |
| `POST`  | `http://localhost:3000/api/announcements` | `403 Forbidden` |
| `POST`  | `http://localhost:3000/api/events` | `403 Forbidden` |
| `POST`  | `http://localhost:3000/api/news` | `403 Forbidden` |

### 3. Rate Limit Stress Test (admin token, Postman Runner)

1. Create a new request: `DELETE http://localhost:3000/api/students?id=any`
   - Auth: Bearer Token (admin)
2. Click the request name → **Duplicate** to make copies, or use **Collection Runner**
3. In Postman Runner:
   - Select the collection
   - **Iterations: 15** (limit is 10/min for student delete)
   - **Delay: 100ms** between requests
   - Click **Run**

**Expected**: First ~10 requests return `200 OK`, then requests 11+ return:
```json
{
  "error": "Too many requests. Please try again in X seconds.",
  "retryAfter": 45
}
```
Status: `429 Too Many Requests`
Headers: `Retry-After: 45`

### 4. Single-Request Rate Limit Test

For a quick test, send the same request rapidly 12 times:

```
DELETE http://localhost:3000/api/students?id=test
Authorization: Bearer {{admin_token}}
```

Use Postman's **Request Sending** → hold `Ctrl+Enter` to send rapidly.

---

## Key Test Scenarios

### Test A: Auth beats rate limit
```
SEND (no token): DELETE /api/students?id=test
→ 401 (NOT 429 — auth checked first)
```

### Test B: Role beats rate limit
```
SEND (student token): POST /api/announcements
BODY: { "title": "Test", "dateFrom": "2025-01-01", "startTime": "2025-01-01", "endTime": "2025-01-01" }
→ 403 (NOT 429 — role checked first)
```

### Test C: Independent rate limits
```bash
# Hit student DELETE 11 times → gets 429
# Then immediately hit event POST → still works (separate limit)
SEND (admin): POST /api/events
BODY: { "title": "Test", "dateFrom": "2025-01-01", "startTime": "2025-01-01", "endTime": "2025-01-01" }
→ 201 Created
```

### Test D: check-approval spoofing (header ignored)
```
SEND (no token): GET /api/check-approval
HEADER: x-user-id: forged-admin-id
→ 401 (header is no longer trusted — Clerk auth() is used)
```

### Test E: Malformed JSON → 401 not 500
```
SEND (no token): POST /api/news
BODY: {malformed
→ 401 (not 500 — body not parsed before auth check)
```

### Test F: Upload grades rate limit (all roles)
```
SEND (admin token): POST /api/upload-grades
BODY: [{ studentNumber: "123456789", courseCode: "IT101", ... }]
→ Send rapidly 65 times
→ 429 after ~60 requests (admin limit is 60/15min)
```

---

## curl Equivalents

```bash
# Get your __session cookie from browser, then:

# Auth guard
curl -s -w "\n%{http_code}\n" -X DELETE "http://localhost:3000/api/students?id=test"
# → 401

# Role guard (student)
curl -s -w "\n%{http_code}\n" -X DELETE "http://localhost:3000/api/students?id=test" \
  -H "Authorization: Bearer eyJ..your_student_token"
# → 403

# Rate limit test (admin) — send 12 rapid requests
for i in {1..12}; do
  curl -s -o /dev/null -w "$i: %{http_code} | Retry-After: " \
       -D - -X DELETE "http://localhost:3000/api/students?id=test" \
       -H "Authorization: Bearer eyJ..your_admin_token" 2>/dev/null | grep -o "429\|200\|Retry-After:.*"
done

# Check approval spoof
curl -s -w "\n%{http_code}\n" "http://localhost:3000/api/check-approval" \
  -H "x-user-id: forged-id"
# → 401 (not 200)
```

---

## Automated Test Reference

If Postman is too slow, the automated tests cover all scenarios:

```bash
npx vitest run                     # All 52 tests
npx vitest run tests/rate-limit-stress.test.ts  # Just rate limit tests
```

Test file at `tests/rate-limit-stress.test.ts` tests:
- 429 responses with Retry-After header
- Informative error messages with specific wait times
- Auth > rate limit priority (401 beats 429)
- Role > rate limit priority (403 beats 429)
- Independent rate limit counters per action

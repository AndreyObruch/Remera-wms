# Dossier · WMS "REMEMERA" v2.0 "Internal Contour"
Updated: 2026-09-06. Stage closed: Phase 2 (posting), cleanup (R5/R6), end-to-end test of Phase 1.

## 0. Rules
0.1. One command per response, step by step; comments brief and to the point.
0.2. File for replacement: full text + exact path; verify that the file appears in the GitHub Desktop change list; after commit — Push origin (check the button); build marker/behavior — indicator of arrival ("build", alert, behavior).
0.3. No migration to a new chat; after each closed stage — updated DOSSIER.md as a file.
0.4. Footer: "📊 Fill rate ~X% | Compression".

## 1. Goal
Worker: phone → PIN → report in chat. Director: queue → "Execute" → balance changes on the server side. No MAX/Telegram. Data — Blob private. Evolution: accountant role.

## 2. Architecture
Domain: https://remera-wms-bvii.vercel.app (two i's). Chat: /chat.html (session in localStorage; "Logout"/incognito).
chat.html → /api/auth, /api/chat, /api/approve → lib/core.js + lib/store.js v13 → Blob remera-private (wms2/state.json).
SDK @vercel/blob latest: access:'private' on all operations; allowOverwrite:true; get() = {statusCode, stream, headers, blob}; body reading: blob.blob.text() or new Response(blob.stream).text().

## 3. Data (wms2/state.json)
{version, stock:{CODE:qty}, pending:[], movements:[], messages:[]}
approve → movements + stock by sign; protection against negative balance; repeated posting → 404 "Posting not found" (safe).

## 4. Env (reference)
WORKER_PIN=1234, DIRECTOR_PIN=5678, PRIV_READ_WRITE_TOKEN, PRIV_STORE_ID, PRIV_WEBHOOK_PUBLIC_KEY. MAX_*/TELEGRAM_* have been deleted.

## 5. Files
Working: chat.html, api/auth.js, api/chat.js v2 (with server logs), api/approve.js v2, lib/core.js, lib/store.js v13.
Deleted: api/debug.js, bot files, old store. To be created: api/stock.js, accountant interface.

## 6. Completed
Repair (store, SDK, PIN) → end-to-end test of Phase 1 (worker+director) → cleanup (debug.js, Env) → Phase 2: approve.js v2; tests 06.09: protection against negative (alert, card remains), receipt 0→10, issue 10→5. All passed.

## 7. Lessons (new)
7.1 NOT_FOUND at new endpoint = commit hasn't arrived (Push not pressed).
7.2 Double-click on "Execute": first POST posts, second gives 404 alert — data intact; UX fix pending (disable double-submit/idempotency).
7.3 withState always saves — risk of overwriting on read failure; hardening v14 pending (don't save if blob exists but is unreadable).
7.4 Old lessons: SDK latest + Redeploy without cache; access on all operations; allowOverwrite; empty/corrupt JSON → defaultState; get() shape {stream, blob}; "No local changes" = file not overwritten; Env from next deploy.

## 8. Roadmap
Step A (optional hardening): store.js v14 (overwrite protection) + approve.js v3 (double-click protection).
Phase B: ACCOUNTANT_PIN + tabs "Balance"/"Journal" (read-only) + api/stock.js.
Phase 3: notifications (Resend — open question). Phase 4: 1C import, v1 badge. Phase 5: QR, analytics, JWT.
After each stage — update the dossier.

## 9. Risks
Blob without transactions (OK for 2–3 users); PIN = MVP (JWT in Phase 5).
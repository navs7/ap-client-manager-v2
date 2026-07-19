# CA Fee Manager — Application Documentation

> A professional fee-tracking web application built for Chartered Accountants to manage client fees, ITR filing status, partial payments, discounts, and tags across multiple financial years.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Architecture](#architecture)
5. [Firebase & Data Model](#firebase--data-model)
6. [Authentication](#authentication)
7. [Financial Years](#financial-years)
8. [Client Lifecycle & Statuses](#client-lifecycle--statuses)
9. [Features](#features)
   - [Dashboard & Metrics](#dashboard--metrics)
   - [Filtering & Search](#filtering--search)
   - [Tags System](#tags-system)
   - [Fee Management](#fee-management)
   - [ITR Filing](#itr-filing)
   - [History & Comments](#history--comments)
   - [Settings Menu](#settings-menu)
10. [Component Reference](#component-reference)
11. [Hooks & Data Layer](#hooks--data-layer)
12. [API Server](#api-server)
13. [Environment Variables](#environment-variables)
14. [Running Locally](#running-locally)

---

## Overview

CA Fee Manager is a single-page React application backed by Firebase (Authentication + Firestore). It allows a CA to:

- Track every client's fee status across financial years (pending → paid / partial / no service)
- Record quoted fees, other dues, fees received, and discounts
- Mark ITR filing completion per client
- Attach tags (Salaried, Capital Gain, etc.) for categorisation and filtering
- Maintain a full audit history and freeform notes on every client
- Import a client list from Excel and export a sample template

All data is stored per-user in Firestore; no data is shared between accounts.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 + TypeScript |
| Build tool | Vite 7 |
| Styling | Tailwind CSS v4 |
| Component primitives | Radix UI (full suite) |
| Icons | Lucide React |
| Toasts | Sonner |
| Database | Firebase Firestore |
| Authentication | Firebase Auth (email/password) |
| Excel processing | SheetJS (`xlsx`) |
| State (server) | `@tanstack/react-query` (provider only; Firestore listeners used directly) |
| Monorepo | pnpm workspaces |

---

## Project Structure

```
workspace/
├── artifacts/
│   ├── ca-fee-manager/          # Frontend React/Vite app
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── index.css
│   │       ├── contexts/
│   │       │   └── AuthContext.tsx
│   │       ├── hooks/
│   │       │   └── useFirestore.ts
│   │       ├── lib/
│   │       │   ├── firebase.ts
│   │       │   └── utils.ts
│   │       ├── components/
│   │       │   ├── Dashboard.tsx
│   │       │   ├── Login.tsx
│   │       │   ├── FYSelector.tsx
│   │       │   ├── MetricsCard.tsx
│   │       │   ├── ClientSection.tsx
│   │       │   ├── ClientRow.tsx
│   │       │   ├── PaidClientRow.tsx
│   │       │   ├── PartialClientRow.tsx
│   │       │   ├── NoServiceRow.tsx
│   │       │   ├── HistoryLog.tsx
│   │       │   ├── CommentInput.tsx
│   │       │   ├── TagSelector.tsx
│   │       │   ├── SettingsMenu.tsx
│   │       │   ├── ThemeToggle.tsx
│   │       │   └── ui/              # Radix-based primitives
│   │       └── pages/
│   │           └── not-found.tsx
│   └── api-server/              # Express API (currently minimal)
│       └── src/
│           ├── index.ts
│           ├── app.ts
│           ├── lib/logger.ts
│           └── routes/
│               ├── index.ts
│               └── health.ts
└── lib/
    └── db/src/schema/index.ts   # Unused (placeholder)
```

---

## Architecture

```
Firebase Auth
     │
     ▼
AuthContext (React Context)
     │
     ▼
App.tsx  ──► loading spinner
     │
     ├── user == null  ──► Login.tsx
     │
     └── user != null  ──► Dashboard.tsx
                                │
                    ┌───────────┴────────────┐
                    │                        │
              FYSelector              SettingsMenu
              (FY picker)        (add/delete/import/tags)
                    │
              useClients (Firestore listener)
                    │
              MetricsCard
                    │
              Filter bar (status + tags + search)
                    │
              ClientSection × 4
          ┌─────────┼──────────┬────────────┐
    ClientRow  PartialClientRow  PaidClientRow  NoServiceRow
    (pending)   (partial)         (paid)        (no_service)
```

All Firestore reads use real-time `onSnapshot` listeners — the UI updates instantly when data changes in another tab or device.

---

## Firebase & Data Model

### Firestore Collections

```
users/
  {uid}/
    settings/
      app                          # UserSettings document
        customTags: string[]

    financial_years/
      {fyId}/
        name: string               # e.g. "2025-2026"
        createdAt: Timestamp

        clients/
          {clientId}/
            name: string
            status: 'pending' | 'partial' | 'paid' | 'no_service'
            paymentType: 'partial' | 'discount' | null
            quotedFees: number | null
            otherDues: number | null
            feesReceived: number | null
            itrFiled: boolean
            tags: string[]
            comments: string | null
            history: HistoryEntry[]
              { id: string, action: string, at: string (ISO 8601) }
            createdAt: Timestamp
            updatedAt: Timestamp
```

### Key Design Decisions

- **Per-user isolation** — all data lives under `users/{uid}/`. No cross-user data access.
- **History as array** — the `history` field is a Firestore array of `HistoryEntry` objects. Every status change, fee update, and note appends to this array, creating a full audit trail.
- **`updatedAt` always server-side** — `updateClient()` always merges `updatedAt: serverTimestamp()` to avoid clock skew.
- **`paymentType` vs `status`** — `status` drives which card component renders; `paymentType` records the reason (`'partial'` = genuinely partial, `'discount'` = CA gave a price reduction).

---

## Authentication

**File:** `src/contexts/AuthContext.tsx`

Firebase Email/Password authentication. The `AuthProvider` wraps the entire app and exposes `{ user, loading }` via `useAuth()`.

- `user` — Firebase `User` object or `null`
- `loading` — `true` until the initial `onAuthStateChanged` fires (prevents a flash of the login screen)

Account creation is done directly in the Firebase Console — the app does not expose a sign-up form.

**Login page** (`Login.tsx`) presents email + password fields and calls `signInWithEmailAndPassword`. Errors are displayed inline.

---

## Financial Years

**File:** `src/components/FYSelector.tsx`

Indian financial years run **April to March**. The selector:

- Computes the current FY using `currentFYStartYear()` — if the current month is April or later, the FY start year is the current calendar year; otherwise it's the previous year.
- Generates options from 2000-2001 up to one year ahead of the current FY (to allow planning).
- On first load, `Dashboard.tsx` auto-selects or creates the current FY.
- Selecting an FY that has no Firestore document yet creates it on demand via `createFinancialYear()`.

---

## Client Lifecycle & Statuses

A client always has exactly one of four statuses:

```
pending  ──(Done)──►  paid
   │                   │
   │(partial payment)  │(Undo)
   ▼                   │
partial ◄──────────────┘
   │
   │(Paid in Full)──► paid
   │(Undo)──────────► pending

pending ──(No Service)──► no_service
no_service ──(Undo)──────► pending
paid ──(Undo)────────────► pending
```

### `paymentType` field

| Value | Meaning |
|---|---|
| `null` | Normal pending or paid client |
| `'partial'` | Client has paid less than quoted; remainder is still owed |
| `'discount'` | CA applied a price reduction; client stays `pending` or moves to `paid` |

### Partial/Discount Dialog

When fees received < total fees (quoted + other dues), clicking the checkmark or "Done" triggers a two-option dialog:

- **Partial Payment** → status becomes `'partial'`, `paymentType = 'partial'`; client moves to the Partial Payments section
- **Discount** → `paymentType = 'discount'`, status stays `'pending'` (or moves to `'paid'` if triggered via Done); discount amount is recorded in history

---

## Features

### Dashboard & Metrics

**File:** `src/components/MetricsCard.tsx`

Eight metrics shown in a 4-column grid (2 rows):

| Metric | Calculation |
|---|---|
| Total Clients | `clients.length` |
| Paid | `status === 'paid'` count |
| Pending | `status === 'pending'` count |
| ITR Filed | `itrFiled === true` count |
| Total Fees | Sum of `quotedFees + otherDues` for all clients |
| Received | Sum of `feesReceived` for paid + partial clients |
| Pending Amount | Sum of `(totalFees − feesReceived)` for non-paid, non-no_service clients |
| Total Discount | Sum of `(totalFees − feesReceived)` for `paymentType === 'discount'` clients |

---

### Filtering & Search

**File:** `src/components/Dashboard.tsx`

**Status filters** (single-select, mutually exclusive):

| Filter | Shows |
|---|---|
| All Clients | Every client |
| Pending / Active | `status === 'pending'` |
| Partial Payments | `status === 'partial'` |
| Fees Paid | `status === 'paid'` |
| No Service This Year | `status === 'no_service'` |
| ITR Filed | `itrFiled === true` (mixed status, flat list) |
| ITR Not Filed | `itrFiled === false` (mixed status, flat list) |

**Tag filters** (multi-select, OR logic) — shown as a pill row below the status pills. A client matches if it has **at least one** of the selected tags.

**Search** — case-insensitive substring match on client name.

All three filters compose: a client must pass the status filter AND the tag filter AND the search query to appear.

**Entry points for tag filter:**
1. Filter ▼ dropdown → Tags section (checkboxes)
2. Tags pill row (click any tag to toggle)

---

### Tags System

**Files:** `src/components/TagSelector.tsx`, `src/hooks/useFirestore.ts`

**Built-in tags** (cannot be deleted):
- Salaried
- Capital Gain
- Business Owner
- Foreign Assets

**Custom tags** — stored at `users/{uid}/settings/app` under `customTags: string[]`. Managed via Settings → Manage Tags.

**Color assignment** — each tag gets a deterministic color (8-color palette) based on a simple character-code hash of the tag name. Same tag always renders in the same color across all views.

**Tag display:**
- Collapsed card header — small colored chip badges below the client name
- Expanded card body — `TagSelector` component with popover to add/remove tags

---

### Fee Management

**File:** `src/components/ClientRow.tsx`

Each pending client card has:

| Field | Behaviour |
|---|---|
| **Quoted Fees** | Number input with debounced auto-save (600ms). Six quick-set pills: ₹1,000 / 1,500 / 2,000 / 2,500 / 3,000 / 4,000 |
| **Other Dues** | Number input with debounced auto-save (600ms). Used for additional charges beyond the quoted fee |
| **Total** | Shown as `∑` when other dues > 0 — `quotedFees + otherDues` |
| **Fees Received** | Display mode by default; click pencil (✏) to edit. Click ✓ to quick-set to the total |

**Done button** — marks client as Paid. Triggers the Partial/Discount dialog if `feesReceived < totalFees`.

**Checkmark (✓) button** — immediately sets `feesReceived = quotedFees + otherDues` and records a history entry.

**Re-editing fees received** — the Partial/Discount popup re-triggers on every save where `feesReceived < totalFees`, regardless of existing `paymentType`. A history note is added automatically when no popup is needed.

---

### ITR Filing

Every client card (all four status types) has a toggle button:

- **Outline style** = ITR not filed
- **Solid blue** = ITR filed ✓

Toggling adds a history entry (`"ITR Filed"` or `"ITR Status Removed"`).

The ITR Filed metric in `MetricsCard` counts clients where `itrFiled === true` across all statuses.

Two filter options — **ITR Filed** and **ITR Not Filed** — show a flat mixed-status list sorted in creation order.

---

### History & Comments

**File:** `src/components/HistoryLog.tsx`, `src/components/CommentInput.tsx`

**Auto-generated history entries** (appended automatically on actions):

| Action | Entry |
|---|---|
| Fees received updated | `"Fees received updated to ₹X"` |
| Quick-set total fees | `"Fees received set to total (₹X)"` |
| Partial payment | `"Partial payment of ₹X received. ₹Y still pending."` |
| Discount applied | `"Discount of ₹X applied. Effective fees: ₹Y."` |
| Marked as Paid | `"Marked as Paid"` |
| Paid in Full | `"Marked as Paid in Full"` |
| No Service | `"Marked as No Service"` |
| ITR Filed | `"ITR Filed"` |
| ITR Status Removed | `"ITR Status Removed"` |
| Undo | `"Moved back to Pending"` etc. |

**Comments** — freeform notes added manually. Stored as `"Note: <text>"` in history.

**Bullet list shortcut** — type `- ` (hyphen + space) at the start of a line in the comment box to auto-convert to `• `. Pressing Enter on a bullet line auto-continues with `• ` on the next line.

History is displayed newest-first, formatted in `en-IN` locale (`DD Mon YYYY, HH:MM AM/PM`).

---

### Settings Menu

**File:** `src/components/SettingsMenu.tsx`

Accessed via the ⚙ icon in the FY selector bar.

| Menu Item | Action |
|---|---|
| **Add Client** | Dialog with name input; Enter to submit; creates a new pending client |
| **Import from Excel** | File picker (`.xlsx` / `.xls`); reads first column as client names; skips header row if first cell contains "name" or "client"; bulk-creates clients |
| **Download Sample** | Generates and downloads `client-import-sample.xlsx` with a `Client Name` header and 7 example rows |
| **Delete Clients** | Scrollable list of all clients with status badges; hover to reveal trash icon; confirmation dialog before permanent deletion; includes search when >5 clients |
| **Manage Tags** | Shows built-in tags (read-only) and custom tags (deletable); input to add new custom tags |

---

## Component Reference

### `App.tsx`
Root component. Provides `QueryClientProvider`, `AuthProvider`, and the `Toaster`. Renders `<Login>` or `<Dashboard>` based on auth state.

### `Dashboard.tsx`
Main application view. Owns all filter state (`activeFilter`, `tagFilters`, `searchQuery`). Fetches financial years, clients, and user settings. Auto-creates the current FY on first login. Renders `MetricsCard`, the sticky filter bar, and four `ClientSection` instances (or a flat mixed section for ITR filters).

### `FYSelector.tsx`
Dropdown to pick a financial year. Generates all options from 2000-2001 to `currentFY + 1`. Selecting an FY without a Firestore document creates it on demand.

### `MetricsCard.tsx`
Reads the `clients` array prop, computes 8 aggregated metrics, and renders them in a 4-column 2-row grid.

### `ClientSection.tsx`
Thin wrapper that renders a titled group of clients. Accepts `type` prop (`'pending' | 'partial' | 'paid' | 'no_service' | 'mixed'`). In `'mixed'` mode, picks the correct row component per-client based on `client.status`.

### `ClientRow.tsx` *(pending clients)*
The most complex component. Manages local state for all fee inputs with 600ms debounced saves. Handles the Done / ITR / No Service actions, the Partial/Discount dialog, and the re-edit popup. Shows fixed fee pills (₹1k–₹4k). Expands to show Quoted Fees, Other Dues, Fees Received, TagSelector, CommentInput, and HistoryLog.

### `PaidClientRow.tsx` *(paid clients)*
Read-only fee display. ITR toggle + icon-only Undo button. Expands to show fee breakdown, TagSelector, CommentInput, and HistoryLog.

### `PartialClientRow.tsx` *(partial payment clients)*
Shows paid amount + pending amount in the header. "Paid in Full" button with confirmation. ITR toggle + icon-only Undo. Expands to show full fee breakdown, TagSelector, CommentInput, and HistoryLog.

### `NoServiceRow.tsx` *(no service clients)*
Minimal card with a `CalendarX` icon. ITR toggle + icon-only Undo. Expands to show TagSelector, CommentInput, and HistoryLog.

### `TagSelector.tsx`
Exports two components:
- **`TagChip`** — a small colored badge for a single tag; optionally shows a remove ✕ button
- **`TagSelector`** — shows selected tags as chips + a popover with all available tags as a checkable list; uses `getTagColor(tag)` for consistent hashing-based color assignment

### `MetricsCard.tsx`
See [Dashboard & Metrics](#dashboard--metrics).

### `HistoryLog.tsx`
Receives `history: HistoryEntry[]`, sorts newest-first, renders each entry as a left-bordered row with timestamp + action text.

### `CommentInput.tsx`
Textarea with auto-bullet conversion (`- ` → `• `), Enter continuation for bullet lines, and Ctrl+Enter to submit.

### `SettingsMenu.tsx`
See [Settings Menu](#settings-menu).

### `ThemeToggle.tsx`
Light/Dark mode toggle using `next-themes`.

### `Login.tsx`
Email + password form using Firebase `signInWithEmailAndPassword`. Inline error display.

---

## Hooks & Data Layer

### `useFirestore.ts`

All Firestore interaction lives here.

#### Exported Interfaces

```typescript
interface FinancialYear {
  id: string;
  name: string;           // e.g. "2025-2026"
  createdAt: Timestamp;
}

interface HistoryEntry {
  id: string;             // crypto.randomUUID()
  action: string;
  at: string;             // ISO 8601 (client-side clock)
}

interface UserSettings {
  customTags: string[];
}

interface Client {
  id: string;
  name: string;
  status: 'pending' | 'partial' | 'paid' | 'no_service';
  paymentType: 'partial' | 'discount' | null;
  quotedFees: number | null;
  otherDues: number | null;
  feesReceived: number | null;
  itrFiled: boolean;
  tags: string[];
  comments: string | null;
  history: HistoryEntry[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### Hooks (real-time listeners)

| Hook | Listens to | Returns |
|---|---|---|
| `useFinancialYears(uid)` | `users/{uid}/financial_years` ordered by `createdAt desc` | `{ years, loading }` |
| `useClients(uid, fyId)` | `users/{uid}/financial_years/{fyId}/clients` ordered by `createdAt asc` | `{ clients, loading }` |
| `useUserSettings(uid)` | `users/{uid}/settings/app` | `UserSettings` |

#### Async CRUD Functions

| Function | Operation |
|---|---|
| `createFinancialYear(uid, name)` | Adds a new FY document |
| `createClient(uid, fyId, name)` | Adds a new client with all fields initialised to defaults |
| `updateClient(uid, fyId, clientId, data)` | Merges partial update + sets `updatedAt: serverTimestamp()` |
| `deleteClient(uid, fyId, clientId)` | Permanently deletes client document |
| `updateUserSettings(uid, data)` | `setDoc` with merge — creates or updates settings |

#### Constant

```typescript
const DEFAULT_TAGS = ['Salaried', 'Capital Gain', 'Business Owner', 'Foreign Assets'];
```

### `AuthContext.tsx`

```typescript
// Usage
const { user, loading } = useAuth();
```

Wraps `onAuthStateChanged` in a React context. `loading` is `true` until the first auth event fires.

---

## API Server

**Location:** `artifacts/api-server/`  
**Port:** 3001 (reads `process.env.PORT`)  
**Base path:** `/api`

The API server currently exists as infrastructure scaffolding and is not used by the frontend (which talks directly to Firebase). It exposes one route:

```
GET /api/healthz  →  200 { status: "ok" }
```

Built with Express 5, `pino-http` for structured logging, and `cors` middleware.

---

## Environment Variables

All set as Replit Secrets (exposed to Vite as `VITE_*`):

| Variable | Purpose |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase project API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firestore project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Cloud Messaging sender |
| `VITE_FIREBASE_APP_ID` | Firebase App ID |
| `SESSION_SECRET` | Reserved for future server-side session use |

---

## Running Locally

```bash
# Install dependencies
pnpm install

# Start the frontend (port auto-assigned by Replit)
pnpm --filter @workspace/ca-fee-manager run dev

# Start the API server (port 3001)
pnpm --filter @workspace/api-server run dev
```

The frontend dev server binds to `0.0.0.0` and uses `vite.config.ts` with `server.allowedHosts: true` for Replit's proxy environment.

---

## Data Flow Summary

```
User action (e.g. click "Done")
        │
        ▼
Component handler (e.g. handleDoneConfirm in ClientRow)
        │
        ├── Builds HistoryEntry with crypto.randomUUID() + new Date().toISOString()
        │
        ├── Calls updateClient(uid, fyId, clientId, { status: 'paid', history: [...] })
        │        │
        │        └── updateDoc(Firestore) + updatedAt: serverTimestamp()
        │
        └── Firestore triggers onSnapshot listener in useClients
                 │
                 └── React state update → re-render → card animates out
```

All writes are optimistic from the user's perspective — the UI updates within a single React render cycle because the Firestore listener fires near-instantly on the same client.

# Villa Olimpia – Cursor Expert Tasks V3

> **Rules**: Never break existing features. Test every change. No placeholder data. TypeScript strict.

---

## 🔴 TASK 1 — DATA PERSISTENCE (CRITICAL — do this first)

**Problem**: Data lives only in `localStorage`, which is browser/device-scoped. The production (Vercel) instance has real bookings; the local dev environment does not.

**Solution**: Replace `localStorage` as sole source of truth with a **Next.js API Route backed by a server-side JSON file**. Keep `localStorage` only as a fast read-cache.

### Implementation steps:

**1.1 — Create `/app/api/bookings/route.ts`**

```ts
// GET: read bookings from file
// POST: write bookings to file (full replace)
// File path: process.cwd() + '/data/bookings.json'
// Initialize with [] if file doesn't exist
// Return { bookings: Booking[] }
// Use fs/promises, handle errors with try/catch
// Set headers: { 'Content-Type': 'application/json' }
```

**1.2 — Create `/data/bookings.json`**

```json
[]
```

Add `/data/bookings.json` to `.gitignore` so production data is not overwritten on deploy.

**1.3 — Modify `lib/store.ts` → `load()` function**

```ts
// Current: load from localStorage
// New behavior:
// 1. Try GET /api/bookings
// 2. If response ok and bookings.length > 0: use server data, also write to localStorage cache
// 3. If server fails or returns []: fall back to localStorage
// 4. If localStorage also empty: use SEED_BOOKINGS
```

**1.4 — Modify `lib/store.ts` → persist/sync on every mutation**

After every `addBooking`, `updateBooking`, `deleteBooking`, `importBookingsMerge`:
```ts
// Call POST /api/bookings with full bookings array
// Do NOT await (fire-and-forget is fine to avoid blocking UI)
// Also keep the existing localStorage write
```

**1.5 — Modify `lib/store.ts` → `load()` — production data migration**

The production Vercel instance cannot serve local files. For Vercel, the API route writes to `/tmp/bookings.json` (writable on serverless). Detect environment:
```ts
const dataPath = process.env.VERCEL
  ? '/tmp/bookings.json'
  : path.join(process.cwd(), 'data/bookings.json');
```

**1.6 — Add a visible "Sync" status indicator in the Toolbar**

- A small dot (green = synced, orange = syncing, red = error) next to the export button
- No text needed, just an icon or colored dot with a tooltip

---

## 🟡 TASK 2 — COLOR CONTRAST & READABILITY FIXES

**Problem**: Several UI elements are illegible against the dark glassmorphism background.

Fix ONLY in `app/globals.css`. Do NOT touch component logic.

### Specific fixes:

**2.1 — Toolbar inputs and selects**

```css
.toolbar input,
.toolbar select,
.toolbar button {
  color: #f1f5f9;          /* was inheriting dark or transparent */
  background: rgba(255,255,255,0.10);
  border: 1px solid rgba(255,255,255,0.20);
}
.toolbar input::placeholder { color: rgba(255,255,255,0.45); }
.toolbar select option { background: #1e293b; color: #f1f5f9; }
```

**2.2 — Filter chips / tab buttons in Toolbar**

Any element with class `.filter-btn`, `.tab-btn`, `.chip-btn`, or similar:
```css
color: rgba(255,255,255,0.75);
border-color: rgba(255,255,255,0.20);
/* active state: */
color: #fff;
background: rgba(255,255,255,0.18);
border-color: rgba(255,255,255,0.40);
```

**2.3 — Gantt lodge labels**

```css
.gantt-lodge-label {
  color: #e2e8f0;   /* NOT rgba(0,0,0,…) */
  font-weight: 600;
}
```

**2.4 — KPI card values**

```css
.kpi-value { color: #f8fafc; }
.kpi-label { color: rgba(248,250,252,0.65); }
```

**2.5 — Month summary table on glass background**

```css
.summary-table th { color: rgba(255,255,255,0.55); }
.summary-table td { color: #e2e8f0; }
.summary-table tr:hover td { background: rgba(255,255,255,0.05); }
```

**2.6 — Dialog (opens above dark background)**

The dialog should use a LIGHT theme (white/off-white) for maximum contrast when overlaid on the dark main background:
```css
.dialog-content {
  background: #ffffff;
  color: #0f172a;
}
.dialog-content label { color: #334155; }
.dialog-content input,
.dialog-content select,
.dialog-content textarea {
  background: #f8fafc;
  border-color: #e2e8f0;
  color: #0f172a;
}
.dialog-header { background: #f1f5f9; border-bottom: 1px solid #e2e8f0; }
.dialog-header [data-radix-dialog-title] { color: #0f172a; }
```

---

## 🟢 TASK 3 — UI POLISH & WOW FACTOR

### 3.1 — Gantt bars: make them rich and premium

Each booking bar should feel like a product card, not a colored rectangle:

```css
.gantt-bar {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.12);
  background: linear-gradient(135deg, var(--bar-color) 0%, color-mix(in srgb, var(--bar-color), #000 20%) 100%);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.gantt-bar:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2);
  z-index: 10;
}
```

### 3.2 — Today column: make it unmissable

```css
.gantt-cell--today {
  background: rgba(99, 102, 241, 0.12);
  border-left: 2px solid #6366f1;
  border-right: 2px solid #6366f1;
}
.gantt-day-header--today {
  background: linear-gradient(180deg, rgba(99,102,241,0.3) 0%, transparent 100%);
  color: #a5b4fc;
  font-weight: 800;
}
```

### 3.3 — KPI cards: add subtle animated gradient border

```css
@keyframes borderSpin {
  0% { background-position: 0% 50%; }
  100% { background-position: 100% 50%; }
}
.kpi-card {
  position: relative;
  border: 1px solid transparent;
  background-clip: padding-box;
}
.kpi-card::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(99,102,241,0.4), rgba(168,85,247,0.2), rgba(99,102,241,0.4));
  background-size: 200% 200%;
  animation: borderSpin 4s linear infinite;
  z-index: -1;
}
```

### 3.4 — Toolbar: add frosted glass depth

```css
.toolbar {
  background: linear-gradient(
    to bottom,
    rgba(15,23,42,0.85) 0%,
    rgba(15,23,42,0.70) 100%
  );
  border-bottom: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 4px 32px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.05) inset;
}
```

### 3.5 — Add entrance animation to Gantt rows

```css
@keyframes rowSlideIn {
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: translateX(0); }
}
.gantt-row {
  animation: rowSlideIn 0.3s var(--ease-out) both;
}
.gantt-row:nth-child(1)  { animation-delay: 0.04s; }
.gantt-row:nth-child(2)  { animation-delay: 0.08s; }
.gantt-row:nth-child(3)  { animation-delay: 0.12s; }
.gantt-row:nth-child(4)  { animation-delay: 0.16s; }
.gantt-row:nth-child(5)  { animation-delay: 0.20s; }
.gantt-row:nth-child(6)  { animation-delay: 0.24s; }
.gantt-row:nth-child(7)  { animation-delay: 0.28s; }
.gantt-row:nth-child(8)  { animation-delay: 0.32s; }
.gantt-row:nth-child(9)  { animation-delay: 0.36s; }
```

### 3.6 — Mobile: make it usable on phone

```css
@media (max-width: 768px) {
  .toolbar { flex-wrap: wrap; gap: 8px; padding: 10px 12px; }
  .kpi-panel { grid-template-columns: 1fr 1fr; gap: 10px; padding: 12px; }
  .gantt-lodge-label { font-size: 11px; min-width: 100px; max-width: 100px; }
  .gantt-wrap { font-size: 11px; }
}
```

---

## ✅ ACCEPTANCE CRITERIA

Before marking done, verify each task:

- [ ] T1: Open app locally → real bookings appear (same as production). POST /api/bookings returns 200. `data/bookings.json` is written on every change.
- [ ] T1: Vercel deploy still works. No build errors.
- [ ] T2: Every text element in the toolbar, Gantt, KPI cards, and summary table is legible (WCAG AA minimum contrast 4.5:1).
- [ ] T2: Dialog is clearly readable on top of the dark background.
- [ ] T3: Gantt bars lift on hover with shadow. Today column has visible indicator. KPI card borders animate. Gantt rows slide in on mount.
- [ ] T3: App is usable on 375px wide screen.

---

## ⚠️ DO NOT TOUCH

- `lib/types.ts` — never modify
- `lib/store.ts` validation logic (`validateBookingPayload`, `ensureNoOverlap`)
- Any existing component props/API surface
- `SEED_BOOKINGS` — keep as ultimate fallback

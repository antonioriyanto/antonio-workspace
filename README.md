# Antonio Riyanto — Workspace (React + Vite Rebuild)

Modern, high-performance Kanban Workspace application rebuilt from Vanilla JS into **React 18 + Vite + Tailwind CSS + Zustand + Lucide Icons**. Features complete Glassmorphism UI, workspace isolation ("Watch Club" & "Personal Project"), dual view modes (Kanban Board / Table Sheet), Google Apps Script cloud sync, and auto-save draft functionality.

---

## 🚀 Tech Stack

- **Framework:** React 18 + Vite (TypeScript)
- **Styling:** Tailwind CSS (Dark/Light/System mode with Glassmorphism UI)
- **Icons:** Lucide React
- **State Management:** Zustand with isolated `localStorage` per workspace
- **Build Tool:** Vite 5

---

## ✨ Key Features

1. **Workspace Management:**
   - Isolated state for **"Watch Club"** and **"Personal Project"** (persisted under distinct `localStorage` keys).
   - Seamless switching with dropdown in the sticky top header.

2. **View Modes:**
   - **Kanban Board:** 5 pipeline columns (*Backlog, Design & Review, Production, Delivery, Done*) with drag-and-drop card movement and stage color dots.
   - **Sheet / Table View:** Tabular overview with sorting, status pills, and instant click-to-edit.

3. **Task Management (Full CRUD):**
   - Add, edit, delete tasks.
   - Fields: Title, Category, Priority (*Critical, High, Medium, Low*), Deadline with automatic overdue/due-today calculations, PIC, multi-store branch assignment with auto Area Manager preview, Stage, Sub-status, Notes, and Follow-Up snooze scheduling.

4. **✨ Auto-Save Form Draft (`useTaskDraft` Hook):**
   - In "New Task" mode, automatically saves inputs to `localStorage` on every keystroke.
   - Restores draft automatically if modal was accidentally closed or refreshed.
   - Visual **"Draft restored"** indicator badge with timestamp.
   - **"Clear Draft"** button to reset inputs.
   - Automatically cleared upon successful submission.

5. **Priority Strip Container ("Perlu Perhatian"):**
   - Briefing banner highlighting overdue tasks, critical tasks, and due-today tasks.
   - Quick Filter Mendesak toggle.
   - Reset Snooze button.
   - Horizontal scrollable strip of priority cards.

6. **Advanced Multi-Dimension Filtering:**
   - Full-text search (Title, Stores, Area Manager, Notes, PIC).
   - Filter dropdowns: Priority, PIC, Area Manager (auto-resolved from stores), Store, Category.
   - One-click filter reset.

7. **Sync & Cloud Backup:**
   - Import & Export data as JSON / CSV.
   - Google Apps Script Webhook Push & Pull integration.
   - Auto-sync engine with debounce.
   - Emergency local snapshots before critical operations (Pull, Import, Delete).

8. **Theme Support:**
   - Light, Dark, and System modes with immediate CSS variable transitions.

---

## 🛠️ Getting Started

### Development
```bash
npm install
npm run dev
```

### Production Build
```bash
npm run build
npm run preview
```

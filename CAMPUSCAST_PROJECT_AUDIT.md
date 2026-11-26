# CAMPUSCAST — UNIVERSITY DIGITAL SIGNAGE MANAGEMENT SYSTEM
## PHASE 1: COMPREHENSIVE PROJECT AUDIT & TECHNICAL SPECIFICATION REPORT

---

**Project Name:** CampusCast — University Digital Signage Management System  
**Repository:** `inodkumar750/DYPIU-Digital-Signage-System-`  
**Current State:** Completed Frontend UI/UX (Google AI Studio Prototype), Ready for Production Backend & Android TV Player Integration  
**Audit Date:** November 2026  
**Auditor:** Antigravity AI  

---

## TABLE OF CONTENTS
1. [Existing Project Overview](#1-existing-project-overview)
2. [Existing Folder Structure & File Inventory](#2-existing-folder-structure--file-inventory)
3. [Current Technology Stack & Dependency Analysis](#3-current-technology-stack--dependency-analysis)
4. [Existing Frontend Functionality by Module](#4-existing-frontend-functionality-by-module)
5. [Missing Functionality & Backend Gaps](#5-missing-functionality--backend-gaps)
6. [Technical Issues, Warnings & Build Diagnostics](#6-technical-issues-warnings--build-diagnostics)
7. [Recommended Backend Architecture](#7-recommended-backend-architecture)
8. [Proposed Database Entities, Schema & ER Model](#8-proposed-database-entities-schema--er-model)
9. [Proposed REST API Specification](#9-proposed-rest-api-specification)
10. [Native Android TV Player Architecture (Kotlin)](#10-native-android-tv-player-architecture-kotlin)
11. [Production Hosting Analysis & Deployment Strategy](#11-production-hosting-analysis--deployment-strategy)
12. [Phased Implementation Roadmap](#12-phased-implementation-roadmap)

---

## 1. EXISTING PROJECT OVERVIEW

**CampusCast** is an enterprise-grade digital signage management platform designed for university campuses (specifically modeled for DYPIU - D.Y. Patil International University). It provides an IT Operations Console for campus administrators, content managers, and IT support staff to centrally control, schedule, dispatch, and monitor multimedia broadcasts across distributed Smart TV displays.

### Key Capabilities in the Current Frontend:
- **Centralized Display Operations:** Inventory management for 24 campus Smart TVs across 3 main campus zones (Building A, Building B, Student Hub) and multiple floors.
- **Media Asset Repository:** Categorized storage and management for university announcements, admissions open house visuals, placement drive alerts, workshop teasers, and event posters.
- **Visual Playlist Sequencing:** Drag-and-drop playlist builder utilizing `@dnd-kit` with per-slide timing controls, video auto-advance, and audio mute settings.
- **Multi-Step Campaign Wizard:** 5-step scheduling wizard with target screen/group selection, priority assignment (Normal, High, Urgent), calendar timeline views, and time slots.
- **Display Grouping & Zones:** Logical grouping of screens by building, floor, or venue (Concourses, Auditoriums, Libraries, Cafeterias).
- **Simulation Dispatch & Heartbeat Monitoring:** Two-stage publishing pipeline simulation and live device health telemetry (Online/Offline/Errors, heartbeat timestamps, storage capacity).
- **Executive Analytics & Reporting:** Interactive D3.js playback analytics, screen uptime metrics, client-side CSV downloads, and browser print-to-PDF reports.
- **Staff Directory & Settings:** Role-based administrator directory and 8 configuration categories for university branding, media policies, and security thresholds.

---

## 2. EXISTING FOLDER STRUCTURE & FILE INVENTORY

The existing project follows a clean modular React + TypeScript architecture:

```
DYPIU-Digital-Signage-System-/
├── .env                              # Local environment configuration (active)
├── .env.example                      # Sample environment variables (GEMINI_API_KEY, APP_URL)
├── .gitignore                        # Git exclusion rules
├── bun.lock                          # Bun lockfile from initial scaffolding
├── index.html                        # Application entry HTML with Google Fonts
├── metadata.json                     # AI Studio metadata descriptor
├── package.json                      # Project manifest, scripts, and dependencies
├── package-lock.json                 # npm lockfile (generated during audit)
├── tsconfig.json                     # TypeScript compiler configuration (ES2022, bundler)
├── vite.config.ts                    # Vite 8 build and plugin configuration
│
├── public/
│   └── assets/
│       └── aistudio/                 # AI Studio reference icons and branding assets
│
└── src/
    ├── main.tsx                      # React 19 root bootstrap mounting App
    ├── App.tsx                       # Main application orchestrator & state container (583 lines)
    ├── index.css                     # Tailwind CSS v4 setup, theme tokens & typography scale
    │
    ├── assets/
    │   └── images/                   # Sample posters, flyers, and staff avatars
    │       ├── admin_avatar_1795455462108.jpg
    │       ├── media_admissions_poster_1795455460163.jpg
    │       ├── media_cultural_fest_1795455461580.jpg
    │       ├── media_library_notice_1795455462127.jpg
    │       ├── media_placement_drive_1795455461472.jpg
    │       └── media_tech_symposium_1795455461771.jpg
    │
    ├── components/
    │   ├── layout/
    │   │   ├── Header.tsx            # Global navigation bar, search, notifications & profile
    │   │   └── Sidebar.tsx           # Brand sidebar with 11 route items & mobile drawer
    │   │
    │   ├── playlists/
    │   │   └── SortablePlaylistItem.tsx  # @dnd-kit drag-and-drop sortable playlist item
    │   │
    │   └── ui/
    │       ├── Charts.tsx            # D3.js line/area chart & horizontal bar charts
    │       ├── MediaThumbnail.tsx    # Responsive thumbnail formatter with video badge
    │       ├── Modal.tsx             # Accessible dialog component with focus lock & backdrop
    │       ├── StatCard.tsx          # KPI metric cards with tone variants
    │       ├── StatusBadge.tsx       # Standardized badges for screens, campaigns & roles
    │       └── Toast.tsx             # Multi-toast alert notification container
    │
    ├── data/
    │   └── mockSignageData.ts        # Comprehensive mock dataset (1,386 lines)
    │
    ├── pages/
    │   ├── DashboardPage.tsx         # Overview KPIs, quick actions, D3 charts & alerts
    │   ├── MediaLibraryPage.tsx      # Media gallery, filtering, upload & playlist linking
    │   ├── PlaylistsPage.tsx         # Visual playlist editor, drag reordering & player preview
    │   ├── CampaignsPage.tsx         # 5-step campaign wizard, calendar view & schedule table
    │   ├── ScreenManagementPage.tsx  # Screen inventory, pairing modal & playlist assignment
    │   ├── ScreenGroupsPage.tsx      # Building/floor screen cluster management
    │   ├── PublishingPage.tsx        # Push dispatch simulation, progress logs & retry actions
    │   ├── MonitoringPage.tsx        # Live screen heartbeat telemetry & diagnostic inspection
    │   ├── ReportsPage.tsx           # Playback analytics, building uptime & CSV/PDF exports
    │   ├── UserManagementPage.tsx    # Administrator directory, role assignment & status toggle
    │   └── SettingsPage.tsx          # 8-tab platform configuration form
    │
    └── types/
        └── signage.ts                # TypeScript interfaces and domain type definitions
```

---

## 3. CURRENT TECHNOLOGY STACK & DEPENDENCY ANALYSIS

### 3.1 Frontend Framework & Runtime
- **Core Library:** React `19.0.1` and React-DOM `19.0.1`
- **Language:** TypeScript `5.8.x` / `7.0.2` (strict typings, bundler resolution)
- **Build Tool:** Vite `8.3.8` (ESM native bundling with `@vitejs/plugin-react` 6.1.1)
- **Styling:** Tailwind CSS `4.3.3` with `@tailwindcss/vite` 4.3.5

### 3.2 UI & Interaction Libraries
- **Icons:** `lucide-react` `0.546.0` (modern SVG icons across all modules)
- **Drag-and-Drop:** `@dnd-kit/core` `6.3.1`, `@dnd-kit/sortable` `10.0.0`, `@dnd-kit/utilities` `3.2.2`
- **Data Visualization:** `d3` `7.9.2` (native D3 scales, paths, axes, and curve generators)
- **Animation:** `motion` `12.23.24` (Framer Motion evolution)

### 3.3 Server & Tooling Packages (Present in `package.json`)
- `express` `4.21.2` & `@types/express` `4.17.21` (already listed in dependencies; ready for backend implementation)
- `dotenv` `17.2.3`
- `@google/genai` `2.4.0` (AI Studio assistance)
- `tsx` `4.21.0` (TypeScript Node execution)
- `esbuild` `0.25.0`

### 3.4 Design Tokens & Typography Scale
Configured in `src/index.css`:
- **Primary Brand:** Deep Royal Purple (`#290044`)
- **Secondary Brand:** Medium Purple (`#500071`)
- **Accent Brand:** Magenta/Violet (`#8A2A78`)
- **Cream Highlight:** Warm Gold Cream (`#EEE3B0`)
- **Background Canvas:** Soft White-Lilac (`#FAF8FC`)
- **Card Surface:** Pure White (`#FFFFFF`)
- **Border Subtle:** Lilac Border (`#E6E0EC`)
- **Typography Scale:** Custom utility classes (`type-hero`, `type-page-title`, `type-section-title`, `type-card-title`, `type-kpi`, `type-body`, `type-support`, `type-button`)

---

## 4. EXISTING FRONTEND FUNCTIONALITY BY MODULE

| # | Module | Visual & Interactive Features | State Handling | Mock vs Backend Status |
|---|---|---|---|---|
| **1** | **Dashboard** | KPI stat cards (screens, active campaigns, media count), quick action buttons that route to wizards, D3.js playback cycle chart with metric toggles, screen connectivity bar, offline TV alert callout, recent campaigns list, and building-wise online screen breakdown. | Reads state from `App.tsx`; local modal preview state for campaign review. | **UI Complete / State Prototype:** Calculates KPIs dynamically from props. Awaiting live database queries. |
| **2** | **Media Library** | Grid and list views, search bar, category filtering (Admissions, Workshops, Events, Placements, etc.), type filtering (Image/Video), date filtering, upload modal with simulated file reader and preview, metadata edit modal, delete modal with playlist cascading removal, add-to-playlist quick dropdown. | Local state in `App.tsx` (`mediaAssets`); page-level form inputs and search filters. | **UI Complete / Mock Data:** Simulated file picker. Awaiting multipart upload API & object storage. |
| **3** | **Playlists** | Master-detail playlist layout, interactive TV player preview with live seconds ticker and play/pause controls, playlist creation and edit modal, `@dnd-kit` sortable reordering of slides, duration configuration per slide, audio mute toggle, video loop toggle. | Local state in `App.tsx` (`playlists`); page-level player interval and drag sensor state. | **UI Complete / Local State:** Reordering and timing work in React memory. Awaiting persistent CRUD APIs. |
| **4** | **Campaigns** | Table view and interactive monthly calendar view (November & December 2026), status filter tabs, priority indicator tags, 5-step creation wizard (Details ➔ Playlist ➔ Target Screens/Groups ➔ Schedule ➔ Review & Dispatch), campaign pause/resume actions. | Local state in `App.tsx` (`campaigns`); 5-step wizard state managed inside `CampaignsPage.tsx`. | **UI Complete / Local State:** Wizard validates dates and targets. Awaiting backend scheduler service. |
| **5** | **Screen Management** | Campus display inventory table, filtering by building, floor, and connection status, search by TV ID/name, add new screen modal, edit screen metadata, toggle screen standby/active, TV detail drawer, **Pairing Modal with 6-character code (e.g., `DYP-84K`) and QR code simulation**, playlist assignment modal. | Local state in `App.tsx` (`screens`); page-level form fields and pairing simulation timer. | **UI Complete / Mock Flow:** Generates pairing codes in UI. Awaiting device pairing REST API & WebSocket. |
| **6** | **Screen Groups** | Building/floor cluster cards, screen count badges, assigned playlist tags, create/edit screen group modal with multi-screen selection chips, delete group action. | Local state in `App.tsx` (`groups`); modal form state in page. | **UI Complete / Local State:** Groups correctly filter screens. Awaiting relational DB schema. |
| **7** | **Publishing** | Summary strip of dispatch jobs, "Publish now" modal to select campaign and target screens, 2-stage animated dispatch progress bar (0% ➔ 55% ➔ 100%), retry failed jobs action, offline screen failure detection and alert messaging. | Local state in `App.tsx` (`publishJobs`); simulated window timer progress. | **UI Complete / Simulated:** Simulates remote network sync. Awaiting actual MQTT/WebSocket push dispatch. |
| **8** | **Monitoring** | 5 diagnostic stat cards (total, online, offline, errors, sync rate), building filter, status filter, real-time screen status cards with cache storage progress bar, last heartbeat counter, "Poll all heartbeats" timestamp refresh, "Simulate Reconnect" button to heal offline TV state. | Local state in `App.tsx` (`screens`); page-level timestamp updater. | **UI Complete / Simulated:** Shows realistic hardware telemetry. Awaiting TV player heartbeat ingest API. |
| **9** | **Reports** | Date range toggle (7d, 14d, 30d), playback impressions chart, category distribution bar chart, campus building uptime comparison, screen health table, **functional client-side CSV export (`handleExportCSV`)**, and **browser print-to-PDF (`handleExportPDF`)**. | Reads props from `App.tsx`; client-side blob generation for CSV. | **UI Complete / Client Exports:** CSV download works immediately. Awaiting SQL-aggregated telemetry data. |
| **10** | **User Management** | Administrator directory table with avatars, role badges (Super Admin, IT Admin, Content Manager, Monitoring User), status badges (Active, Suspended, Invited), search, role filter, Add/Edit administrator modal, suspend/activate user toggle. | Local state in `App.tsx` (`users`); modal form validation in page. | **UI Complete / Mock Data:** Validates email and role in React. Awaiting JWT authentication & MySQL users table. |
| **11** | **Settings** | 8 vertical navigation tabs (University Info, Branding Colors, General Defaults, Timezone, Playlist defaults, Media policies, Notification thresholds, Security/Keycloak realm), live form inputs, save button with toast confirmation. | Local state in `App.tsx` (`settings`); draft form state in page. | **UI Complete / Local State:** Updates theme defaults in memory. Awaiting persistent settings table. |

---

## 5. MISSING FUNCTIONALITY & BACKEND GAPS

While the frontend user experience is exceptionally polished and complete, the following critical backend and infrastructure components are required to transform it into a fully operational production system:

1. **Database Persistence Layer:**
   - Currently, all media records, playlists, campaigns, screens, and settings reset whenever the browser is refreshed.
   - A relational MySQL database is needed to persist all university signage entities with relational integrity.

2. **File Storage & Media Processing Pipeline:**
   - The frontend currently references static images in `/src/assets/images/` and creates temporary `blob:` URLs for uploaded items.
   - A real media storage solution (local disk on server or S3/Cloudflare R2) is required.
   - Server-side image optimization (Sharp) and video transcoding/thumbnail generation (FFmpeg) are missing.

3. **Authentication & Access Control (RBAC):**
   - The user currently appears as logged-in Super Administrator "Vinod Kumar Jain".
   - There is no login page, password hashing (bcrypt), JWT issuance, session management, or role enforcement middleware.

4. **Hardware TV Device Pairing Handshake:**
   - The pairing modal shows a simulated code `DYP-84K`.
   - The actual backend endpoint to generate temporary OTP codes, bind Android TV MAC/Hardware IDs, and issue permanent API authentication tokens to physical screens is absent.

5. **Live Content Synchronization Engine:**
   - The publishing page simulates dispatch using `window.setTimeout`.
   - Physical Android TVs need a real synchronization mechanism: either WebSocket, MQTT, or Server-Sent Events (SSE), paired with HTTP polling fallback.

6. **Device Heartbeat & Telemetry Ingestion:**
   - The monitoring screen simulates online/offline states.
   - A background cron worker and ingest API are required to receive regular pings (every 30–60 seconds) from Android TVs and mark inactive displays as "Offline" after a threshold.

7. **Scheduled Campaign Background Daemon:**
   - Scheduled campaigns need a backend cron worker (e.g., node-cron) to automatically change status from `Scheduled` ➔ `Active` ➔ `Completed` based on the clock and trigger content updates to screens.

---

## 6. TECHNICAL ISSUES, WARNINGS & BUILD DIAGNOSTICS

During the application audit and verification build, the following items were diagnosed:

### 6.1 TypeScript Compiler (`tsc --noEmit`)
- **Status:** **PASS (Zero Errors)**
- All types in `src/types/signage.ts` are strictly typed and satisfied across all 11 pages and sub-components.

### 6.2 Vite Production Build (`vite build`)
- **Status:** **SUCCESS (2.48s build time)**
- Output files:
  - `dist/index.html` (1.64 kB)
  - `dist/assets/index-KBdl_qZb.css` (50.49 kB)
  - `dist/assets/index-B04tt1fr.js` (565.53 kB)
- **Warning 1 (Minor):** Vite reported that `vite.config.ts:22:40` references `__dirname`, which is deprecated for native ESM config loaders. It can be replaced in Phase 2 with `import.meta.dirname`.
- **Warning 2 (Optimization):** The generated single JavaScript chunk is `565 kB` (>500 kB threshold). It is recommended in Phase 2 to introduce dynamic `React.lazy()` imports for the 11 page modules to split the bundle into smaller, faster-loading chunks.

### 6.3 Dependency Management
- Running `npm install` encountered a peer dependency resolution constraint between `esbuild@^0.25.0` (specified in devDependencies) and `vite@8.3.8` (requiring `esbuild@^0.27.0 || ^0.28.0`).
- Installation succeeds with `npm install --legacy-peer-deps`. This can be permanently resolved in Phase 2 by updating the devDependency to `"esbuild": "^0.28.0"` without altering any application code.

### 6.4 Console & Runtime Errors
- Browser verification confirmed clean console logs, responsive layout execution, working SVG charts, and interactive modals with zero runtime crashes.

---

## 7. RECOMMENDED BACKEND ARCHITECTURE

To support the existing React frontend and native Android TV player without altering the frontend design or UX, a modular **Node.js + Express.js** REST API service is recommended.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CAMPUSCAST ARCHITECTURE                         │
└────────────────────────────────────────────────────────────────────────┘

    ┌───────────────────────────┐         ┌───────────────────────────┐
    │     React Admin Web       │         │   Android TV Player App   │
    │   (Vite / Tailwind CSS)   │         │     (Kotlin / Media3)     │
    └─────────────┬─────────────┘         └─────────────┬─────────────┘
                  │                                     │
                  │ HTTPS / JSON                        │ HTTPS (Manifest & Sync)
                  │ JWT Bearer Auth                     │ Screen Token Auth
                  │                                     │ WSS / SSE (Heartbeats)
                  ▼                                     ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                 Node.js / Express.js REST API                   │
    ├─────────────────────────────────────────────────────────────────┤
    │  [Auth & RBAC Middleware]        [Device Pairing Service]       │
    │  [Media Upload & Sharp/FFmpeg]   [Scheduler Cron Daemon]        │
    │  [Playlist & Campaign Engine]    [Heartbeat Ingestion Engine]   │
    │  [WebSocket / SSE Broadcaster]   [Analytics & Export Engine]    │
    └──────────────┬──────────────────────────────┬───────────────────┘
                   │                              │
                   ▼                              ▼
    ┌─────────────────────────────┐   ┌───────────────────────────────┐
    │     MySQL 8.0 Database      │   │     Media Storage System      │
    │  (Relational Data, Users,   │   │  (Local Disk /uploads or      │
    │   Campaigns, Playlists)     │   │   S3/Cloudflare R2 Storage)   │
    └─────────────────────────────┘   └───────────────────────────────┘
```

### 7.1 Backend Layer Structure
- **Routing Layer (`/routes`):** Express routers exposing clean RESTful endpoints versioned under `/api/v1/`.
- **Controllers (`/controllers`):** Request validation, parameter parsing, and response serialization.
- **Service Layer (`/services`):** Core business logic (campaign resolution, pairing code lifecycle, playlist compilation, heartbeat health checks).
- **Data Access Layer (`/models` or `/repositories`):** Structured SQL queries utilizing MySQL2 with connection pooling.
- **Middleware (`/middleware`):**
  - `authenticateUser`: Validates admin JWT access tokens.
  - `requireRole`: Enforces roles (`Super Administrator`, `IT Administrator`, `Content Manager`, `Monitoring User`).
  - `authenticateScreen`: Validates Android TV hardware bearer tokens.
  - `errorHandler`: Standardized error envelope handler (`{ success: false, error: { message, code } }`).
  - `uploadMiddleware`: Multer configuration with file extension whitelist and size validation.

---

## 8. PROPOSED DATABASE ENTITIES, SCHEMA & ER MODEL

The relational database will run on MySQL 8.0. Below is the proposed production schema matching the frontend's TypeScript models exactly:

```
┌──────────────────┐           ┌──────────────────┐           ┌──────────────────┐
│      users       │           │   screen_groups  │           │     screens      │
├──────────────────┤           ├──────────────────┤           ├──────────────────┤
│ id (PK)          │           │ id (PK)          │     ┌─────┤ id (PK)          │
│ name             │           │ name             │     │     │ name             │
│ email (UQ)       │           │ building         │     │     │ building         │
│ password_hash    │           │ floor            │     │     │ floor            │
│ department       │           │ description      │     │     │ location         │
│ role             │           │ assigned_pl_id   │     │     │ ip_address       │
│ status           │           └────────┬─────────┘     │     │ connection_status│
│ last_login       │                    │               │     │ last_heartbeat   │
└──────────────────┘                    │ 1:N           │     │ paired_at        │
                                        ▼               │     │ device_token_hash│
                               ┌──────────────────┐     │     │ assigned_pl_id   │
                               │screen_group_items│     │     └────────┬─────────┘
                               ├──────────────────┤     │              │
                               │ group_id (FK)    │     │              │
                               │ screen_id (FK)───┼─────┘              │
                               └──────────────────┘                    │
                                                                       │
    ┌──────────────────┐           ┌──────────────────┐                │
    │   media_assets   │           │    playlists     │                │
    ├──────────────────┤           ├──────────────────┤                │
    │ id (PK)          │     ┌─────┤ id (PK)          │◄───────────────┘
    │ title            │     │     │ name             │
    │ file_name        │     │     │ description      │
    │ file_path        │     │     │ default_duration │
    │ type (IMG/VID)   │     │     │ auto_advance_vid │
    │ category         │     │     │ loop_playlist    │
    │ file_size_bytes  │     │     │ status           │
    │ width, height    │     │     └────────┬─────────┘
    │ duration_seconds │     │              │
    │ uploaded_by (FK) │     │              │ 1:N
    └────────┬─────────┘     │              ▼
             │               │     ┌──────────────────┐
             │               │     │  playlist_items  │
             │               │     ├──────────────────┤
             │ 1:N           │     │ id (PK)          │
             ▼               │     │ playlist_id (FK) │
    ┌──────────────────┐     │     │ media_id (FK)────┼──┐
    │  campaign_targets│     │     │ order_index      │  │
    ├──────────────────┤     │     │ duration_seconds │  │
    │ campaign_id (FK) │     │     │ mute_audio       │  │
    │ screen_id (FK)   │     │     │ loop_video       │  │
    │ group_id (FK)    │     │     └──────────────────┘  │
    └────────┬─────────┘     │                           │
             │               │                           │
             ▼               │                           │
    ┌──────────────────┐     │                           │
    │    campaigns     │     │                           │
    ├──────────────────┤     │                           │
    │ id (PK)          │     │                           │
    │ name             │     │                           │
    │ description      │     │                           │
    │ playlist_id (FK) ─┼─────┘                           │
    │ priority         │                                 │
    │ status           │                                 │
    │ start_date, time │                                 │
    │ end_date, time   │                                 │
    │ created_by (FK)  │                                 │
    └────────┬─────────┘                                 │
             │                                           │
             ▼                                           │
    ┌──────────────────┐           ┌──────────────────┐  │
    │   publish_jobs   │           │   device_pings   │  │
    ├──────────────────┤           ├──────────────────┤  │
    │ id (PK)          │           │ id (PK)          │  │
    │ campaign_id (FK) │           │ screen_id (FK)   │  │
    │ status           │           │ current_media(FK)┼──┘
    │ progress_pct     │           │ storage_used_pct │
    │ success_count    │           │ error_message    │
    │ failed_count     │           │ ping_timestamp   │
    │ initiated_by (FK)│           └──────────────────┘
    └──────────────────┘
```

### Table Definitions:
1. **`users`**: Admin credentials, bcrypt hash, email, department, role enum, status enum, last login timestamp.
2. **`media_assets`**: Metadata for uploaded images and videos (UUID, title, original filename, storage key/path, mime type, size, dimensions, duration, category, uploaded_by foreign key).
3. **`playlists`**: Playlist header records (name, description, default slide duration, loop flag, auto-advance video flag, status).
4. **`playlist_items`**: Ordered playlist tracks linking `playlist_id` ➔ `media_id`, with slide order sequence, duration overrides, and audio mute settings.
5. **`screens`**: Campus display hardware records (Screen ID e.g. `DYPIU-TV-001`, friendly name, building, floor, room location, IP address, resolution, OS/app version, connection status, token hash, assigned playlist ID, active flag).
6. **`screen_groups`**: Group clusters (Building A Ground Floor, Hostels, Auditoriums) with assigned fallback playlists.
7. **`screen_group_items`**: Many-to-many junction table mapping `group_id` to `screen_id`.
8. **`campaigns`**: Time-slotted broadcasts (name, priority, playlist_id, start_date/time, end_date/time, status enum).
9. **`campaign_targets`**: Junction table assigning campaigns to specific screens or screen groups.
10. **`publish_jobs`**: Log of content push dispatches with progress percent, success/failure screen counts, and error details.
11. **`device_pings` / `device_telemetry`**: Time-series log of TV heartbeats for historical uptime reports and diagnostics.
12. **`device_pairing_sessions`**: Ephemeral 6-digit pairing codes with 10-minute expiration for onboarding new TVs.
13. **`system_settings`**: Key-value or single-row JSON configuration for university branding, alert thresholds, and security parameters.

---

## 9. PROPOSED REST API SPECIFICATION

All endpoints will be versioned under `/api/v1`.

### 9.1 Authentication & Profile
- `POST /api/v1/auth/login` — Authenticates email/password, returns JWT token & user profile.
- `POST /api/v1/auth/logout` — Invalidates session cookie / revokes refresh token.
- `GET /api/v1/auth/me` — Returns currently authenticated staff profile & permissions.

### 9.2 Media Management
- `GET /api/v1/media` — Lists media assets with search, category, and type filters.
- `POST /api/v1/media/upload` — Multipart upload for images (JPG, PNG, WebP) and MP4 videos.
- `GET /api/v1/media/:id` — Retrieves asset metadata and download URL.
- `PUT /api/v1/media/:id` — Updates title, category, or description.
- `DELETE /api/v1/media/:id` — Deletes asset (with cascade check against active playlists).

### 9.3 Playlists
- `GET /api/v1/playlists` — Lists all playlists with item count and assigned screens.
- `POST /api/v1/playlists` — Creates a new playlist with ordered items.
- `GET /api/v1/playlists/:id` — Retrieves playlist details with ordered slide items and media metadata.
- `PUT /api/v1/playlists/:id` — Updates playlist header and slide sequence.
- `DELETE /api/v1/playlists/:id` — Deletes playlist.

### 9.4 Campaigns & Scheduling
- `GET /api/v1/campaigns` — Lists campaigns with status and date filtering.
- `POST /api/v1/campaigns` — Creates a scheduled or draft campaign with screen/group targets.
- `PUT /api/v1/campaigns/:id` — Updates campaign schedule or priority.
- `PATCH /api/v1/campaigns/:id/status` — Changes status (`Active`, `Paused`, `Completed`).
- `DELETE /api/v1/campaigns/:id` — Cancels and removes campaign.

### 9.5 Screen Management & Hardware Pairing
- `GET /api/v1/screens` — Lists all registered campus screens with live status.
- `POST /api/v1/screens/pair/request` — Called by Android TV: Generates 6-character PIN code.
- `POST /api/v1/screens/pair/verify` — Called by Admin Web Console: Submits PIN, binds screen, returns hardware token.
- `PUT /api/v1/screens/:id` — Updates screen name, location, or assigned playlist.
- `PATCH /api/v1/screens/:id/standby` — Toggles display active/standby state.

### 9.6 Screen Groups
- `GET /api/v1/screen-groups` — Lists screen groups with member screen IDs.
- `POST /api/v1/screen-groups` — Creates new group.
- `PUT /api/v1/screen-groups/:id` — Updates group membership and assigned playlist.
- `DELETE /api/v1/screen-groups/:id` — Removes group.

### 9.7 Publishing & Remote Sync
- `POST /api/v1/publishing/dispatch` — Queues content bundle dispatch to target screens.
- `GET /api/v1/publishing/jobs` — Retrieves dispatch job history and progress.
- `POST /api/v1/publishing/jobs/:id/retry` — Re-triggers dispatch to offline/failed screens.

### 9.8 Android TV Device Endpoints (Screen API)
- `GET /api/v1/device/manifest` — Secure TV sync endpoint: Returns active playlist, media URLs, checksums, and display schedules.
- `POST /api/v1/device/heartbeat` — Periodic ping (every 30–60s) posting TV telemetry:
  ```json
  {
    "screenId": "DYPIU-TV-001",
    "status": "Online",
    "currentMediaId": "med-001",
    "storageUsedPct": 42,
    "appVersion": "v1.2.0",
    "ipAddress": "10.40.12.84",
    "playbackError": null
  }
  ```

### 9.9 Reports & Settings
- `GET /api/v1/reports/summary` — Aggregated uptime, playback cycles, and storage stats.
- `GET /api/v1/reports/export-csv` — Generates streaming CSV dataset.
- `GET /api/v1/settings` — Returns university signage configuration.
- `PUT /api/v1/settings` — Updates configuration.

---

## 10. NATIVE ANDROID TV PLAYER ARCHITECTURE (KOTLIN)

To power the Smart TVs across campus, a native Android TV application built in **Kotlin** is specified:

### 10.1 Key Technical Components
- **Language & Target:** Kotlin, targeting Android 9.0+ (API Level 28+) through Android 14 (Google TV / Android TV).
- **Architecture Pattern:** MVVM (Model-View-ViewModel) with Android Architecture Components and Kotlin Coroutines.
- **Video Engine:** Google `Media3` / `ExoPlayer` (`androidx.media3.exoplayer`)
  - Full hardware decoding for 1080p and 4K MP4 (H.264/H.265/HEVC).
  - SurfaceView / PlayerView with zero-gap looping and audio muting controls.
- **Image/Poster Engine:** `Coil-kt` (Kotlin-first image loader) or `Glide`
  - Pre-decoding images into memory cache with crossfade transitions matching the web settings (Fade, Slide, Cut).
- **Local Persistence & Offline Cache:**
  - `Room Database`: Stores local playlist manifest, schedules, and device configuration.
  - OkHttp with custom disk cache interceptor: Downloads media assets directly to internal device storage (`context.getExternalFilesDir(Environment.DIRECTORY_MOVIES)`).
  - **100% Offline Autonomy:** If campus Wi-Fi or internet disconnects, the player continues looping cached media uninterrupted.

### 10.2 Kiosk Resilience & Auto-Recovery
- **Boot Autostart:** `BOOT_COMPLETED` BroadcastReceiver automatically launches the player immediately upon TV power-on or reboot.
- **Crash Recovery:** Global `Thread.setDefaultUncaughtExceptionHandler` catches unexpected exceptions, logs the diagnostic error, and restarts the playback activity via an `AlarmManager` pending intent.
- **Screen Awake Lock:** Acquires `FLAG_KEEP_SCREEN_ON` and `PowerManager.FULL_WAKE_LOCK` to ensure Android TV never enters ambient screensaver or sleep mode during broadcast hours.
- **Foreground Playback Service:** Playback runs inside a sticky Foreground Service with notification to prevent Android OS memory pressure from killing the player.

### 10.3 Pairing & Synchronization Flow
```
TV Boot ➔ Check Stored Device Token in EncryptedSharedPreferences
   │
   ├─► [NO TOKEN]: Display Pairing Screen with 6-char Code & QR Code
   │      │
   │      └─► Polls /api/v1/screens/pair/status until Admin pairs in Web Console
   │             │
   │             └─► Stores Token ➔ Transitions to Playback
   │
   └─► [TOKEN FOUND]: Fetch /api/v1/device/manifest
          │
          ├─► Compare local media checksums (MD5/SHA256) with manifest
          ├─► Download new / modified media files to disk in background
          ├─► Delete obsolete media files no longer in active playlist
          ├─► Begin scheduled playlist rotation
          │
          └─► Launch background Coroutine for Heartbeat (every 30s)
```

---

## 11. PRODUCTION HOSTING ANALYSIS & DEPLOYMENT STRATEGY

### 11.1 Evaluation of Existing Hostinger Business Hosting
The user currently holds a **Hostinger Business Shared Web Hosting** plan. Here is the objective technical feasibility assessment:

| Component | Can It Run on Hostinger Business? | Details & Constraints |
|---|:---:|---|
| **React Frontend (SPA)** | ✅ **YES** | The built static bundle (`dist/`) can be uploaded to `public_html`. It serves with high speed via Hostinger's LiteSpeed web server and CDN. |
| **Node.js REST API** | ⚠️ **PARTIAL / LIMITED** | Hostinger Business supports Node.js via cPanel/hPanel CloudLinux LVE. However, it enforces **strict execution timeouts (60–120s)**, **RAM limits (1 GB - 1.5 GB)**, and **prohibits long-lived background daemons**. |
| **MySQL Database** | ✅ **YES** | Standard MySQL 8.0 databases are included. Suitable for normal CRUD operations and settings. |
| **Media Storage (Posters & MP4)** | ⚠️ **LIMITED** | While disk space is advertised as generous, shared hosting has **strict inode limits** and **bandwidth throttling** on high-concurrency video streaming to multiple simultaneous 4K TVs. |
| **Real-Time WebSockets / MQTT** | ❌ **NO** | Shared hosting environments terminate persistent WebSocket connections and do not allow running custom daemon listener ports. |
| **FFmpeg Video Transcoding** | ❌ **NO** | Shared hosting does not grant root access or binary execution permissions to run `ffmpeg` for video processing and thumbnail extraction. |

### 11.2 Recommended Infrastructure Approaches

#### Option A: Hybrid Setup (Recommended for Initial Launch — Lowest Cost)
Leverage your existing Hostinger hosting where it shines, and add a lightweight backend VPS:
- **Hostinger Business Hosting:** Hosts the compiled React Admin Frontend (`dist/`) and public domain/SSL.
- **Small Cloud VPS (Hostinger KVM 2 / DigitalOcean / Hetzner - ~$6 to $12/month):**
  - Runs Node.js API with PM2 process manager.
  - Runs MySQL 8.0 database with automated backups.
  - Runs WebSocket server for instant TV push updates.
  - Runs local FFmpeg for video processing.
  - Serves media files with Nginx caching.

#### Option B: Dedicated Cloud VPS (Best for Enterprise & Scalability)
Deploy the entire stack on a single Virtual Private Server (Ubuntu 24.04 LTS):
- **Reverse Proxy:** Nginx with Let's Encrypt SSL.
- **Frontend:** Served as static files directly via Nginx.
- **Backend:** Node.js Express cluster managed by PM2.
- **Database:** Dedicated MySQL instance with daily database dumps.
- **Storage:** Local NVMe disk or connected Cloudflare R2 bucket (zero egress cost for video streaming).

---

## 12. PHASED IMPLEMENTATION ROADMAP

```
┌────────────────────────────────────────────────────────────────────────┐
│                        IMPLEMENTATION ROADMAP                          │
└────────────────────────────────────────────────────────────────────────┘

  [PHASE 1: AUDIT & SPECIFICATION] ◄─── (COMPLETED)
         │
         ▼
  [PHASE 2: DATABASE & CORE BACKEND]
         │ • Initialize Express.js backend project structure
         │ • Set up MySQL tables, relations, and migrations
         │ • Implement JWT Authentication & RBAC middleware
         │ • Implement Media Upload API (Multer + Sharp)
         │ • Implement CRUD APIs for Playlists, Campaigns & Screens
         │
         ▼
  [PHASE 3: FRONTEND API BINDING]
         │ • Create typed Axios / Fetch API client
         │ • Connect React pages to real REST endpoints
         │ • Replace mock state in App.tsx with API queries
         │ • Test media uploads and playlist persistence
         │
         ▼
  [PHASE 4: REAL-TIME SYNC & MONITORING ENGINE]
         │ • Implement TV pairing handshake endpoints
         │ • Build TV heartbeat ingestion & offline detector cron
         │ • Set up WebSocket / SSE for instant publish notifications
         │
         ▼
  [PHASE 5: NATIVE ANDROID TV PLAYER (KOTLIN)]
         │ • Scaffold Android TV project with Media3 / Coil
         │ • Build Pairing Screen with PIN code display
         │ • Implement Offline Sync & Disk Caching Engine
         │ • Implement Kiosk auto-start on boot & crash recovery
         │
         ▼
  [PHASE 6: PRODUCTION DEPLOYMENT & TESTING]
         │ • Deploy MySQL, Node.js API, and Nginx reverse proxy
         │ • Deploy React frontend to production domain
         │ • End-to-end field test on physical campus Smart TVs
```

---

## AUDIT SIGN-OFF & NEXT STEPS

- **Phase 1 Audit Status:** **COMPLETE & VERIFIED**
- **Existing Frontend Integrity:** 100% Preserved. No code was deleted, modified, or refactored.
- **Ready for Phase 2:** Awaiting user review and authorization to begin backend implementation.

# Creative Video Platform — Frontend

React + TypeScript frontend for the AI Creative Video Platform.

## Stack

| Tool | Version | Purpose |
|------|---------|---------|
| React | 18 | UI framework |
| TypeScript | 5 | Type safety |
| Vite | 5 | Dev server & build |
| TanStack Query | 5 | Server state / data fetching |
| Zustand | 4 | Client state (auth, editor) |
| React Router | 6 | Client-side routing |
| Tailwind CSS | 3 | Styling |
| react-konva | 18 | Canvas editor (Konva.js) |
| zundo | — | Undo/redo for editor store |
| react-hook-form + zod | — | Form validation |
| lucide-react | — | Icons |
| axios | — | HTTP client |

## Project Structure

```
src/
├── App.tsx              # Root component (QueryClient + Router)
├── main.tsx             # Entry point
├── router.tsx           # All routes
├── index.css            # Tailwind + global styles
│
├── shared/
│   ├── types/index.ts   # All TypeScript types
│   ├── api/             # Axios API modules
│   ├── hooks/           # TanStack Query hooks
│   ├── stores/          # Zustand stores (auth, editor, toast)
│   └── components/
│       ├── ui/          # Button, Input, Select, Modal, Badge, Spinner, Toast
│       ├── layout/      # AppLayout, ProtectedRoute
│       ├── DataTable.tsx
│       ├── ErrorBoundary.tsx
│       └── RouteErrorPage.tsx
│
└── features/
    ├── auth/            # LoginPage, AccountPage
    ├── templates/       # TemplateListPage, TemplateFormPage
    ├── editor/          # EditorPage (fullscreen Konva canvas)
    │   ├── components/  # CanvasStage, LayerPanel, PropertyPanel
    │   └── utils/       # canvasUtils.ts
    ├── jobs/            # JobListPage, JobWizardPage, JobDetailPage
    ├── results/         # ResultsPage
    └── admin/           # AdminUsersPage
```

## Prerequisites

- Node.js 18+
- npm or pnpm
- Backend API running (see backend README)

## Setup

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env
# Edit .env: set VITE_API_BASE_URL to your backend URL
```

## Environment Variables

Create a `.env` file at the project root:

```env
# Backend API base URL (no trailing slash)
VITE_API_BASE_URL=http://localhost:8080/api
```

The Vite dev server proxies `/api` to the backend automatically (see `vite.config.ts`).

## Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Production Build

```bash
npm run build
# Output in dist/
npm run preview  # Preview production build locally
```

## Routes

| Path | Page | Auth |
|------|------|------|
| `/login` | Login | Public |
| `/templates` | Template List | Required |
| `/templates/new` | Create Template | Required |
| `/templates/:id/edit` | Edit Template | Required |
| `/editor/:templateId` | Canvas Editor | Required |
| `/jobs` | Job List | Required |
| `/jobs/new` | New Job Wizard | Required |
| `/jobs/:id` | Job Detail (SSE) | Required |
| `/jobs/:jobId/results` | Results | Required |
| `/account` | Account Settings | Required |
| `/admin/users` | User Management | Admin only |

## Key Features

### Canvas Editor
- Full-screen Konva.js canvas with real-time layer editing
- Drag, resize, and rotate layers with transformer handles
- Text layers with inline property editing
- Aspect ratio switcher (16:9, 9:16, 1:1, etc.)
- Zoom controls (10%–500%)
- Undo/redo (Ctrl+Z / Ctrl+Y) powered by `zundo`
- Grid overlay and safe area guides
- Layer panel with visibility & lock toggles

### Job Wizard
- Multi-step: Template → Video Upload → Languages/Voices → Confirm
- Presigned URL video upload to S3 with progress bar
- Language multi-select, AI voice & subtitle options

### Real-time Job Tracking
- SSE (Server-Sent Events) for live step progress
- Execution timeline with per-step status and timing
- Retry/cancel actions

### Results
- Grouped by language × aspect ratio
- Thumbnail previews with direct download links

## Testing

```bash
npm run test         # Watch mode
npm run test:ui      # Vitest UI
npm run test:coverage
```

## Linting

```bash
npm run lint
```

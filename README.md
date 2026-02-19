# KnowYourFaculty

KnowYourFaculty is a React + Appwrite web app for browsing faculty profiles, submitting feedback, viewing rankings, and managing polls.

## Highlights

- Faculty directory with search and filters
- Faculty profile page with ratings and feedback
- Rankings page with responsive filters
- Polls with create/edit/delete and active/ended states
- Admin panel for setup and course PDF upload parsing
- Light/dark theme support and mobile-first UI

## Tech Stack

- React 19 + Vite 7
- Redux Toolkit + React Redux
- React Router
- Tailwind CSS 4
- Appwrite (auth, database, storage)
- Font Awesome

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Appwrite project with required database/storage setup

### Install

```bash
npm install
```

### Environment Variables

Create a `.env` file in project root and configure:

```env
VITE_APPWRITE_URL=
VITE_APPWRITE_PROJECT_ID=
VITE_APPWRITE_DB_ID=
VITE_APPWRITE_TABLE_ID=
VITE_APPWRITE_BUCKET_ID=
VITE_APPWRITE_API_TOKEN=
VITE_AUTH_TOKEN=
```

## Run Locally

```bash
npm run dev
```

App runs on Vite default dev server (usually http://localhost:5173).

## Scripts

| Script                            | Purpose                       |
| --------------------------------- | ----------------------------- |
| `npm run dev`                     | Start development server      |
| `npm run build`                   | Build production bundle       |
| `npm run preview`                 | Preview production build      |
| `npm run lint`                    | Run ESLint                    |
| `npm run scraper:run`             | Run one-time faculty scrape   |
| `npm run faculty:stats`           | Print faculty stats from repo |
| `npm run faculty:count`           | Print total faculty count     |
| `npm run reviews:fix-permissions` | Fix review permissions script |

## Project Structure

```text
src/
  components/
    admin/
    faculty/
    feedback/
    layout/
    overlays/
    ui/
  config/
  data/
  lib/
    appwrite/
    parsers/
    scraper/
  pages/
  services/
  store/
scripts/
functions/
```

## Component Organization

Components are grouped by feature area in `src/components`:

- `admin` → admin and setup tools
- `faculty` → faculty listing/profile cards
- `feedback` → feedback and rating widgets
- `layout` → navigation/footer shell
- `overlays` → modal/overlay components
- `ui` → shared UI utilities (toasts, etc.)

## Build & Deployment

### Production Build

```bash
npm run build
```

Output goes to `dist/`.

### Preview Build

```bash
npm run preview
```

## Troubleshooting

- If the app shows empty data, verify Appwrite IDs and permissions in `.env`.
- If routes/components fail after refactors, re-check relative import paths from nested folders.
- If course upload parsing fails, verify parser dependency and admin import paths.

## Notes

- Route pages are lazy-loaded in `src/App.jsx`.
- Faculty/course/poll operations are implemented through services in `src/services`.
- State management is centralized in Redux slices under `src/store`.

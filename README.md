# KnowYourFaculty — Student-Driven Faculty Feedback

KnowYourFaculty is a modern, anonymous faculty feedback platform built with React and Supabase. Students can discover faculty profiles, submit honest reviews and ratings, view rankings, and participate in polls — all while maintaining complete anonymity.

## ✨ Key Features

- **Anonymous Feedback** — Verified student accounts with publicly anonymous reviews
- **Faculty Directory** — Search and filter faculty by department, course, tier, or rating status
- **Intelligent Ratings** — Custom tier system (Rod-God, Rod, Moderate, Loose, Loose-Good)
- **Guest Access** — View ratings without login; submit reviews as a verified student
- **Multilingual Moderation** — Content filtering in 8+ languages (Telugu, Hindi, Tamil, Malayalam, Gujarati, Marathi, Urdu, Bhojpuri, English)
- **Community Polls** — Create, vote, and view real-time poll results
- **Responsive Design** — Mobile-first UI with light/dark theme support
- **Enhanced Privacy** — Comprehensive privacy policy and account deletion controls
- **SEO Optimized** — Open Graph and Twitter Card integration

## 🎯 Rating System

- **Logged Users** see tier labels: Rod-God (5) → Rod (4) → Moderate (3) → Loose (2) → Loose-Good (1)
- **Guest Users** see numeric ratings: 5.0, 4.0, 3.0, etc.
- **Optional Ratings** — Submit reviews without ratings, or ratings without reviews

## 🛠 Tech Stack

- **React 19.2** — Modern UI with hooks and concurrent features
- **Vite 7** — Lightning-fast build tool with HMR
- **Redux Toolkit 2** — Centralized state management
- **React Router 7** — Client-side routing with lazy loading
- **Tailwind CSS 4** — Utility-first styling with custom CSS variables
- **Supabase** — Postgres database, auth, and Edge Functions
- **Cloudinary** — Image storage and delivery (faculty photos)
- **sharp** — Server-side JPEG conversion before upload
- **Font Awesome 7** — Icon library

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase project (database + auth)
- Cloudinary account (image uploads)

### Installation

```bash
npm install
```

### Environment Configuration

Copy `.env.sample` to `.env` and fill in your values:

```bash
cp .env.sample .env
```

Key variable groups:

```env
# ── Client (Vite / browser) ──────────────────────────────────────
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_FACULTY_TABLE=faculty
VITE_SUPABASE_REVIEW_TABLE=reviews
VITE_SUPABASE_COURSES_TABLE=courses
VITE_SUPABASE_POLL_TABLE=polls
VITE_SUPABASE_POLL_VOTES_TABLE=poll_votes
VITE_SUPABASE_DELETE_ACCOUNT_RPC=delete_my_account
VITE_SITE_URL=http://localhost:5173

# ── Client image delivery (Cloudinary) ──────────────────────────
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_FOLDER=faculty_photos
VITE_CLOUDINARY_UPLOAD_PRESET=

# ── Server / scripts (Supabase service role) ────────────────────
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_FACULTY_TABLE=faculty

# ── Server image uploads (Cloudinary) ───────────────────────────
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=faculty_photos

# ── Edge Function (weekly scraper) ──────────────────────────────
DB_URL=
DB_SERVICE_ROLE_KEY=
DB_FACULTY_TABLE=faculty
DB_CRON_SECRET=

# ── Access control ───────────────────────────────────────────────
VITE_ADMIN_EMAILS=
AUTH_TOKEN=
```

See `.env.sample` for the full list of variables.

### Development Server

```bash
npm run dev
```

Runs on `http://localhost:5173` (Vite default port)

## 📜 Available Scripts

| Command                                    | Description                                   |
| ------------------------------------------ | --------------------------------------------- |
| `npm run dev`                              | Start development server with HMR             |
| `npm run build`                            | Build optimized production bundle             |
| `npm run preview`                          | Preview production build locally              |
| `npm run lint`                             | Run ESLint for code quality                   |
| `npm run scraper:run`                      | Execute a one-time faculty data scrape        |
| `npm run faculty:stats`                    | Display faculty statistics                    |
| `npm run faculty:count`                    | Show total faculty count                      |
| `npm run supabase:functions:serve:weekly`  | Serve the weekly-scrape Edge Function locally |
| `npm run supabase:functions:deploy:weekly` | Deploy the weekly-scrape Edge Function        |

## 📂 Project Structure

```text
KnowYourFaculty/
├── src/
│   ├── components/          # React components by feature
│   │   ├── admin/          # Admin panel & setup tools
│   │   ├── faculty/        # Faculty cards & listings
│   │   ├── feedback/       # Rating sliders & review forms
│   │   ├── layout/         # Navigation & footer
│   │   ├── overlays/       # Modals & dialogs
│   │   └── ui/             # Shared UI components (toasts)
│   ├── config/             # Client & server configuration
│   ├── data/               # Static data (review filters)
│   ├── lib/                # Utilities & helpers
│   │   ├── cloudinary/     # Cloudinary URL builder & upload helpers
│   │   ├── firebase/       # Supabase/DB wrappers (legacy name)
│   │   ├── supabase/       # Supabase client helpers
│   │   ├── parsers/        # Course PDF parser
│   │   └── scraper/        # Faculty data scraper (Node)
│   ├── pages/              # Route page components
│   ├── services/           # Business logic layer
│   └── store/              # Redux slices & store config
├── scripts/                # One-time utility scripts
├── supabase/
│   ├── functions/
│   │   └── weekly-scrape/  # Deno Edge Function (pg_cron triggered)
│   └── migrations/         # SQL migration files
├── public/                 # Static assets
└── dist/                   # Production build output
```

## 🔄 Weekly Scraper

Faculty data is automatically kept in sync via a Supabase Edge Function triggered by `pg_cron`:

- Scrapes faculty profiles from the VIT-AP CMS
- Employee IDs are normalised to digits-only canonical form (`11.70279` → `1170279`)
- New faculty are inserted; existing faculty are skipped
- Photos are fetched, converted to JPEG via `format=jpg`, and stored in Cloudinary under `faculty_photos/<employeeId>.jpg`
- A `dryRun=true` query parameter runs the scraper in read-only mode

Deploy / serve locally:

```bash
npm run supabase:functions:deploy:weekly   # production
npm run supabase:functions:serve:weekly    # local dev
```

### Cron Setup (Supabase)

This repository includes a ready-to-run SQL script at `supabase/sql/setup_weekly_scrape_cron.sql`.

1. Deploy the Edge Function:

```bash
npm run supabase:functions:deploy:weekly
```

2. In Supabase SQL Editor, open `supabase/sql/setup_weekly_scrape_cron.sql`.
3. Replace `<project-ref>` with your Supabase project ref.
4. Ensure the function secret (`DB_CRON_SECRET`) and vault secret (`db_cron_secret`) use the same value.
5. Run the script and verify job creation with the included `cron.job` query.

If `DB_CRON_SECRET` is set but the cron request does not send `x-cron-secret`, the function returns `401 Unauthorized`.

## 🎨 Design System

### Color Themes

The app supports light and dark themes via CSS custom properties:

- **Light Theme** — Clean whites with sky blue accents
- **Dark Theme** — Deep slate backgrounds with cyan accents
- **Tier Colors** — Green (Rod-God) → Orange (Rod) → Yellow (Moderate) → Lime (Loose) → Green (Loose-Good)

### Responsive Breakpoints

- Mobile: `<640px`
- Tablet: `640px – 1024px`
- Desktop: `>1024px`

## 🚢 Build & Deployment

### Production Build

```bash
npm run build
```

Generates an optimised bundle in `dist/` with code splitting, tree-shaking, minification, and lazy-loaded route components.

### Deployment (Vercel)

The project is configured for Vercel with:

**Security Headers** (`vercel.json`):

- HSTS (Strict-Transport-Security)
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy

**Cache Policy**:

- Static assets: `max-age=31536000, immutable`
- HTML: no-cache for dynamic routing

### SEO Configuration

**Meta Tags** (`index.html`):

- Open Graph tags for social media sharing
- Twitter Card integration
- Canonical URL
- Structured metadata (description, keywords, author)

## 🔒 Privacy & Security

### User Privacy

- **Anonymous Reviews** — All feedback is publicly anonymous
- **Verified Students** — Login required only for identity verification
- **Account Deletion** — 24-hour grace period with instant delete option
- **Data Control** — Users can edit/delete their own reviews

### Content Moderation

- **Multilingual Filter** — Blocks offensive content in 8+ languages
- **Real-time Validation** — Reviews checked before submission
- **Unicode Support** — Proper handling of non-Latin scripts

## 🛠 Troubleshooting

### Common Issues

**Empty Data / 401 Errors**

- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`
- Check Supabase Row-Level Security policies on `faculty` and `reviews` tables
- Confirm the service role key is set for server-side scripts

**Build Failures**

- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Check Node.js version: `node --version` (should be 18+)
- Verify all required environment variables are set

**Route 404 Errors**

- Ensure `vercel.json` rewrites are configured
- Check React Router routes in `src/App.jsx`
- Verify lazy-loaded imports resolve correctly

**Theme Not Switching**

- Check `data-theme` attribute on `<html>` element
- Verify CSS custom properties in `src/index.css`
- Clear browser cache and hard refresh

**Photos Not Loading**

- Confirm `VITE_CLOUDINARY_CLOUD_NAME` matches the cloud name in Cloudinary
- Verify `photoFileId` values in the DB follow the `faculty_photos/<id>.jpg` pattern
- Check that `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` are set for server uploads

## 📝 Development Notes

- **Code Splitting** — All routes are lazy-loaded in `src/App.jsx`
- **State Management** — Redux Toolkit slices in `src/store/`
- **API Services** — Centralized in `src/services/` for reusability
- **Performance** — `useMemo`/`useCallback` for expensive operations
- **Accessibility** — ARIA labels and semantic HTML throughout

## 🤝 Contributing

This is a student-driven community project. Contributions are welcome!

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- Built with ❤️ for students, by students
- Powered by Supabase and Cloudinary
- UI inspired by modern design principles

# KnowYourFaculty — Student-Driven Faculty Feedback

KnowYourFaculty is a modern, anonymous faculty feedback platform built with React and Appwrite. Students can discover faculty profiles, submit honest reviews and ratings, view rankings, and participate in polls — all while maintaining complete anonymity.

## ✨ Key Features

- **Anonymous Feedback** — Verified student accounts with publicly anonymous reviews
- **Faculty Directory** — Search and filter faculty by department, designation, and courses
- **Intelligent Ratings** — Custom tier system (Rod-God, Rod, Moderate, Loose, Loose-Good)
- **Guest Access** — View ratings without login; submit reviews as verified student
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
- **Appwrite 21** — Backend-as-a-Service (auth, database, storage)
- **Font Awesome 7** — Icon library

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Appwrite account with configured project

### Installation

```bash
npm install
```

### Environment Configuration

Create a `.env` file in the project root:

```env
# Appwrite Configuration
VITE_APPWRITE_URL=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your_project_id

# Database & Collections
VITE_APPWRITE_DB_ID=your_database_id
VITE_APPWRITE_TABLE_ID=your_faculty_collection_id

# Storage
VITE_APPWRITE_BUCKET_ID=your_bucket_id

# API Authentication
VITE_APPWRITE_API_TOKEN=your_api_token
VITE_AUTH_TOKEN=your_auth_token
```

### Development Server

```bash
npm run dev
```

Runs on `http://localhost:5173` (Vite default port)

## 📜 Available Scripts

| Command                           | Description                          |
| --------------------------------- | ------------------------------------ |
| `npm run dev`                     | Start development server with HMR    |
| `npm run build`                   | Build optimized production bundle    |
| `npm run preview`                 | Preview production build locally     |
| `npm run lint`                    | Run ESLint for code quality          |
| `npm run scraper:run`             | Execute one-time faculty data scrape |
| `npm run faculty:stats`           | Display faculty statistics           |
| `npm run faculty:count`           | Show total faculty count             |
| `npm run reviews:fix-permissions` | Repair review document permissions   |

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
│   │   ├── appwrite/       # Appwrite SDK wrappers
│   │   ├── parsers/        # Course PDF parser
│   │   └── scraper/        # Faculty data scraper
│   ├── pages/              # Route page components
│   ├── services/           # Business logic layer
│   └── store/              # Redux slices & store config
├── scripts/                # Utility scripts
├── functions/              # Serverless functions
├── public/                 # Static assets
└── dist/                   # Production build output
```

## 🎨 Design System

### Color Themes

The app supports light and dark themes with CSS custom properties:

- **Light Theme** — Clean whites with sky blue accents
- **Dark Theme** — Deep slate backgrounds with cyan accents
- **Tier Colors** — Green (Rod-God) → Orange (Rod) → Yellow (Moderate) → Lime (Loose) → Green (Loose-Good)

### Responsive Breakpoints

- Mobile: `<640px`
- Tablet: `640px - 1024px`
- Desktop: `>1024px`

## 🚢 Build & Deployment

### Production Build

```bash
npm run build
```

Generates optimized bundle in `dist/` directory with:

- Code splitting and tree-shaking
- Minification and compression
- Lazy-loaded route components
- Asset optimization

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
- HTML: No cache for dynamic routing

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

- Verify Appwrite project ID and database IDs in `.env`
- Check collection permissions (read: anyone, write: users)
- Confirm API token has required scopes

**Build Failures**

- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Check Node.js version: `node --version` (should be 18+)
- Verify all environment variables are set

**Route 404 Errors**

- Ensure `vercel.json` rewrites are configured
- Check React Router routes in `src/App.jsx`
- Verify lazy-loaded imports resolve correctly

**Theme Not Switching**

- Check `data-theme` attribute on `<html>` element
- Verify CSS custom properties in `src/index.css`
- Clear browser cache and hard refresh

## 📝 Development Notes

- **Code Splitting** — All routes are lazy-loaded in `src/App.jsx`
- **State Management** — Redux Toolkit slices in `src/store/`
- **API Services** — Centralized in `src/services/` for reusability
- **Type Safety** — PropTypes validation on key components
- **Performance** — useMemo/useCallback for expensive operations
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
- Powered by Appwrite's excellent BaaS platform
- UI inspired by modern design principles

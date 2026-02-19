# Components Structure

This directory contains all React components organized by functionality for better maintainability and scalability.

## Directory Structure

```
components/
├── admin/          # Admin-specific components
├── faculty/        # Faculty-related display components
├── feedback/       # Rating and feedback components
├── layout/         # Layout components (header, footer)
├── overlays/       # Modal/overlay components
└── ui/             # General UI components
```

## Component Categories

### 📁 admin/

Admin panel and setup components.

- **AdminPanel.jsx** - Admin dashboard for managing content
- **SetupHelper.jsx** - Initial setup wizard for first-time configuration
- **index.js** - Barrel export file

### 📁 faculty/

Components for displaying faculty information.

- **FacultyCard.jsx** - Faculty card with photo, ratings, and basic info (✨ memoized)
- **FacultyList.jsx** - List view of faculty members
- **FacultyProfileCard.jsx** - Detailed faculty profile display
- **FacultyRatingsCard.jsx** - Faculty ratings display with tier system
- **index.js** - Barrel export file

### 📁 feedback/

Components for rating and feedback functionality.

- **FeedbackList.jsx** - Display list of feedback/reviews
- **RatingSlider.jsx** - Interactive rating slider component (✨ memoized)
- **index.js** - Barrel export file

### 📁 layout/

Main layout components used across the application.

- **SiteNav.jsx** - Navigation bar with responsive menu
- **SiteFooter.jsx** - Footer with links and social media (✨ memoized)
- **index.js** - Barrel export file

### 📁 overlays/

Modal and overlay components for dialogs.

- **Overlay.jsx** - Base overlay component with backdrop (✨ memoized)
- **LoginOverlay.jsx** - Login/authentication modal
- **ConfirmOverlay.jsx** - Confirmation dialog (✨ memoized)
- **CreatePollOverlay.jsx** - Poll creation/editing modal
- **index.js** - Barrel export file

### 📁 ui/

General purpose UI components.

- **ToastContainer.jsx** - Toast notification system
- **index.js** - Barrel export file

## Performance Optimizations

### React.memo

Components marked with ✨ are wrapped with `React.memo` to prevent unnecessary re-renders:

- **FacultyCard** - Frequently rendered in lists
- **Overlay** - Base component used by multiple overlays
- **ConfirmOverlay** - Frequently toggled dialog
- **RatingSlider** - Interactive input component
- **SiteFooter** - Static layout component

### Lazy Loading

All pages are lazy-loaded in `App.jsx` using `React.lazy` and `Suspense` for code splitting:

- Landing Page
- Faculty Directory
- Faculty Detail Page
- User Dashboard
- Rankings Page
- Poll Page
- Contact/Privacy/Terms pages

### Barrel Exports

Each category has an `index.js` file for cleaner imports:

```javascript
// Before
import FacultyCard from "../components/faculty/FacultyCard.jsx";
import FacultyList from "../components/faculty/FacultyList.jsx";

// After (optional usage)
import { FacultyCard, FacultyList } from "../components/faculty";
```

## Import Patterns

### From Pages

```javascript
// Import from specific component folder
import FacultyCard from "../components/faculty/FacultyCard.jsx";
import { ConfirmOverlay } from "../components/overlays";
```

### Within Components

```javascript
// Relative imports within same category
import Overlay from "./Overlay.jsx";

// Cross-category imports
import ConfirmOverlay from "../overlays/ConfirmOverlay.jsx";
```

## Component Guidelines

### Creating New Components

1. **Choose the right category**:
   - Admin features → `admin/`
   - Faculty display → `faculty/`
   - Ratings/feedback → `feedback/`
   - Navigation/footer → `layout/`
   - Modals/dialogs → `overlays/`
   - General UI → `ui/`

2. **Add to barrel export**:
   Update the category's `index.js` file:

   ```javascript
   export { default as NewComponent } from "./NewComponent.jsx";
   ```

3. **Consider memoization**:
   Use `React.memo` for:
   - Components rendered in lists
   - Components with expensive render logic
   - Static components that rarely change
   - Base components used by many others

4. **Keep imports organized**:
   - React imports first
   - Third-party libraries
   - Local components
   - Services/utilities
   - Styles/assets

## Best Practices

- ✅ Use functional components with hooks
- ✅ Wrap expensive components with `React.memo`
- ✅ Use proper TypeScript/PropTypes for type safety
- ✅ Keep components focused and single-purpose
- ✅ Use barrel exports for cleaner imports
- ✅ Follow consistent naming conventions
- ✅ Add JSDoc comments for complex components
- ✅ Lazy load route components

## Notes

- All pages are located in `src/pages/` directory
- Services are in `src/services/` directory
- Redux store slices are in `src/store/` directory
- Utility functions are in `src/lib/` directory

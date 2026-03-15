import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function getManualChunk(id) {
  if (!id) return undefined

  if (id.includes('node_modules')) {
    if (id.includes('/react/') || id.includes('/react-dom/')) {
      return 'vendor-react'
    }
    if (id.includes('react-router') || id.includes('history')) {
      return 'vendor-router'
    }
    if (id.includes('@reduxjs') || id.includes('react-redux')) {
      return 'vendor-state'
    }
    if (id.includes('@supabase') || id.includes('/firebase/')) {
      return 'vendor-backend'
    }
    if (id.includes('@fortawesome')) {
      return 'vendor-icons'
    }
    if (id.includes('fuse.js') || id.includes('obscenity')) {
      return 'vendor-search'
    }
    if (id.includes('pdfjs-dist')) {
      return 'vendor-pdf'
    }
  }

  if (id.includes('/src/services/publicFacultyService.js')) {
    return 'data-faculty'
  }
  if (id.includes('/src/services/courseService.js')) {
    return 'data-courses'
  }
  if (id.includes('/src/services/facultyFeedbackService.js')) {
    return 'data-feedback'
  }
  if (id.includes('/src/services/pollService.js')) {
    return 'data-polls'
  }
  if (id.includes('/src/lib/fuzzySearch.js') || id.includes('/src/lib/reviewFilter.js')) {
    return 'app-search'
  }
  return undefined
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: getManualChunk,
      },
    },
  },
})

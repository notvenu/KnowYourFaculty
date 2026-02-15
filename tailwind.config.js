export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
  safelist: [
    // CSS variable patterns - add extensively to bypass linting
    {
      pattern: /^(bg|text|border|border-t|hover:bg|hover:text|hover:border|focus:border|focus:ring|from|to|via)\[var\(--[\w-]+\)\]$/,
    },
  ],
}


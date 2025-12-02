export default {
  plugins: {
    // Enables CSS nesting, allowing for cleaner, Sass-like syntax.
    // Must be placed before tailwindcss.
    'tailwindcss/nesting': {},

    // The core Tailwind CSS plugin.
    tailwindcss: {},

    // Automatically adds vendor prefixes to CSS rules for browser compatibility.
    autoprefixer: {},

    // Minifies CSS for production builds to reduce file size.
    // Vite handles this, but explicit inclusion provides more control.
    ...(process.env.NODE_ENV === 'production' ? { cssnano: {} } : {}),
  },
}

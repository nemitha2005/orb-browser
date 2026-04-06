/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/**/*.{html,ts}',
  ],
  theme: {
    extend: {
      colors: {
        'orb-bg': '#0f0f0f',
        'orb-surface': '#1a1a1a',
        'orb-surface-2': '#242424',
        'orb-border': '#2e2e2e',
        'orb-accent': '#7c5cfc',
        'orb-accent-dim': '#5a3fd4',
        'orb-text': '#e8e8e8',
        'orb-text-dim': '#777777',
      },
      borderRadius: {
        orb: '8px',
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/**/*.{html,ts}',
  ],
  theme: {
    extend: {
      colors: {
        'orb-bg': 'var(--orb-bg)',
        'orb-surface': 'var(--orb-surface)',
        'orb-surface-2': 'var(--orb-surface-2)',
        'orb-border': 'var(--orb-border)',
        'orb-border-hi': 'var(--orb-border-hi)',
        'orb-accent': 'var(--orb-accent)',
        'orb-accent-dim': 'var(--orb-accent-dim)',
        'orb-accent-soft': 'var(--orb-accent-soft)',
        'orb-text': 'var(--orb-text)',
        'orb-text-dim': 'var(--orb-text-dim)',
        'orb-green': 'var(--orb-green)',
        'orb-red': 'var(--orb-red)',
        'orb-yellow': 'var(--orb-yellow)',
      },
      borderRadius: {
        orb: '6px',
      },
    },
  },
  plugins: [],
};

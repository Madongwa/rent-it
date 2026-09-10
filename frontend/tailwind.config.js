/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        text: {
          primary: '#09090b',
          secondary: '#18181b',
          muted: '#52525b',
        },
        line: '#ececee', // hairline border - replaces shadows everywhere
        canvas: '#f4f4f5', // page background
        surface: {
          DEFAULT: '#ffffff', // card background
          dark: '#18181b', // dark feature blocks
          darker: '#27272a',
        },
        // Single accent, used only for small badges/tags - never a large
        // fill, body text, or link color.
        accent: '#2e7d32',
        // Dark editorial system - scoped to the Home page only (hero
        // narrative + category cards). Kept separate from the tokens above
        // so the rest of the site's light theme is untouched.
        night: {
          bg: '#000000',
          elevated: '#0a0a0a',
          card: '#353535',
          text: '#ffffff',
          muted: '#999999',
          border: '#e5e5e5',
        },
        // Home page's own accent, wired through a CSS variable (see
        // index.css) so swapping it later - e.g. to green - is a one-line
        // change instead of hunting through components.
        homeAccent: 'var(--home-accent)',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'ui-sans-serif', 'sans-serif'],
      },
      fontSize: {
        display: ['64px', { lineHeight: '1.12', fontWeight: '600' }],
        'heading-lg': ['56px', { lineHeight: '1.14', fontWeight: '600' }],
        heading: ['40px', { lineHeight: '1.18', fontWeight: '600' }],
        'heading-sm': ['32px', { lineHeight: '1.22', fontWeight: '700' }],
        subheading: ['20px', { lineHeight: '1.28', fontWeight: '600' }],
        body: ['15px', { lineHeight: '1.45', fontWeight: '400' }],
        caption: ['13px', { lineHeight: '1.45', fontWeight: '400' }],
      },
      borderRadius: {
        card: '36px',
        btn: '14px',
        badge: '12px',
      },
    },
  },
  plugins: [],
};

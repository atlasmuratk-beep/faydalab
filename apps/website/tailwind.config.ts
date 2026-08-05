import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'brand-bg': '#0B0B0D',
        'brand-surface': '#151518',
        'brand-text': '#F5F5F5',
        'brand-gold': '#D4AF37',
        'brand-muted': '#B8BDC7',
        'brand-border': '#2A2A2F',
      },
      backgroundImage: {
        'brand-radial': 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(212,175,55,0.16), transparent)',
      },
      fontFamily: {
        heading: ['var(--font-heading)'],
        subheading: ['var(--font-subheading)'],
        body: ['var(--font-body)'],
      },
    },
  },
  plugins: [],
} satisfies Config

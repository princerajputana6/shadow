import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0b',
        surface: '#141417',
        border: '#27272a',
        text: '#fafafa',
        muted: '#a1a1aa',
        accent: '#fb923c'
      }
    }
  },
  plugins: []
}

export default config

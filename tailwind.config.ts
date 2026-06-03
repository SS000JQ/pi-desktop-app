import type { Config } from 'tailwindcss'

export default {
  content: ['./src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#1E293B',
        border: '#334155',
        muted: '#64748B',
        dim: '#475569',
        accent: '#3B82F6',
        'accent-hover': '#2563EB',
        success: '#22C55E',
        warning: '#F97316',
        error: '#EF4444',
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        '2xs': '0.625rem',
      }
    }
  }
}

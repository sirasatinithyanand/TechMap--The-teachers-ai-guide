import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#000000',
        'on-primary': '#e2e2e2',
        'primary-fixed': '#5e5e5e',
        'primary-fixed-dim': '#474747',
        'primary-container': '#3b3b3b',
        'on-primary-container': '#ffffff',
        secondary: '#5e5e5e',
        'secondary-fixed': '#c6c6c6',
        'secondary-fixed-dim': '#ababab',
        'secondary-container': '#d4d4d4',
        'on-secondary-container': '#1b1b1b',
        tertiary: '#3b3b3b',
        'tertiary-container': '#747474',
        'on-tertiary': '#e2e2e2',
        'on-tertiary-container': '#ffffff',
        surface: '#f9f9f9',
        'surface-bright': '#f9f9f9',
        'surface-dim': '#dadada',
        'surface-variant': '#e2e2e2',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f3f3f4',
        'surface-container': '#eeeeee',
        'surface-container-high': '#e8e8e8',
        'surface-container-highest': '#e2e2e2',
        'on-surface': '#1a1c1c',
        'on-surface-variant': '#474747',
        'inverse-surface': '#2f3131',
        'inverse-on-surface': '#f0f1f1',
        outline: '#777777',
        'outline-variant': '#c6c6c6',
        error: '#ba1a1a',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        headline: ['Inter', 'system-ui', 'sans-serif'],
        label: ['Space Grotesk', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0,0,0,0.06)',
        'lifted': '0 8px 24px rgba(0,0,0,0.10)',
        'float': '0 8px 64px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
}

export default config

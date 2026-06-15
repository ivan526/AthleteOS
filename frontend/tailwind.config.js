/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#5BBE8A',
          dark: '#2F8F64',
        },
        background: {
          page: '#F4FAF7',
          card: '#FFFFFF',
          weak: '#EAF7F0',
        },
        status: {
          success: '#22A06B',
          warning: '#F59E0B',
          danger: '#EF6B6B',
          info: '#3B82F6',
        },
        text: {
          primary: '#10231A',
          secondary: '#6B7C72',
          muted: '#93A39A',
        },
        border: {
          DEFAULT: '#DDEBE3',
        }
      },
      fontFamily: {
        sans: [
          'PingFang SC',
          'Noto Sans SC',
          'Microsoft YaHei',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
        inter: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        'card': '20px',
        'button': '16px',
        'tag': '999px',
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0, 0, 0, 0.04)',
      }
    },
  },
  plugins: [],
}

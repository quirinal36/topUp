/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // 카페 테마 색상 팔레트
      colors: {
        // Primary - 커피 브라운
        primary: {
          50: '#faf6f3',
          100: '#f2e8e1',
          200: '#e4cfc1',
          300: '#d4b19d',
          400: '#c18f74',
          500: '#a6714f',
          600: '#8b5a3c',
          700: '#6d4630',
          800: '#4f3323',
          900: '#3a2518',
          950: '#251710',
        },
        // Secondary - 크림/베이지
        secondary: {
          50: '#fdfcfa',
          100: '#faf7f2',
          200: '#f5ede0',
          300: '#ede0c8',
          400: '#e2cfad',
          500: '#d4ba8c',
          600: '#c4a56e',
          700: '#a88a54',
          800: '#8a7045',
          900: '#6d5838',
        },
        // 성공 - 그린
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        // 경고 - 옐로우
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        // 에러 - 레드
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
        },
      },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'heading-1': ['2rem', { lineHeight: '1.25', fontWeight: '700' }],
        'heading-2': ['1.5rem', { lineHeight: '1.3', fontWeight: '600' }],
        'heading-3': ['1.25rem', { lineHeight: '1.4', fontWeight: '600' }],
      },
      spacing: {
        'touch': '2.75rem',
        'touch-lg': '3rem',
      },
      borderRadius: {
        'card': '0.75rem',
        'button': '0.5rem',
        'modal': '1rem',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        'card-hover': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        'modal': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      minHeight: {
        'touch': '2.75rem',
      },
      minWidth: {
        'touch': '2.75rem',
      },
    },
  },
  plugins: [],
}

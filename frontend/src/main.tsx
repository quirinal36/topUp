import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App'
import './index.css'

// Sentry 초기화 (production만)
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_APP_ENV || 'development',
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 0.1, // 성능 모니터링 10%
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0, // 에러 발생 시 100% 리플레이
  })
}

// 다크모드 초기화
const savedDarkMode = localStorage.getItem('auth-storage');
if (savedDarkMode) {
  try {
    const parsed = JSON.parse(savedDarkMode);
    if (parsed.state?.darkMode) {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {
    // ignore
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<p>오류가 발생했습니다.</p>}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
)

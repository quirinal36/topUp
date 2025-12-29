import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

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
    <App />
  </React.StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ToastProvider } from './contexts/ToastContext.tsx'

// Validate root element exists before rendering
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find root element. Check that index.html contains <div id="root"></div>');
}

createRoot(rootElement).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)

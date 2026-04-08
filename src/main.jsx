import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'  // <--- 必须要有这一行！
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
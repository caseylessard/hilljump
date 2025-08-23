import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initializeCache } from './lib/cacheUtils.ts'

// Initialize cache system
initializeCache().catch(console.error);

createRoot(document.getElementById("root")!).render(<App />);

import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import './lib/sentry';
import './index.css';

// No <React.StrictMode>: in development it mounts every component twice,
// and metal-fx (the navbar pills' metal ring and halo) doesn't survive that -
// its animation never starts, so the halo was missing on localhost while
// the live site (a production build, where StrictMode does nothing) had it.
ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </AuthProvider>
  </BrowserRouter>
);

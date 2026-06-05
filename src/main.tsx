import React from 'react';
import './index.css';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { getGoogleClientId, getGoogleClientIdSetupHint, isGoogleOAuthConfigured } from './config/googleAuth';

const clientId = getGoogleClientId();
const setupHint = getGoogleClientIdSetupHint();
if (setupHint) {
  // eslint-disable-next-line no-console
  console.warn('[LogBox]', setupHint);
}

const container = document.getElementById('root');
if (!container) throw new Error('Root container missing');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <GoogleOAuthProvider clientId="468667237419-3sk9i6nlrpfl5i6f1f283boam8rfr948.apps.googleusercontent.com">
        <App />
      </GoogleOAuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);

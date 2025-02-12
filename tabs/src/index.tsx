import React from 'react';
import ReactDOM from 'react-dom';
import {
  PublicClientApplication,
  EventType,
  EventMessage,
  AuthenticationResult,
} from '@azure/msal-browser';
import { msalConfig } from './services/authConfig';
import { BrowserRouter as Router } from 'react-router-dom';
import { ThemeProvider } from '@fluentui/react';
import { theme } from './styles/Theme'; // Adjust the import path as necessary
import App from './App'; // Adjust the import path as necessary
import { CacheProvider } from './utils/CacheContext';

export const msalInstance = new PublicClientApplication(msalConfig);

msalInstance.initialize().then(() => {
  // Account selection logic is app dependent. Adjust as needed for different use cases.
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    msalInstance.setActiveAccount(accounts[0]);
  }

  msalInstance.addEventCallback((event: EventMessage) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
      const payload = event.payload as AuthenticationResult;
      const account = payload.account;
      msalInstance.setActiveAccount(account);
    }
  });

  ReactDOM.render(
    <CacheProvider>
      <Router>
        <ThemeProvider theme={theme}>
          <App pca={msalInstance} />
        </ThemeProvider>
      </Router>
    </CacheProvider>,

    document.getElementById('root'),
  );
});

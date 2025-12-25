import React, { createContext, useState, useEffect, useContext } from 'react';
import Keycloak from 'keycloak-js';

const KeycloakContext = createContext();

export const useKeycloak = () => {
  const context = useContext(KeycloakContext);
  if (!context) {
    throw new Error('useKeycloak must be used within KeycloakProvider');
  }
  return context;
};

export const KeycloakProvider = ({ children }) => {
  const [keycloak, setKeycloak] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const keycloakConfig = {
      url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8081',
      realm: import.meta.env.VITE_KEYCLOAK_REALM || 'marketplace',
      clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'marketplace-web'
    };

    const keycloakInstance = new Keycloak(keycloakConfig);

    keycloakInstance
      .init({ 
        onLoad: 'login-required',
        pkceMethod: 'S256',
        checkLoginIframe: false
      })
      .then((authenticated) => {
        setKeycloak(keycloakInstance);
        setAuthenticated(authenticated);
        setLoading(false);

        // Refresh token periodically
        if (authenticated) {
          setInterval(() => {
            keycloakInstance.updateToken(70).catch(() => {
              console.error('Failed to refresh token');
            });
          }, 60000);
        }
      })
      .catch((error) => {
        console.error('Keycloak initialization failed:', error);
        setLoading(false);
      });
  }, []);

  const login = () => {
    keycloak?.login();
  };

  const logout = () => {
    keycloak?.logout();
  };

  const getToken = () => {
    return keycloak?.token;
  };

  const getUserInfo = () => {
    if (!keycloak || !authenticated) return null;
    return {
      id: keycloak.tokenParsed?.sub,
      username: keycloak.tokenParsed?.preferred_username,
      email: keycloak.tokenParsed?.email,
      name: keycloak.tokenParsed?.name
    };
  };

  const value = {
    keycloak,
    authenticated,
    loading,
    login,
    logout,
    getToken,
    getUserInfo
  };

  return (
    <KeycloakContext.Provider value={value}>
      {children}
    </KeycloakContext.Provider>
  );
};
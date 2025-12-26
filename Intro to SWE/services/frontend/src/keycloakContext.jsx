import React, { createContext, useContext, useState, useEffect } from 'react';
import Keycloak from 'keycloak-js';

const KeycloakContext = createContext();

export const KeycloakProvider = ({ children }) => {
  const [keycloak, setKeycloak] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const kc = new Keycloak({
      url: 'http://localhost:8081',
      realm: 'marketplace',
      clientId: 'marketplace-web'
    });

    kc.init({
      onLoad: 'check-sso',
      checkLoginIframe: false,
      pkceMethod: 'S256'
    }).then((authenticated) => {
      setKeycloak(kc);
      setAuthenticated(authenticated);
      setLoading(false);
      
      if (authenticated) {
        console.log('✅ Keycloak authenticated');
        console.log('👤 User:', kc.tokenParsed?.preferred_username);
        
        // Store token in localStorage for debugging
        localStorage.setItem('kc_token', kc.token);
        localStorage.setItem('kc_refresh_token', kc.refreshToken);
        
        // Auto-refresh token
        setInterval(() => {
          kc.updateToken(70).then((refreshed) => {
            if (refreshed) {
              console.log('🔄 Token refreshed');
              localStorage.setItem('kc_token', kc.token);
            }
          }).catch(() => {
            console.error('❌ Failed to refresh token');
          });
        }, 60000); // Check every minute
      } else {
        console.log('❌ Not authenticated');
        localStorage.removeItem('kc_token');
        localStorage.removeItem('kc_refresh_token');
      }
    }).catch((error) => {
      console.error('Keycloak init error:', error);
      setLoading(false);
    });
  }, []);

  const login = () => {
    if (keycloak) {
      keycloak.login();
    }
  };

  const logout = () => {
    if (keycloak) {
      localStorage.removeItem('kc_token');
      localStorage.removeItem('kc_refresh_token');
      keycloak.logout();
    }
  };

  const getToken = () => {
    return keycloak?.token || localStorage.getItem('kc_token') || '';
  };

  const getUserInfo = () => {
    if (!keycloak?.tokenParsed) return null;
    
    return {
      id: keycloak.tokenParsed.sub,
      email: keycloak.tokenParsed.email,
      username: keycloak.tokenParsed.preferred_username,
      realm_access: keycloak.tokenParsed.realm_access
    };
  };

  return (
    <KeycloakContext.Provider value={{
      keycloak,
      authenticated,
      loading,
      login,
      logout,
      getToken,
      getUserInfo
    }}>
      {children}
    </KeycloakContext.Provider>
  );
};

export const useKeycloak = () => {
  const context = useContext(KeycloakContext);
  if (!context) {
    throw new Error('useKeycloak must be used within KeycloakProvider');
  }
  return context;
};
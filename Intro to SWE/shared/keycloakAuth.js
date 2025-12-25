const axios = require('axios');

class KeycloakAuth {
  constructor(keycloakUrl, realm) {
    this.keycloakUrl = keycloakUrl;
    this.realm = realm;
    this.publicKey = null;
  }

  async init() {
    let retries = 10;
    while (retries > 0) {
      try {
        const response = await axios.get(
          `${this.keycloakUrl}/realms/${this.realm}`
        );
        this.publicKey = `-----BEGIN PUBLIC KEY-----\n${response.data.public_key}\n-----END PUBLIC KEY-----`;
        console.log('Keycloak authentication initialized');
        return;
      } catch (error) {
        retries--;
        if (retries === 0) {
          console.error('Failed to initialize Keycloak after 10 retries:', error.message);
          console.error('Authentication will not work until Keycloak is available');
        } else {
          console.log(`Keycloak not ready, retrying... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
  }

  middleware() {
    return async (req, res, next) => {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No authorization token provided' });
      }

      const token = authHeader.substring(7);

      try {
        // DEVELOPMENT MODE: Try multiple Keycloak URLs
        const userInfo = await this.verifyToken(token);
        req.user = userInfo;
        next();
      } catch (error) {
        console.error('Token verification failed:', error.message);
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
    };
  }

  optionalAuth() {
    return async (req, res, next) => {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const userInfo = await this.verifyToken(token);
          req.user = userInfo;
        } catch (error) {
          console.log('Optional auth failed, continuing without user');
        }
      }
      next();
    };
  }

  async verifyToken(token) {
    // DEVELOPMENT MODE: Try multiple Keycloak endpoints
    const keycloakUrls = [
      this.keycloakUrl,
      'http://localhost:8081',
      'http://172.19.0.1:8081',
      'http://keycloak:8080'
    ];

    for (const url of keycloakUrls) {
      try {
        console.log(`Trying to verify token with ${url}...`);
        const response = await axios.get(
          `${url}/realms/${this.realm}/protocol/openid-connect/userinfo`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            },
            timeout: 2000
          }
        );
        console.log(`✅ Token verified successfully with ${url}`);
        return response.data;
      } catch (error) {
        console.log(`❌ Token verification failed with ${url}: ${error.message}`);
        // Continue to next URL
      }
    }

    // If all URLs fail, throw error
    throw new Error('Token verification failed with all Keycloak URLs');
  }
}

module.exports = KeycloakAuth;
const axios = require('axios');

class KeycloakAuth {
  constructor(keycloakUrl, realm) {
    this.keycloakUrl = keycloakUrl;
    this.realm = realm;
    this.publicKey = null;
  }

  async init() {
    try {
      const response = await axios.get(
        `${this.keycloakUrl}/realms/${this.realm}`
      );
      this.publicKey = `-----BEGIN PUBLIC KEY-----\n${response.data.public_key}\n-----END PUBLIC KEY-----`;
      console.log('Keycloak authentication initialized');
    } catch (error) {
      console.error('Failed to initialize Keycloak:', error.message);
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
    try {
      const response = await axios.get(
        `${this.keycloakUrl}/realms/${this.realm}/protocol/openid-connect/userinfo`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      return response.data;
    } catch (error) {
      throw new Error('Token verification failed');
    }
  }
}

module.exports = KeycloakAuth;
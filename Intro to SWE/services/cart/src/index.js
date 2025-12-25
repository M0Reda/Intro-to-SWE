const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const KeycloakAuth = require('../shared/keycloakAuth');

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Initialize Keycloak
const keycloak = new KeycloakAuth(
  process.env.KEYCLOAK_URL || 'http://keycloak:8080',
  process.env.KEYCLOAK_REALM || 'marketplace'
);

// Enable CORS for frontend - allow both localhost and traefik domains
app.use(cors({ 
  origin: ['http://localhost:3001', 'http://app.localhost', 'http://cart.localhost'],
  credentials: true
}));
app.use(express.json());

// Track Keycloak initialization status
let keycloakReady = false;

// Initialize Keycloak on startup
keycloak.init()
  .then(() => {
    keycloakReady = true;
    console.log('Cart service: Keycloak ready');
  })
  .catch(err => {
    console.error('Cart service: Keycloak init error:', err);
  });

// Middleware to check if Keycloak is ready
const ensureKeycloakReady = (req, res, next) => {
  if (!keycloakReady) {
    return res.status(503).json({ error: 'Authentication service not ready' });
  }
  next();
};

// Health check (public)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'cart',
    keycloakReady 
  });
});

// Get user cart - PROTECTED
app.get('/cart', ensureKeycloakReady, keycloak.middleware(), async (req, res) => {
  try {
    const userId = req.user.sub || req.user.preferred_username;
    const result = await pool.query('SELECT * FROM cart WHERE user_id = $1', [userId]);
    
    if (result.rows.length === 0) {
      return res.json({ userId, items: [] });
    }
    
    res.json({ userId, items: result.rows[0].items });
  } catch (err) {
    console.error('Get cart error:', err);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

// Legacy endpoint for backwards compatibility - PROTECTED
app.get('/cart/:userId', ensureKeycloakReady, keycloak.middleware(), async (req, res) => {
  try {
    const userId = req.user.sub || req.user.preferred_username;
    const result = await pool.query('SELECT * FROM cart WHERE user_id = $1', [userId]);
    
    if (result.rows.length === 0) {
      return res.json({ userId, items: [] });
    }
    
    res.json({ userId, items: result.rows[0].items });
  } catch (err) {
    console.error('Get cart error:', err);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

// Add item to cart - PROTECTED
app.post('/cart', ensureKeycloakReady, keycloak.middleware(), async (req, res) => {
  try {
    const userId = req.user.sub || req.user.preferred_username;
    const { sku, qty, name, price } = req.body;
    
    // Get existing cart or create new
    const existing = await pool.query('SELECT * FROM cart WHERE user_id = $1', [userId]);
    
    let items = [];
    if (existing.rows.length > 0) {
      items = existing.rows[0].items;
    }
    
    // Check if item already in cart
    const itemIndex = items.findIndex(item => item.sku === sku);
    if (itemIndex >= 0) {
      items[itemIndex].qty += qty;
    } else {
      items.push({ sku, qty, name, price });
    }
    
    // Upsert cart
    const result = await pool.query(
      `INSERT INTO cart (user_id, items, updated_at) 
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) 
       DO UPDATE SET items = $2, updated_at = NOW()
       RETURNING *`,
      [userId, JSON.stringify(items)]
    );
    
    res.status(201).json({ userId, items: result.rows[0].items });
  } catch (err) {
    console.error('Add to cart error:', err);
    res.status(500).json({ error: 'Failed to add item to cart' });
  }
});

// Legacy endpoint - PROTECTED
app.post('/cart/:userId', ensureKeycloakReady, keycloak.middleware(), async (req, res) => {
  try {
    const userId = req.user.sub || req.user.preferred_username;
    const { sku, qty, name, price } = req.body;
    
    const existing = await pool.query('SELECT * FROM cart WHERE user_id = $1', [userId]);
    
    let items = [];
    if (existing.rows.length > 0) {
      items = existing.rows[0].items;
    }
    
    const itemIndex = items.findIndex(item => item.sku === sku);
    if (itemIndex >= 0) {
      items[itemIndex].qty += qty;
    } else {
      items.push({ sku, qty, name, price });
    }
    
    const result = await pool.query(
      `INSERT INTO cart (user_id, items, updated_at) 
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) 
       DO UPDATE SET items = $2, updated_at = NOW()
       RETURNING *`,
      [userId, JSON.stringify(items)]
    );
    
    res.status(201).json({ userId, items: result.rows[0].items });
  } catch (err) {
    console.error('Add to cart error:', err);
    res.status(500).json({ error: 'Failed to add item to cart' });
  }
});

// Update item quantity in cart - PROTECTED
app.put('/cart/:sku', ensureKeycloakReady, keycloak.middleware(), async (req, res) => {
  try {
    const userId = req.user.sub || req.user.preferred_username;
    const { sku } = req.params;
    const { qty } = req.body;
    
    const result = await pool.query('SELECT * FROM cart WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cart not found' });
    }
    
    let items = result.rows[0].items;
    const itemIndex = items.findIndex(item => item.sku === sku);
    
    if (itemIndex < 0) {
      return res.status(404).json({ error: 'Item not found in cart' });
    }
    
    if (qty <= 0) {
      items.splice(itemIndex, 1);
    } else {
      items[itemIndex].qty = qty;
    }
    
    await pool.query(
      'UPDATE cart SET items = $1, updated_at = NOW() WHERE user_id = $2',
      [JSON.stringify(items), userId]
    );
    
    res.json({ userId, items });
  } catch (err) {
    console.error('Update cart error:', err);
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

// Legacy endpoint - PROTECTED
app.put('/cart/:userId/:sku', ensureKeycloakReady, keycloak.middleware(), async (req, res) => {
  try {
    const userId = req.user.sub || req.user.preferred_username;
    const { sku } = req.params;
    const { qty } = req.body;
    
    const result = await pool.query('SELECT * FROM cart WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cart not found' });
    }
    
    let items = result.rows[0].items;
    const itemIndex = items.findIndex(item => item.sku === sku);
    
    if (itemIndex < 0) {
      return res.status(404).json({ error: 'Item not found in cart' });
    }
    
    if (qty <= 0) {
      items.splice(itemIndex, 1);
    } else {
      items[itemIndex].qty = qty;
    }
    
    await pool.query(
      'UPDATE cart SET items = $1, updated_at = NOW() WHERE user_id = $2',
      [JSON.stringify(items), userId]
    );
    
    res.json({ userId, items });
  } catch (err) {
    console.error('Update cart error:', err);
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

// Remove item from cart - PROTECTED
app.delete('/cart/:sku', ensureKeycloakReady, keycloak.middleware(), async (req, res) => {
  try {
    const userId = req.user.sub || req.user.preferred_username;
    const { sku } = req.params;
    
    const result = await pool.query('SELECT * FROM cart WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cart not found' });
    }
    
    let items = result.rows[0].items;
    items = items.filter(item => item.sku !== sku);
    
    await pool.query(
      'UPDATE cart SET items = $1, updated_at = NOW() WHERE user_id = $2',
      [JSON.stringify(items), userId]
    );
    
    res.json({ userId, items });
  } catch (err) {
    console.error('Remove from cart error:', err);
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

// Legacy endpoint - PROTECTED
app.delete('/cart/:userId/:sku', ensureKeycloakReady, keycloak.middleware(), async (req, res) => {
  try {
    const userId = req.user.sub || req.user.preferred_username;
    const { sku } = req.params;
    
    const result = await pool.query('SELECT * FROM cart WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cart not found' });
    }
    
    let items = result.rows[0].items;
    items = items.filter(item => item.sku !== sku);
    
    await pool.query(
      'UPDATE cart SET items = $1, updated_at = NOW() WHERE user_id = $2',
      [JSON.stringify(items), userId]
    );
    
    res.json({ userId, items });
  } catch (err) {
    console.error('Remove from cart error:', err);
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

// Clear cart - PROTECTED
app.delete('/cart', ensureKeycloakReady, keycloak.middleware(), async (req, res) => {
  try {
    const userId = req.user.sub || req.user.preferred_username;
    await pool.query('DELETE FROM cart WHERE user_id = $1', [userId]);
    res.json({ userId, items: [] });
  } catch (err) {
    console.error('Clear cart error:', err);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

// Legacy endpoint - PROTECTED
app.delete('/cart/:userId', ensureKeycloakReady, keycloak.middleware(), async (req, res) => {
  try {
    const userId = req.user.sub || req.user.preferred_username;
    await pool.query('DELETE FROM cart WHERE user_id = $1', [userId]);
    res.json({ userId, items: [] });
  } catch (err) {
    console.error('Clear cart error:', err);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

const PORT = 3005;
app.listen(PORT, () => console.log(`Cart service running on port ${PORT}`));
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const axios = require('axios');

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Simple JWT decoder (no verification - for development)
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = Buffer.from(parts[1], 'base64').toString('utf8');
    return JSON.parse(payload);
  } catch (err) {
    console.error('JWT decode error:', err.message);
    return null;
  }
}

// Authentication middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  const decoded = decodeJWT(token);
  
  if (!decoded || !decoded.sub) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  // Attach user info to request
  req.user = {
    id: decoded.sub,
    email: decoded.email,
    username: decoded.preferred_username || decoded.email
  };
  
  console.log(`✅ Authenticated user: ${req.user.username} (${req.user.id})`);
  next();
}

// CORS configuration
app.use(cors({ 
  origin: ['http://localhost:3001', 'http://app.localhost', 'http://cart.localhost'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());
app.use(express.json());

console.log('✅ CART SERVICE: JWT Authentication ENABLED (decode mode)');

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'cart', mode: 'jwt-decode' });
});

// Helper function to check inventory
async function checkInventoryStock(sku) {
  try {
    const response = await axios.get(`http://inventory:3004/inventory/${sku}`);
    return response.data;
  } catch (error) {
    console.error('Failed to check inventory:', error.message);
    return null;
  }
}

// Get cart - REQUIRES AUTH
app.get('/cart', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
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

// Add to cart - REQUIRES AUTH + STOCK VALIDATION
app.post('/cart', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sku, qty, name, price } = req.body;
    
    // Check inventory stock
    const inventoryItem = await checkInventoryStock(sku);
    if (!inventoryItem) {
      return res.status(404).json({ error: 'Item not found in inventory' });
    }
    
    // Get existing cart
    const existing = await pool.query('SELECT * FROM cart WHERE user_id = $1', [userId]);
    let items = [];
    if (existing.rows.length > 0) {
      items = existing.rows[0].items;
    }
    
    // Calculate current quantity in cart for this item
    const itemIndex = items.findIndex(item => item.sku === sku);
    const currentQtyInCart = itemIndex >= 0 ? items[itemIndex].qty : 0;
    const newTotalQty = currentQtyInCart + qty;
    
    // Validate against available stock
    if (newTotalQty > inventoryItem.quantity) {
      return res.status(400).json({ 
        error: 'Not enough stock available',
        available: inventoryItem.quantity,
        inCart: currentQtyInCart,
        requested: qty
      });
    }
    
    // Update cart
    if (itemIndex >= 0) {
      items[itemIndex].qty = newTotalQty;
    } else {
      items.push({ sku, qty, name, price: parseFloat(price) });
    }
    
    const result = await pool.query(
      `INSERT INTO cart (user_id, items, updated_at) 
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) 
       DO UPDATE SET items = $2, updated_at = NOW()
       RETURNING *`,
      [userId, JSON.stringify(items)]
    );
    
    console.log(`✅ User ${req.user.username} added ${sku} to cart`);
    res.status(201).json({ userId, items: result.rows[0].items });
  } catch (err) {
    console.error('Add to cart error:', err);
    res.status(500).json({ error: 'Failed to add item to cart' });
  }
});

// Update quantity - REQUIRES AUTH + STOCK VALIDATION
app.put('/cart/:sku', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
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
    
    // If increasing quantity, check stock
    if (qty > items[itemIndex].qty) {
      const inventoryItem = await checkInventoryStock(sku);
      if (!inventoryItem) {
        return res.status(404).json({ error: 'Item not found in inventory' });
      }
      
      if (qty > inventoryItem.quantity) {
        return res.status(400).json({ 
          error: 'Not enough stock available',
          available: inventoryItem.quantity,
          requested: qty
        });
      }
    }
    
    // Update or remove item
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

// Remove item - REQUIRES AUTH
app.delete('/cart/:sku', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
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

// Clear cart - REQUIRES AUTH
app.delete('/cart', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    await pool.query('DELETE FROM cart WHERE user_id = $1', [userId]);
    res.json({ userId, items: [] });
  } catch (err) {
    console.error('Clear cart error:', err);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

const PORT = 3005;
app.listen(PORT, () => console.log(`🛒 Cart service running on port ${PORT} (JWT DECODE AUTH)`));
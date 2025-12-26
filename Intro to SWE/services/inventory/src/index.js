const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const app = express();

// CORS configuration - MUST be before other middleware
app.use(cors({ 
  origin: ['http://localhost:3001', 'http://app.localhost', 'http://inventory.localhost'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json());

// Simple JWT decoder
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64').toString('utf8');
    return JSON.parse(payload);
  } catch (err) {
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
  
  req.user = {
    id: decoded.sub,
    email: decoded.email,
    username: decoded.preferred_username || decoded.email || '',
    roles: decoded.realm_access?.roles || []
  };
  
  next();
}

// SIMPLIFIED Admin authorization - checks username instead of role
function requireAdmin(req, res, next) {
  const username = req.user.username.toLowerCase();
  
  if (username !== 'admin') {
    console.log(`❌ Access denied for user: ${req.user.username}`);
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  console.log(`✅ Admin access granted for: ${req.user.username}`);
  next();
}

console.log('📦 Inventory service starting with admin endpoints...');
console.log('🔐 Admin check: username === "admin" (simplified)');

// Public endpoints (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'inventory', mode: 'admin-enabled' });
});

// Search inventory (public)
app.get('/inventory/search', async (req, res) => {
  const { q } = req.query;
  try {
    let result;
    if (q) {
      result = await pool.query(
        'SELECT * FROM inventory WHERE name ILIKE $1 OR sku ILIKE $1 ORDER BY name',
        [`%${q}%`]
      );
    } else {
      result = await pool.query('SELECT * FROM inventory ORDER BY name');
    }
    res.json(result.rows);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Failed to search inventory' });
  }
});

// Get single item (public)
app.get('/inventory/:sku', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory WHERE sku = $1', [req.params.sku]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get item error:', err);
    res.status(500).json({ error: 'Failed to get item' });
  }
});

// ADMIN ENDPOINTS

// Add new product (admin only)
app.post('/inventory', authenticate, requireAdmin, async (req, res) => {
  const { sku, name, price, quantity } = req.body;
  
  if (!sku || !name || price === undefined || quantity === undefined) {
    return res.status(400).json({ error: 'Missing required fields: sku, name, price, quantity' });
  }
  
  try {
    // Check if SKU already exists
    const existing = await pool.query('SELECT * FROM inventory WHERE sku = $1', [sku]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Product with this SKU already exists' });
    }
    
    const result = await pool.query(
      'INSERT INTO inventory (sku, name, price, quantity) VALUES ($1, $2, $3, $4) RETURNING *',
      [sku, name, parseFloat(price), parseInt(quantity)]
    );
    
    console.log(`✅ Admin ${req.user.username} added product: ${sku}`);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add product error:', err);
    res.status(500).json({ error: 'Failed to add product' });
  }
});

// Update product (admin only)
app.put('/inventory/:sku', authenticate, requireAdmin, async (req, res) => {
  const { sku } = req.params;
  const { name, price, quantity } = req.body;
  
  try {
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (price !== undefined) {
      updates.push(`price = $${paramCount++}`);
      values.push(parseFloat(price));
    }
    if (quantity !== undefined) {
      updates.push(`quantity = $${paramCount++}`);
      values.push(parseInt(quantity));
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(sku);
    const query = `UPDATE inventory SET ${updates.join(', ')} WHERE sku = $${paramCount} RETURNING *`;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    console.log(`✅ Admin ${req.user.username} updated product: ${sku}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Add stock to existing product (admin only)
app.post('/inventory/:sku/add-stock', authenticate, requireAdmin, async (req, res) => {
  const { sku } = req.params;
  const { quantity } = req.body;
  
  if (!quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Quantity must be positive' });
  }
  
  try {
    const result = await pool.query(
      'UPDATE inventory SET quantity = quantity + $1 WHERE sku = $2 RETURNING *',
      [parseInt(quantity), sku]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    console.log(`✅ Admin ${req.user.username} added ${quantity} units to ${sku}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Add stock error:', err);
    res.status(500).json({ error: 'Failed to add stock' });
  }
});

// Remove stock from existing product (admin only)
app.post('/inventory/:sku/remove-stock', authenticate, requireAdmin, async (req, res) => {
  const { sku } = req.params;
  const { quantity } = req.body;
  
  if (!quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Quantity must be positive' });
  }
  
  try {
    // Check current quantity
    const current = await pool.query('SELECT quantity FROM inventory WHERE sku = $1', [sku]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const currentQty = current.rows[0].quantity;
    if (currentQty < quantity) {
      return res.status(400).json({ 
        error: 'Cannot remove more than available quantity',
        available: currentQty,
        requested: quantity
      });
    }
    
    const result = await pool.query(
      'UPDATE inventory SET quantity = quantity - $1 WHERE sku = $2 RETURNING *',
      [parseInt(quantity), sku]
    );
    
    console.log(`✅ Admin ${req.user.username} removed ${quantity} units from ${sku}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Remove stock error:', err);
    res.status(500).json({ error: 'Failed to remove stock' });
  }
});

// Delete product completely (admin only)
app.delete('/inventory/:sku', authenticate, requireAdmin, async (req, res) => {
  const { sku } = req.params;
  
  try {
    const result = await pool.query('DELETE FROM inventory WHERE sku = $1 RETURNING *', [sku]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    console.log(`✅ Admin ${req.user.username} deleted product: ${sku}`);
    res.json({ message: 'Product deleted successfully', product: result.rows[0] });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

const PORT = 3004;
app.listen(PORT, () => {
  console.log(`📦 Inventory service running on port ${PORT}`);
  console.log('✅ Admin endpoints enabled (username check)');
  console.log('🔑 Admin access: username === "admin"');
});
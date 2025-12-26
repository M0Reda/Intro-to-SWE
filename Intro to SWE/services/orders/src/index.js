const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const { publishOrderCreated } = require('./publishOrderEvent');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const app = express();

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

// Admin authorization - checks username
function requireAdmin(req, res, next) {
  const username = req.user.username.toLowerCase();
  
  if (username !== 'admin') {
    console.log(`❌ Access denied for user: ${req.user.username}`);
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  console.log(`✅ Admin access granted for: ${req.user.username}`);
  next();
}

// CORS configuration
app.use(cors({ 
  origin: ['http://localhost:3001', 'http://app.localhost', 'http://api.localhost'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());
app.use(bodyParser.json());

console.log('✅ ORDERS SERVICE: JWT Authentication ENABLED (decode mode)');
console.log('✅ Admin endpoints enabled');

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'orders', mode: 'jwt-decode' });
});

// GET all orders for current user - REQUIRES AUTH
app.get('/orders', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET ALL orders (admin only) - REQUIRES ADMIN
app.get('/orders/all', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM orders ORDER BY created_at DESC'
    );
    console.log(`✅ Admin ${req.user.username} retrieved ${result.rows.length} orders`);
    res.json(result.rows);
  } catch (err) {
    console.error('Get all orders error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET single order - REQUIRES AUTH
app.get('/orders/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const username = req.user.username.toLowerCase();
    
    // Admin can view any order, regular users can only view their own
    let result;
    if (username === 'admin') {
      result = await pool.query(
        'SELECT * FROM orders WHERE id = $1', 
        [req.params.id]
      );
    } else {
      result = await pool.query(
        'SELECT * FROM orders WHERE id = $1 AND user_id = $2', 
        [req.params.id, userId]
      );
    }
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /orders - REQUIRES AUTH - Creates order in PENDING state
app.post('/orders', authenticate, async (req, res) => {
  const { items, total } = req.body;
  const userId = req.user.id;
  const userEmail = req.user.email;
  const username = req.user.username;

  console.log(`Creating order for ${username}:`, { items, total });

  if (!items || items.length === 0 || !total) {
    return res.status(400).json({ error: 'Missing items or total' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      'INSERT INTO orders (user_id, items, total, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, JSON.stringify(items), total, 'pending']
    );

    const order = result.rows[0];

    // Publish event to RabbitMQ
    await publishOrderCreated({
      id: order.id,
      userId: order.user_id,
      items: order.items,
      total: order.total,
      userEmail: userEmail
    });

    await client.query('COMMIT');

    console.log(`✅ Order ${order.id} created for user ${username} (status: pending)`);
    res.status(201).json(order);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /orders/:id/complete - Mark order as completed and deduct inventory
app.post('/orders/:id/complete', authenticate, async (req, res) => {
  const { paymentId, paymentStatus } = req.body;
  const userId = req.user.id;
  const orderId = req.params.id;
  const username = req.user.username.toLowerCase();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get the order - admin can complete any order
    let orderResult;
    if (username === 'admin') {
      orderResult = await client.query(
        'SELECT * FROM orders WHERE id = $1',
        [orderId]
      );
    } else {
      orderResult = await client.query(
        'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
        [orderId, userId]
      );
    }

    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    // Check if already completed
    if (order.status === 'completed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Order already completed' });
    }

    // Deduct inventory for each item
    for (const item of order.items) {
      const inventoryResult = await client.query(
        'UPDATE inventory SET quantity = quantity - $1 WHERE sku = $2 AND quantity >= $3 RETURNING *',
        [item.qty, item.sku, item.qty]
      );

      if (inventoryResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: `Insufficient stock for ${item.sku}. Order cannot be completed.`,
          sku: item.sku
        });
      }

      console.log(`✅ Deducted ${item.qty} units of ${item.sku} from inventory`);
    }

    // Update order status
    const updateResult = await client.query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
      ['completed', orderId]
    );

    await client.query('COMMIT');

    console.log(`✅ Order ${orderId} completed with payment ${paymentId}`);
    res.json({
      order: updateResult.rows[0],
      message: 'Order completed and inventory updated'
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Complete order error:', err);
    res.status(500).json({ error: 'Failed to complete order' });
  } finally {
    client.release();
  }
});

// POST /orders/:id/cancel - Cancel an order
app.post('/orders/:id/cancel', authenticate, async (req, res) => {
  const userId = req.user.id;
  const orderId = req.params.id;
  const username = req.user.username.toLowerCase();

  try {
    let result;
    if (username === 'admin') {
      // Admin can cancel any order
      result = await pool.query(
        'UPDATE orders SET status = $1 WHERE id = $2 AND status = $3 RETURNING *',
        ['cancelled', orderId, 'pending']
      );
    } else {
      // Regular users can only cancel their own orders
      result = await pool.query(
        'UPDATE orders SET status = $1 WHERE id = $2 AND user_id = $3 AND status = $4 RETURNING *',
        ['cancelled', orderId, userId, 'pending']
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found or cannot be cancelled' });
    }

    console.log(`✅ Order ${orderId} cancelled`);
    res.json({
      order: result.rows[0],
      message: 'Order cancelled'
    });

  } catch (err) {
    console.error('Cancel order error:', err);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`📦 Orders service running on port ${PORT} (JWT DECODE AUTH + ADMIN)`));
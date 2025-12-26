const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const { publishOrderCreated, publishOrderCompleted } = require('./publishOrderEvent');

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
  
  req.user = {
    id: decoded.sub,
    email: decoded.email,
    username: decoded.preferred_username || decoded.email
  };
  
  console.log(`✅ Authenticated user: ${req.user.username} (${req.user.id})`);
  next();
}

// Admin authorization
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

console.log('✅ ORDERS SERVICE: Event-driven with RabbitMQ');
console.log('✅ Inventory updates handled by inventory service via events');

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'orders', mode: 'event-driven' });
});

// GET all orders for current user
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

// GET ALL orders (admin only)
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

// GET single order
app.get('/orders/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const username = req.user.username.toLowerCase();
    
    let result;
    if (username === 'admin') {
      result = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
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

// POST /orders - Creates order in PENDING state
app.post('/orders', authenticate, async (req, res) => {
  const { items, total } = req.body;
  const userId = req.user.id;
  const userEmail = req.user.email;
  const username = req.user.username;

  console.log(`Creating order for ${username}:`, { items, total });

  if (!items || items.length === 0 || !total) {
    return res.status(400).json({ error: 'Missing items or total' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO orders (user_id, items, total, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, JSON.stringify(items), total, 'pending']
    );

    const order = result.rows[0];

    // Publish event - inventory service will handle stock validation
    await publishOrderCreated({
      id: order.id,
      userId: order.user_id,
      items: order.items,
      total: order.total,
      userEmail: userEmail
    });

    console.log(`✅ Order ${order.id} created for ${username} - event published to RabbitMQ`);
    res.status(201).json(order);
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /orders/:id/confirm-cod - Confirm COD order
app.post('/orders/:id/confirm-cod', authenticate, async (req, res) => {
  const userId = req.user.id;
  const orderId = req.params.id;
  const username = req.user.username.toLowerCase();

  try {
    // Get the order
    let orderResult;
    if (username === 'admin') {
      orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    } else {
      orderResult = await pool.query(
        'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
        [orderId, userId]
      );
    }

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    if (order.status === 'completed') {
      return res.status(400).json({ error: 'Order already completed' });
    }

    // Publish order.completed event - inventory service will deduct stock
    await publishOrderCompleted({
      id: order.id,
      userId: order.user_id,
      items: order.items,
      paymentMethod: 'COD'
    });

    console.log(`✅ COD Order ${orderId} confirmed - event published to RabbitMQ`);
    res.json({
      order: order,
      message: 'COD order confirmed. Inventory will be reserved shortly.'
    });

  } catch (err) {
    console.error('Confirm COD order error:', err);
    res.status(500).json({ error: 'Failed to confirm COD order' });
  }
});

// POST /orders/:id/complete - Mark order as completed (for paid orders)
app.post('/orders/:id/complete', authenticate, async (req, res) => {
  const { paymentId, paymentStatus } = req.body;
  const userId = req.user.id;
  const orderId = req.params.id;
  const username = req.user.username.toLowerCase();

  try {
    // Get the order
    let orderResult;
    if (username === 'admin') {
      orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    } else {
      orderResult = await pool.query(
        'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
        [orderId, userId]
      );
    }

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    if (order.status === 'completed') {
      return res.status(400).json({ error: 'Order already completed' });
    }

    // Update order status to completed
    await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2',
      ['completed', orderId]
    );

    // Publish order.completed event - inventory service will deduct stock
    await publishOrderCompleted({
      id: order.id,
      userId: order.user_id,
      items: order.items,
      paymentId: paymentId,
      paymentStatus: paymentStatus
    });

    console.log(`✅ Order ${orderId} completed with payment ${paymentId} - event published`);
    res.json({
      order: { ...order, status: 'completed' },
      message: 'Order completed. Inventory will be updated shortly.'
    });

  } catch (err) {
    console.error('Complete order error:', err);
    res.status(500).json({ error: 'Failed to complete order' });
  }
});

// POST /orders/:id/cancel - Cancel order and restore inventory
app.post('/orders/:id/cancel', authenticate, async (req, res) => {
  const userId = req.user.id;
  const orderId = req.params.id;
  const username = req.user.username.toLowerCase();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get the order
    let orderResult;
    if (username === 'admin') {
      orderResult = await client.query(
        'SELECT * FROM orders WHERE id = $1 AND status != $2',
        [orderId, 'cancelled']
      );
    } else {
      orderResult = await client.query(
        'SELECT * FROM orders WHERE id = $1 AND user_id = $2 AND status != $3',
        [orderId, userId, 'cancelled']
      );
    }

    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found or already cancelled' });
    }

    const order = orderResult.rows[0];

    // Update order status to cancelled
    const updateResult = await client.query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
      ['cancelled', orderId]
    );

    await client.query('COMMIT');

    // Publish order.cancelled event if order was completed
    if (order.status === 'completed' || order.status === 'pending') {
      const { publishOrderCancelled } = require('./publishOrderEvent');
      await publishOrderCancelled({
        id: order.id,
        items: order.items,
        previousStatus: order.status
      });
      console.log(`✅ Order ${orderId} cancelled - restoration event published`);
    }

    res.json({
      order: updateResult.rows[0],
      message: 'Order cancelled. Inventory will be restored if applicable.'
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Cancel order error:', err);
    res.status(500).json({ error: 'Failed to cancel order' });
  } finally {
    client.release();
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`📦 Orders service running on port ${PORT} (EVENT-DRIVEN)`));
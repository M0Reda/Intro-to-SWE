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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'orders', mode: 'jwt-decode' });
});

// GET all orders - REQUIRES AUTH
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

// GET single order - REQUIRES AUTH
app.get('/orders/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2', 
      [req.params.id, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /orders - REQUIRES AUTH
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

    console.log(`✅ Order ${order.id} created for user ${username}`);
    res.status(201).json(order);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`📦 Orders service running on port ${PORT} (JWT DECODE AUTH)`));
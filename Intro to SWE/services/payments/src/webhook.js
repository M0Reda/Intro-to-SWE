const express = require('express');
const cors = require('cors');
const paypal = require('@paypal/checkout-server-sdk');

const app = express();

// CORS configuration
app.use(cors({ 
  origin: ['http://localhost:3001', 'http://app.localhost', 'http://payments.localhost'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());
app.use(express.json());

// PayPal configuration
const clientId = process.env.PAYPAL_CLIENT_ID || 'your-client-id';
const clientSecret = process.env.PAYPAL_CLIENT_SECRET || 'your-client-secret';
const mode = process.env.PAYPAL_MODE || 'sandbox';

let paypalClient = null;
let paypalConfigured = false;

// Initialize PayPal client
if (clientId !== 'your-client-id' && clientSecret !== 'your-client-secret') {
  try {
    const environment = mode === 'live' 
      ? new paypal.core.LiveEnvironment(clientId, clientSecret)
      : new paypal.core.SandboxEnvironment(clientId, clientSecret);
    
    paypalClient = new paypal.core.PayPalHttpClient(environment);
    paypalConfigured = true;
    
    console.log('✅ PayPal configured in', mode, 'mode');
    console.log('🔑 Client ID:', clientId.substring(0, 20) + '...');
  } catch (err) {
    console.error('❌ PayPal initialization error:', err.message);
  }
} else {
  console.log('⚠️ PayPal not configured - using simulation mode');
  console.log('💡 Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to enable PayPal');
}

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

// Authentication middleware (optional for payments)
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = decodeJWT(token);
    if (decoded && decoded.sub) {
      req.user = {
        id: decoded.sub,
        email: decoded.email,
        username: decoded.preferred_username || decoded.email || ''
      };
    }
  }
  next(); // Continue even if not authenticated
}

console.log('💳 Payments service starting...');

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'payments',
    paypalConfigured,
    mode: mode
  });
});

// Get PayPal configuration (for frontend)
app.get('/payments/config', (req, res) => {
  res.json({
    clientId: paypalConfigured ? clientId : null,
    configured: paypalConfigured,
    mode: mode
  });
});

// Create PayPal order
app.post('/payments/create', authenticate, async (req, res) => {
  const { orderId, amount } = req.body;

  if (!orderId || !amount) {
    return res.status(400).json({ error: 'Missing orderId or amount' });
  }

  // If PayPal not configured, return mock data
  if (!paypalConfigured) {
    return res.json({
      id: `MOCK-${Date.now()}`,
      status: 'CREATED',
      links: [
        {
          href: '#',
          rel: 'approve',
          method: 'GET'
        }
      ]
    });
  }

  try {
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: orderId.toString(),
        amount: {
          currency_code: 'USD',
          value: parseFloat(amount).toFixed(2)
        },
        description: `Marketplace Order #${orderId}`
      }],
      application_context: {
        brand_name: 'Marketplace',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: 'http://localhost:3001',
        cancel_url: 'http://localhost:3001'
      }
    });

    const order = await paypalClient.execute(request);
    
    console.log(`✅ PayPal order created: ${order.result.id} for marketplace order #${orderId}`);
    
    res.json(order.result);
  } catch (err) {
    console.error('PayPal create order error:', err);
    res.status(500).json({ 
      error: 'Failed to create PayPal order',
      details: err.message 
    });
  }
});

// Capture PayPal payment
app.post('/payments/:paypalOrderId/capture', authenticate, async (req, res) => {
  const { paypalOrderId } = req.params;

  // If PayPal not configured, return mock data
  if (!paypalConfigured) {
    return res.json({
      id: paypalOrderId,
      status: 'COMPLETED',
      payer: {
        email_address: 'test@example.com',
        name: { given_name: 'Test', surname: 'User' }
      },
      purchase_units: [{
        payments: {
          captures: [{
            id: `CAPTURE-${Date.now()}`,
            status: 'COMPLETED',
            amount: { currency_code: 'USD', value: '0.00' }
          }]
        }
      }]
    });
  }

  try {
    const request = new paypal.orders.OrdersCaptureRequest(paypalOrderId);
    request.requestBody({});

    const capture = await paypalClient.execute(request);
    
    console.log(`✅ Payment captured: ${paypalOrderId}`);
    console.log('   Payer:', capture.result.payer?.email_address);
    console.log('   Status:', capture.result.status);
    
    res.json(capture.result);
  } catch (err) {
    console.error('PayPal capture error:', err);
    res.status(500).json({ 
      error: 'Failed to capture payment',
      details: err.message 
    });
  }
});

// Get payment details
app.get('/payments/:paypalOrderId', authenticate, async (req, res) => {
  const { paypalOrderId } = req.params;

  if (!paypalConfigured) {
    return res.json({
      id: paypalOrderId,
      status: 'UNKNOWN',
      message: 'PayPal not configured'
    });
  }

  try {
    const request = new paypal.orders.OrdersGetRequest(paypalOrderId);
    const order = await paypalClient.execute(request);
    
    res.json(order.result);
  } catch (err) {
    console.error('PayPal get order error:', err);
    res.status(500).json({ 
      error: 'Failed to get payment details',
      details: err.message 
    });
  }
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`💳 Payments service running on port ${PORT}`);
  if (paypalConfigured) {
    console.log(`✅ PayPal ${mode} mode ready`);
  } else {
    console.log('⚠️ PayPal not configured - using simulation');
    console.log('💡 Configure PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to enable');
  }
});
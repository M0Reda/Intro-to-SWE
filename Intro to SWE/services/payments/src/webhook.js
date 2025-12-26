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
  next();
}

// Helper function to create PayPal client with custom credentials
function createPayPalClient(clientId, clientSecret, mode = 'sandbox') {
  const environment = mode === 'live' 
    ? new paypal.core.LiveEnvironment(clientId, clientSecret)
    : new paypal.core.SandboxEnvironment(clientId, clientSecret);
  
  return new paypal.core.PayPalHttpClient(environment);
}

console.log('💳 Payments service starting with per-user credentials support...');

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'payments',
    supportsUserCredentials: true
  });
});

// Get PayPal configuration (for frontend)
app.get('/payments/config', (req, res) => {
  res.json({
    supportsUserCredentials: true,
    requiresCredentials: true,
    message: 'Enter your PayPal Sandbox credentials when paying'
  });
});

// Create PayPal order with user-provided credentials
app.post('/payments/create-with-credentials', authenticate, async (req, res) => {
  const { amount, clientId, clientSecret, mode = 'sandbox' } = req.body;

  if (!amount || !clientId || !clientSecret) {
    return res.status(400).json({ 
      error: 'Missing required fields: amount, clientId, clientSecret' 
    });
  }

  try {
    // Validate credentials by creating a client
    const paypalClient = createPayPalClient(clientId, clientSecret, mode);
    
    // Create the order
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: parseFloat(amount).toFixed(2)
        },
        description: `Marketplace Purchase - $${amount}`
      }],
      application_context: {
        brand_name: 'Marketplace',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: 'http://localhost:3001/payment-success',
        cancel_url: 'http://localhost:3001/payment-cancel'
      }
    });

    const order = await paypalClient.execute(request);
    
    console.log(`✅ PayPal order created: ${order.result.id} for amount $${amount}`);
    console.log(`   Using user-provided credentials`);
    
    res.json(order.result);
  } catch (err) {
    console.error('PayPal create order error:', err);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to create PayPal order';
    if (err.statusCode === 401) {
      errorMessage = 'Invalid PayPal credentials. Please check your Client ID and Secret.';
    } else if (err.message) {
      errorMessage = err.message;
    }
    
    res.status(err.statusCode || 500).json({ 
      error: errorMessage,
      details: err.message 
    });
  }
});

// Check order status with user credentials
app.post('/payments/:paypalOrderId/status', authenticate, async (req, res) => {
  const { paypalOrderId } = req.params;
  const { clientId, clientSecret, mode = 'sandbox' } = req.body;

  if (!clientId || !clientSecret) {
    return res.status(400).json({ 
      error: 'Missing credentials' 
    });
  }

  try {
    const paypalClient = createPayPalClient(clientId, clientSecret, mode);
    const request = new paypal.orders.OrdersGetRequest(paypalOrderId);
    const order = await paypalClient.execute(request);
    
    res.json({
      id: order.result.id,
      status: order.result.status
    });
  } catch (err) {
    console.error('PayPal get order error:', err);
    res.status(err.statusCode || 500).json({ 
      error: 'Failed to get order status',
      details: err.message 
    });
  }
});

// Capture PayPal payment with user credentials
app.post('/payments/:paypalOrderId/capture', authenticate, async (req, res) => {
  const { paypalOrderId } = req.params;
  const { clientId, clientSecret, mode = 'sandbox' } = req.body;

  if (!clientId || !clientSecret) {
    return res.status(400).json({ 
      error: 'Missing credentials' 
    });
  }

  try {
    const paypalClient = createPayPalClient(clientId, clientSecret, mode);
    const request = new paypal.orders.OrdersCaptureRequest(paypalOrderId);
    request.requestBody({});

    const capture = await paypalClient.execute(request);
    
    console.log(`✅ Payment captured: ${paypalOrderId}`);
    console.log('   Payer:', capture.result.payer?.email_address);
    console.log('   Status:', capture.result.status);
    
    res.json(capture.result);
  } catch (err) {
    console.error('PayPal capture error:', err);
    res.status(err.statusCode || 500).json({ 
      error: 'Failed to capture payment',
      details: err.message 
    });
  }
});

// Legacy endpoints for backward compatibility (simulate mode)
app.post('/payments/create', authenticate, async (req, res) => {
  const { amount } = req.body;

  if (!amount) {
    return res.status(400).json({ error: 'Missing amount' });
  }

  // Return mock data for simulation
  res.json({
    id: `MOCK-${Date.now()}`,
    status: 'CREATED',
    requiresCredentials: true,
    message: 'Use /payments/create-with-credentials endpoint with your PayPal credentials'
  });
});

app.post('/payments/:paypalOrderId/capture', authenticate, async (req, res) => {
  const { paypalOrderId } = req.params;

  // Return mock data
  res.json({
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
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`💳 Payments service running on port ${PORT}`);
  console.log('✅ Per-user PayPal Sandbox credentials enabled');
  console.log('💡 Users will enter their own PayPal credentials when paying');
});
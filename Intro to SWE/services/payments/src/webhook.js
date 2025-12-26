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

console.log('💳 Payments service starting with enhanced error handling...');

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'payments',
    supportsUserCredentials: true,
    version: '1.2-enhanced'
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

  console.log('📝 Create order request received:', {
    amount,
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    mode
  });

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
    console.log(`   Status: ${order.result.status}`);
    
    res.json(order.result);
  } catch (err) {
    console.error('❌ PayPal create order error:', {
      message: err.message,
      statusCode: err.statusCode,
      details: err.details
    });
    
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

  console.log(`📊 Status check for order: ${paypalOrderId}`);

  if (!clientId || !clientSecret) {
    return res.status(400).json({ 
      error: 'Missing credentials' 
    });
  }

  try {
    const paypalClient = createPayPalClient(clientId, clientSecret, mode);
    const request = new paypal.orders.OrdersGetRequest(paypalOrderId);
    const order = await paypalClient.execute(request);
    
    console.log(`   Status: ${order.result.status}`);
    
    res.json({
      id: order.result.id,
      status: order.result.status
    });
  } catch (err) {
    console.error('❌ PayPal get order error:', {
      orderId: paypalOrderId,
      message: err.message,
      statusCode: err.statusCode
    });
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

  console.log(`💰 Capture request for order: ${paypalOrderId}`);
  console.log(`   Has clientId: ${!!clientId}`);
  console.log(`   Has clientSecret: ${!!clientSecret}`);

  if (!clientId || !clientSecret) {
    console.error('❌ Missing credentials in capture request');
    return res.status(400).json({ 
      error: 'Missing credentials - clientId and clientSecret are required' 
    });
  }

  try {
    const paypalClient = createPayPalClient(clientId, clientSecret, mode);
    
    // First, check the order status before attempting capture
    console.log('   Checking order status before capture...');
    const statusRequest = new paypal.orders.OrdersGetRequest(paypalOrderId);
    const statusResponse = await paypalClient.execute(statusRequest);
    
    console.log(`   Current order status: ${statusResponse.result.status}`);
    
    // Check if order can be captured
    if (statusResponse.result.status === 'COMPLETED') {
      console.log('⚠️  Order already completed, returning existing data');
      return res.json(statusResponse.result);
    }
    
    if (statusResponse.result.status !== 'APPROVED') {
      console.error(`❌ Cannot capture order in status: ${statusResponse.result.status}`);
      return res.status(422).json({
        error: `Order cannot be captured. Current status: ${statusResponse.result.status}`,
        details: `Order must be APPROVED to capture, but is currently ${statusResponse.result.status}`,
        currentStatus: statusResponse.result.status,
        orderId: paypalOrderId
      });
    }

    // Proceed with capture
    console.log('   Order is APPROVED, proceeding with capture...');
    const request = new paypal.orders.OrdersCaptureRequest(paypalOrderId);
    request.requestBody({});

    const capture = await paypalClient.execute(request);
    
    console.log(`✅ Payment captured successfully: ${paypalOrderId}`);
    console.log(`   Capture ID: ${capture.result.purchase_units[0]?.payments?.captures[0]?.id}`);
    console.log(`   Payer: ${capture.result.payer?.email_address}`);
    console.log(`   Status: ${capture.result.status}`);
    
    res.json(capture.result);
  } catch (err) {
    console.error('❌ PayPal capture error:', {
      orderId: paypalOrderId,
      message: err.message,
      statusCode: err.statusCode,
      details: JSON.stringify(err.details, null, 2)
    });
    
    // Enhanced error messages based on PayPal error codes
    let errorMessage = 'Failed to capture payment';
    let errorDetails = err.message;
    
    if (err.statusCode === 422) {
      errorMessage = 'Order cannot be captured in its current state';
      if (err.message.includes('INSTRUMENT_DECLINED')) {
        errorDetails = 'Payment instrument was declined. Please try a different payment method.';
      } else if (err.message.includes('ORDER_NOT_APPROVED')) {
        errorDetails = 'Order has not been approved by the payer yet.';
      } else if (err.message.includes('ORDER_ALREADY_CAPTURED')) {
        errorDetails = 'This order has already been captured.';
      }
    } else if (err.statusCode === 401) {
      errorMessage = 'Invalid PayPal credentials';
      errorDetails = 'Please verify your Client ID and Secret are correct.';
    }
    
    res.status(err.statusCode || 500).json({ 
      error: errorMessage,
      details: errorDetails,
      orderId: paypalOrderId
    });
  }
});

// Legacy endpoint for backward compatibility (simulate mode)
app.post('/payments/create', authenticate, async (req, res) => {
  const { amount } = req.body;

  if (!amount) {
    return res.status(400).json({ error: 'Missing amount' });
  }

  console.log('⚠️  Legacy /payments/create endpoint called - returning mock data');
  
  // Return mock data for simulation
  res.json({
    id: `MOCK-${Date.now()}`,
    status: 'CREATED',
    requiresCredentials: true,
    message: 'Use /payments/create-with-credentials endpoint with your PayPal credentials'
  });
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`💳 Payments service running on port ${PORT}`);
  console.log('✅ Per-user PayPal Sandbox credentials enabled');
  console.log('✅ Enhanced error logging and handling enabled');
  console.log('💡 Version 1.2 - Enhanced');
});
import React, { useState, useEffect } from 'react';
import { useKeycloak } from './keycloakContext';

// Load PayPal SDK dynamically
const loadPayPalScript = (clientId) => {
  return new Promise((resolve, reject) => {
    if (window.paypal) {
      resolve(window.paypal);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
    script.onload = () => resolve(window.paypal);
    script.onerror = () => reject(new Error('PayPal SDK failed to load'));
    document.body.appendChild(script);
  });
};

function Payment({ amount, onSuccess, onCancel, apiUrl = 'http://localhost:3002' }) {
  const { getToken } = useKeycloak();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paypalClientId, setPaypalClientId] = useState('');
  const [useSimulation, setUseSimulation] = useState(false);

  useEffect(() => {
    // Get PayPal client ID from backend
    fetch(`${apiUrl}/payments/config`)
      .then(res => res.json())
      .then(data => {
        if (data.clientId && data.clientId !== 'your-client-id') {
          setPaypalClientId(data.clientId);
          setUseSimulation(false);
        } else {
          // No valid PayPal configured, use simulation
          setUseSimulation(true);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error('Failed to get PayPal config:', err);
        setUseSimulation(true);
        setLoading(false);
      });
  }, [apiUrl]);

  useEffect(() => {
    if (!paypalClientId || useSimulation) return;

    loadPayPalScript(paypalClientId)
      .then(paypal => {
        paypal.Buttons({
          createOrder: async (data, actions) => {
            try {
              const res = await fetch(`${apiUrl}/payments/create`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({ amount })
              });

              const orderData = await res.json();
              return orderData.id; // PayPal order ID
            } catch (err) {
              console.error('Create order error:', err);
              setError('Failed to create PayPal order');
              throw err;
            }
          },
          onApprove: async (data, actions) => {
            try {
              const res = await fetch(`${apiUrl}/payments/${data.orderID}/capture`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${getToken()}`
                }
              });

              const captureData = await res.json();
              onSuccess(captureData);
            } catch (err) {
              console.error('Capture error:', err);
              setError('Payment capture failed');
            }
          },
          onError: (err) => {
            console.error('PayPal error:', err);
            setError('PayPal transaction failed');
          },
          onCancel: () => {
            onCancel();
          }
        }).render('#paypal-button-container');

        setLoading(false);
      })
      .catch(err => {
        console.error('PayPal SDK error:', err);
        setError('Failed to load PayPal');
        setLoading(false);
      });
  }, [paypalClientId, amount, apiUrl, getToken, onSuccess, onCancel, useSimulation]);

  const handleSimulatedPayment = async () => {
    setLoading(true);
    setError('');

    try {
      // Simulate 2 second payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Create simulated payment data
      const simulatedData = {
        id: `SIM-${Date.now()}`,
        status: 'COMPLETED',
        amount: amount,
        payer: {
          email: 'test@example.com',
          name: 'Test User'
        },
        create_time: new Date().toISOString()
      };

      onSuccess(simulatedData);
    } catch (err) {
      setError('Simulated payment failed');
      setLoading(false);
    }
  };

  return (
    <div className="payment-modal">
      <div className="payment-content">
        <h2>💳 Payment</h2>
        
        <div className="payment-details">
          <div className="payment-detail-row">
            <span>Amount:</span>
            <strong className="payment-amount">${parseFloat(amount).toFixed(2)}</strong>
          </div>
        </div>

        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}

        {useSimulation ? (
          <div className="simulation-mode">
            <div className="simulation-notice">
              ℹ️ PayPal Sandbox not configured - Using simulation mode
            </div>
            <p className="simulation-text">
              To use real PayPal Sandbox, configure PAYPAL_CLIENT_ID in docker-compose.yml
            </p>
            <div className="payment-actions">
              <button
                className="btn btn-primary"
                onClick={handleSimulatedPayment}
                disabled={loading}
              >
                {loading ? 'Processing...' : '✅ Simulate Payment (Test Mode)'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={onCancel}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="paypal-container">
            {loading && (
              <div className="payment-loading">
                <div className="spinner"></div>
                <p>Loading PayPal...</p>
              </div>
            )}
            
            <div id="paypal-button-container"></div>
            
            <button
              className="btn btn-secondary cancel-button"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        )}

        {!useSimulation && !loading && (
          <div className="paypal-info">
            <p>🔒 Secure payment powered by PayPal Sandbox</p>
            <p className="sandbox-notice">
              💡 This is a test environment - use sandbox account to pay with fake money
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Payment;
import React, { useState } from 'react';
import { useKeycloak } from './keycloakContext';
import MockPayPal from './MockPayPal';

function Payment({ amount, onSuccess, onCODSuccess, onCancel, apiUrl = 'http://localhost:3002' }) {
  const { getToken } = useKeycloak();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(null); // null, 'mock', 'paypal', 'cod'
  const [showMockPayPal, setShowMockPayPal] = useState(false);
  
  // PayPal credentials state (for real PayPal)
  const [showCredentialsForm, setShowCredentialsForm] = useState(false);
  const [paypalCredentials, setPaypalCredentials] = useState({
    clientId: '',
    clientSecret: ''
  });
  const [credentialsSubmitted, setCredentialsSubmitted] = useState(false);

  // Mock PayPal Handler
  const handleMockPayPal = () => {
    setPaymentMethod('mock');
    setShowMockPayPal(true);
    setError('');
  };

  const handleMockPayPalSuccess = (paymentData) => {
    setShowMockPayPal(false);
    onSuccess(paymentData);
  };

  const handleMockPayPalCancel = () => {
    setShowMockPayPal(false);
    setPaymentMethod(null);
  };

  // Real PayPal Handler
  const handlePayPalClick = () => {
    setPaymentMethod('paypal');
    setShowCredentialsForm(true);
    setError('');
  };

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    
    if (!paypalCredentials.clientId || !paypalCredentials.clientSecret) {
      setError('Please enter both Client ID and Client Secret');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const createRes = await fetch(`${apiUrl}/payments/create-with-credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          amount,
          clientId: paypalCredentials.clientId,
          clientSecret: paypalCredentials.clientSecret
        })
      });

      if (!createRes.ok) {
        const errorData = await createRes.json();
        throw new Error(errorData.error || 'Failed to create PayPal order');
      }

      const orderData = await createRes.json();
      
      const approvalUrl = orderData.links?.find(link => link.rel === 'approve')?.href;
      
      if (!approvalUrl) {
        throw new Error('PayPal approval URL not found');
      }

      const paypalWindow = window.open(approvalUrl, 'PayPal', 'width=500,height=600');
      
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`${apiUrl}/payments/${orderData.id}/status`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({
              clientId: paypalCredentials.clientId,
              clientSecret: paypalCredentials.clientSecret
            })
          });

          if (statusRes.ok) {
            const statusData = await statusRes.json();
            
            if (statusData.status === 'APPROVED') {
              clearInterval(pollInterval);
              if (paypalWindow) paypalWindow.close();
              
              const captureRes = await fetch(`${apiUrl}/payments/${orderData.id}/capture`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                  clientId: paypalCredentials.clientId,
                  clientSecret: paypalCredentials.clientSecret
                })
              });

              if (!captureRes.ok) {
                throw new Error('Failed to capture payment');
              }

              const captureData = await captureRes.json();
              onSuccess(captureData);
            } else if (statusData.status === 'VOIDED' || statusData.status === 'CANCELLED') {
              clearInterval(pollInterval);
              if (paypalWindow) paypalWindow.close();
              setError('Payment was cancelled');
              setLoading(false);
            }
          }
        } catch (err) {
          console.error('Poll error:', err);
        }
      }, 2000);

      setTimeout(() => {
        clearInterval(pollInterval);
        if (paypalWindow && !paypalWindow.closed) {
          paypalWindow.close();
        }
        if (loading) {
          setError('Payment timeout - please try again');
          setLoading(false);
        }
      }, 300000);

      setCredentialsSubmitted(true);

    } catch (err) {
      console.error('PayPal payment error:', err);
      setError(err.message || 'Failed to process PayPal payment');
      setLoading(false);
    }
  };

  // COD Handler
  const handleCODPayment = async () => {
    setPaymentMethod('cod');
    setLoading(true);
    setError('');

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      onCODSuccess();
    } catch (err) {
      setError('COD order creation failed');
      setLoading(false);
    }
  };

  const handleBack = () => {
    setPaymentMethod(null);
    setShowCredentialsForm(false);
    setCredentialsSubmitted(false);
    setPaypalCredentials({ clientId: '', clientSecret: '' });
    setError('');
    setLoading(false);
  };

  return (
    <>
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

          {!paymentMethod && (
            <div className="payment-method-section">
              <h3 style={{marginBottom: '1.5rem', color: '#666', fontSize: '1rem'}}>
                Choose Payment Method:
              </h3>
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <button
                  className="btn btn-primary payment-method-btn"
                  onClick={handleMockPayPal}
                  disabled={loading}
                  style={{
                    background: 'linear-gradient(135deg, #0070ba 0%, #003087 100%)',
                    color: 'white',
                    padding: '1rem 1.5rem',
                    fontSize: '1rem',
                    fontWeight: '600'
                  }}
                >
                  💳 Mock PayPal
                </button>

                <button
                  className="btn btn-secondary payment-method-btn"
                  onClick={handlePayPalClick}
                  disabled={loading}
                  style={{
                    background: '#f5f5f5',
                    color: '#333',
                    border: '2px solid #0070ba',
                    padding: '1rem 1.5rem',
                    fontSize: '1rem',
                    fontWeight: '600'
                  }}
                >
                  💳 Real PayPal
                </button>

                <button
                  className="btn btn-success payment-method-btn"
                  onClick={handleCODPayment}
                  disabled={loading}
                  style={{
                    padding: '1rem 1.5rem',
                    fontSize: '1rem',
                    fontWeight: '600'
                  }}
                >
                  💵 Cash on Delivery
                </button>

                <button
                  className="btn btn-secondary cancel-button"
                  onClick={onCancel}
                  disabled={loading}
                  style={{
                    padding: '1rem 1.5rem',
                    fontSize: '1rem',
                    fontWeight: '600'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Real PayPal Credentials Form */}
          {paymentMethod === 'paypal' && showCredentialsForm && !credentialsSubmitted && (
            <div className="credentials-form">
              <h3 style={{marginBottom: '1rem', color: '#0070ba'}}>
                Enter PayPal Sandbox Credentials
              </h3>
              
              <div className="sandbox-info" style={{
                background: '#d1ecf1',
                padding: '1rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                fontSize: '0.9rem',
                color: '#0c5460'
              }}>
                <p style={{margin: '0 0 0.5rem 0', fontWeight: 'bold'}}>
                  ℹ️ PayPal Sandbox Credentials Required
                </p>
                <p style={{margin: 0}}>
                  Get them from <a href="https://developer.paypal.com" target="_blank" rel="noopener noreferrer" style={{color: '#0070ba', textDecoration: 'underline'}}>developer.paypal.com</a>
                </p>
              </div>

              <form onSubmit={handleCredentialsSubmit}>
                <div className="form-group" style={{marginBottom: '1rem'}}>
                  <label style={{display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#666'}}>
                    Client ID:
                  </label>
                  <input
                    type="text"
                    value={paypalCredentials.clientId}
                    onChange={(e) => setPaypalCredentials({
                      ...paypalCredentials,
                      clientId: e.target.value
                    })}
                    placeholder="Enter your PayPal Sandbox Client ID"
                    className="form-input"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e0e0e0',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      fontFamily: 'monospace'
                    }}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="form-group" style={{marginBottom: '1.5rem'}}>
                  <label style={{display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#666'}}>
                    Client Secret:
                  </label>
                  <input
                    type="password"
                    value={paypalCredentials.clientSecret}
                    onChange={(e) => setPaypalCredentials({
                      ...paypalCredentials,
                      clientSecret: e.target.value
                    })}
                    placeholder="Enter your PayPal Sandbox Client Secret"
                    className="form-input"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e0e0e0',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      fontFamily: 'monospace'
                    }}
                    required
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={loading}
                  style={{marginBottom: '0.75rem'}}
                >
                  {loading ? 'Processing Payment...' : '✅ Continue to PayPal'}
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-full"
                  onClick={handleBack}
                  disabled={loading}
                >
                  ← Back to Payment Methods
                </button>
              </form>
            </div>
          )}

          {/* Real PayPal Processing */}
          {credentialsSubmitted && loading && (
            <div className="payment-processing">
              <div className="spinner"></div>
              <h3 style={{color: '#0070ba', marginBottom: '1rem'}}>
                Complete Payment in PayPal Window
              </h3>
              <p style={{color: '#666', marginBottom: '0.5rem'}}>
                A PayPal window has opened. Please log in and complete your payment.
              </p>
              <p style={{color: '#999', fontSize: '0.9rem', fontStyle: 'italic'}}>
                This window will update automatically once payment is complete.
              </p>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setLoading(false);
                  handleBack();
                }}
                style={{marginTop: '1.5rem'}}
              >
                Cancel Payment
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mock PayPal Modal */}
      {showMockPayPal && (
        <MockPayPal
          amount={amount}
          onSuccess={handleMockPayPalSuccess}
          onCancel={handleMockPayPalCancel}
        />
      )}
    </>
  );
}

export default Payment;
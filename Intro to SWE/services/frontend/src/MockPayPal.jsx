import React, { useState, useEffect } from 'react';

function MockPayPal({ amount, onSuccess, onCancel }) {
  const [stage, setStage] = useState('login'); // login, review, processing, success
  const [email, setEmail] = useState('demo@paypal.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStage('review');
    }, 1500);
  };

  const handlePay = () => {
    setStage('processing');
    setTimeout(() => {
      setStage('success');
      setTimeout(() => {
        onSuccess({
          id: `MOCK-${Date.now()}`,
          status: 'COMPLETED',
          payer: {
            email_address: email,
            name: { given_name: 'Test', surname: 'User' }
          },
          purchase_units: [{
            payments: {
              captures: [{
                id: `CAPTURE-${Date.now()}`,
                status: 'COMPLETED',
                amount: { currency_code: 'USD', value: amount }
              }]
            }
          }]
        });
      }, 1500);
    }, 2000);
  };

  return (
    <div className="mock-paypal-overlay">
      <div className="mock-paypal-window">
        {/* PayPal Header */}
        <div className="mock-paypal-header">
          <div className="mock-paypal-logo">
            <span style={{color: '#003087', fontWeight: 'bold', fontSize: '24px'}}>Pay</span>
            <span style={{color: '#009cde', fontWeight: 'bold', fontSize: '24px'}}>Pal</span>
          </div>
          <button className="mock-close-btn" onClick={onCancel}>✕</button>
        </div>

        {/* Demo Notice */}
        <div className="mock-demo-notice">
          🎭 DEMO MODE - This is a simulated PayPal interface for testing
        </div>

        {/* Login Stage */}
        {stage === 'login' && (
          <div className="mock-paypal-content">
            <h2 style={{textAlign: 'center', color: '#2c2e2f', marginBottom: '8px'}}>
              Log in to your PayPal account
            </h2>
            <p style={{textAlign: 'center', color: '#6c7378', marginBottom: '24px', fontSize: '14px'}}>
              Demo mode - use any email/password
            </p>
            
            <form onSubmit={handleLogin}>
              <div className="mock-form-group">
                <label>Email or mobile number</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="demo@paypal.com"
                  required
                  disabled={loading}
                />
              </div>

              <div className="mock-form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter any password"
                  required
                  disabled={loading}
                />
              </div>

              <button 
                type="submit" 
                className="mock-paypal-btn mock-paypal-btn-primary"
                disabled={loading}
              >
                {loading ? 'Logging in...' : 'Log In'}
              </button>
            </form>

            <div style={{textAlign: 'center', marginTop: '16px'}}>
              <a href="#" style={{color: '#0070ba', fontSize: '14px'}}>Forgot password?</a>
            </div>
          </div>
        )}

        {/* Review Stage */}
        {stage === 'review' && (
          <div className="mock-paypal-content">
            <h2 style={{textAlign: 'center', color: '#2c2e2f', marginBottom: '24px'}}>
              Review your payment
            </h2>

            <div className="mock-payment-summary">
              <div className="mock-merchant-info">
                <div style={{fontSize: '14px', color: '#6c7378', marginBottom: '4px'}}>
                  Paying to
                </div>
                <div style={{fontSize: '18px', fontWeight: '600', color: '#2c2e2f'}}>
                  Marketplace Store
                </div>
              </div>

              <div className="mock-amount-display">
                <div style={{fontSize: '14px', color: '#6c7378'}}>Total</div>
                <div style={{fontSize: '32px', fontWeight: 'bold', color: '#2c2e2f'}}>
                  ${parseFloat(amount).toFixed(2)}
                </div>
                <div style={{fontSize: '12px', color: '#6c7378'}}>USD</div>
              </div>

              <div className="mock-payment-source">
                <div style={{fontSize: '14px', color: '#6c7378', marginBottom: '8px'}}>
                  Payment method
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  background: '#f5f7fa',
                  borderRadius: '8px'
                }}>
                  <div style={{fontSize: '24px'}}>💳</div>
                  <div>
                    <div style={{fontWeight: '600', color: '#2c2e2f'}}>
                      PayPal Balance
                    </div>
                    <div style={{fontSize: '14px', color: '#6c7378'}}>
                      ${(parseFloat(amount) + 5000).toFixed(2)} available
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button 
              className="mock-paypal-btn mock-paypal-btn-primary"
              onClick={handlePay}
              style={{marginTop: '24px'}}
            >
              Pay Now
            </button>

            <button 
              className="mock-paypal-btn mock-paypal-btn-secondary"
              onClick={onCancel}
              style={{marginTop: '12px'}}
            >
              Cancel and Return
            </button>
          </div>
        )}

        {/* Processing Stage */}
        {stage === 'processing' && (
          <div className="mock-paypal-content" style={{textAlign: 'center', padding: '60px 20px'}}>
            <div className="mock-spinner" style={{margin: '0 auto 24px'}}></div>
            <h2 style={{color: '#2c2e2f', marginBottom: '12px'}}>
              Processing your payment
            </h2>
            <p style={{color: '#6c7378', fontSize: '14px'}}>
              Please wait while we confirm your payment...
            </p>
          </div>
        )}

        {/* Success Stage */}
        {stage === 'success' && (
          <div className="mock-paypal-content" style={{textAlign: 'center', padding: '60px 20px'}}>
            <div style={{
              width: '80px',
              height: '80px',
              background: '#28a745',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              fontSize: '48px'
            }}>
              ✓
            </div>
            <h2 style={{color: '#2c2e2f', marginBottom: '12px'}}>
              Payment Successful!
            </h2>
            <p style={{color: '#6c7378', fontSize: '14px', marginBottom: '8px'}}>
              Your payment of <strong>${parseFloat(amount).toFixed(2)}</strong> has been completed.
            </p>
            <p style={{color: '#6c7378', fontSize: '12px'}}>
              Returning to merchant...
            </p>
          </div>
        )}

        {/* PayPal Footer */}
        <div className="mock-paypal-footer">
          <div style={{fontSize: '12px', color: '#6c7378', textAlign: 'center'}}>
            🔒 Secured by Mock PayPal
          </div>
        </div>
      </div>

      <style jsx>{`
        .mock-paypal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .mock-paypal-window {
          background: white;
          border-radius: 8px;
          width: 90%;
          max-width: 450px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from {
            transform: translateY(50px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .mock-paypal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .mock-paypal-logo {
          font-family: 'Verdana', sans-serif;
        }

        .mock-close-btn {
          background: none;
          border: none;
          font-size: 24px;
          color: #6c7378;
          cursor: pointer;
          padding: 4px 8px;
        }

        .mock-close-btn:hover {
          color: #2c2e2f;
        }

        .mock-demo-notice {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 12px 20px;
          text-align: center;
          font-size: 13px;
          font-weight: 600;
        }

        .mock-paypal-content {
          padding: 32px 20px;
        }

        .mock-form-group {
          margin-bottom: 20px;
        }

        .mock-form-group label {
          display: block;
          margin-bottom: 8px;
          color: #2c2e2f;
          font-size: 14px;
          font-weight: 500;
        }

        .mock-form-group input {
          width: 100%;
          padding: 12px 16px;
          border: 1px solid #cbd2d9;
          border-radius: 4px;
          font-size: 16px;
          transition: border-color 0.2s;
        }

        .mock-form-group input:focus {
          outline: none;
          border-color: #0070ba;
          box-shadow: 0 0 0 3px rgba(0, 112, 186, 0.1);
        }

        .mock-form-group input:disabled {
          background: #f5f7fa;
          cursor: not-allowed;
        }

        .mock-paypal-btn {
          width: 100%;
          padding: 14px 20px;
          border: none;
          border-radius: 4px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .mock-paypal-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .mock-paypal-btn-primary {
          background: #0070ba;
          color: white;
        }

        .mock-paypal-btn-primary:hover:not(:disabled) {
          background: #005ea6;
        }

        .mock-paypal-btn-secondary {
          background: #f5f7fa;
          color: #2c2e2f;
          border: 1px solid #cbd2d9;
        }

        .mock-paypal-btn-secondary:hover:not(:disabled) {
          background: #e5e7eb;
        }

        .mock-payment-summary {
          background: #f5f7fa;
          border-radius: 8px;
          padding: 20px;
        }

        .mock-merchant-info {
          padding-bottom: 16px;
          border-bottom: 1px solid #e5e7eb;
          margin-bottom: 16px;
        }

        .mock-amount-display {
          text-align: center;
          padding: 24px 0;
          border-bottom: 1px solid #e5e7eb;
          margin-bottom: 16px;
        }

        .mock-payment-source {
          margin-top: 16px;
        }

        .mock-paypal-footer {
          padding: 16px 20px;
          border-top: 1px solid #e5e7eb;
          background: #f5f7fa;
        }

        .mock-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #0070ba;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default MockPayPal;
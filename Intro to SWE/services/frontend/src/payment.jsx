import React, { useState } from 'react';
import { useKeycloak } from './keycloakContext';

function Payment({ orderId, amount, onSuccess, onCancel }) {
  const { getToken } = useKeycloak();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePayment = async () => {
    try {
      setLoading(true);
      setError('');

      // Create payment
      const createRes = await fetch('http://payments.localhost/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ orderId, amount })
      });

      if (!createRes.ok) {
        throw new Error('Failed to create payment');
      }

      const paymentData = await createRes.json();

      // In a real implementation, you would redirect to PayPal or show PayPal buttons
      // For now, we'll simulate approval and capture
      console.log('Payment created:', paymentData);

      // Simulate payment approval (in real world, user would approve via PayPal)
      const approveLink = paymentData.links?.find(link => link.rel === 'approve');
      
      if (approveLink) {
        // In production, redirect user to PayPal
        console.log('Redirect to PayPal:', approveLink.href);
        
        // For demo purposes, auto-capture after short delay
        setTimeout(async () => {
          try {
            const captureRes = await fetch(
              `http://payments.localhost/payments/${paymentData.paymentId}/capture`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${getToken()}`
                }
              }
            );

            if (!captureRes.ok) {
              throw new Error('Failed to capture payment');
            }

            const captureData = await captureRes.json();
            console.log('Payment captured:', captureData);
            onSuccess(captureData);
          } catch (err) {
            setError(err.message);
            setLoading(false);
          }
        }, 2000);
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="payment-modal">
      <div className="payment-content">
        <h2>Payment</h2>
        <div className="payment-details">
          <p>Order ID: <strong>#{orderId}</strong></p>
          <p>Amount: <strong>${parseFloat(amount).toFixed(2)}</strong></p>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="payment-actions">
          <button
            className="btn btn-primary"
            onClick={handlePayment}
            disabled={loading}
          >
            {loading ? 'Processing Payment...' : 'Pay with PayPal'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
        </div>

        {loading && (
          <div className="payment-processing">
            <div className="spinner"></div>
            <p>Processing your payment...</p>
            <p className="payment-note">
              In a production environment, you would be redirected to PayPal
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Payment;
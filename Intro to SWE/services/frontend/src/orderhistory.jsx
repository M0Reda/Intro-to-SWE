import React, { useState, useEffect } from 'react';
import { useKeycloak } from './keycloakContext';

function OrderHistory({ apiUrl = 'http://localhost:3000' }) {
  const { getToken } = useKeycloak();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [cancellingOrder, setCancellingOrder] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${apiUrl}/orders`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      if (!res.ok) {
        throw new Error('Failed to load orders');
      }

      const data = await res.json();
      setOrders(data);
    } catch (err) {
      console.error('Failed to load orders:', err);
      setError('Failed to load order history');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!confirm('Are you sure you want to cancel this order? The inventory will be restored.')) {
      return;
    }

    try {
      setCancellingOrder(orderId);
      const res = await fetch(`${apiUrl}/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to cancel order');
      }

      const result = await res.json();
      showMessage('Order cancelled successfully! Inventory has been restored.', 'success');
      
      // Reload orders to show updated status
      await loadOrders();
    } catch (err) {
      console.error('Cancel order error:', err);
      showMessage(err.message || 'Failed to cancel order', 'error');
    } finally {
      setCancellingOrder(null);
    }
  };

  const showMessage = (text, type = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(''), 5000);
  };

  const toggleOrder = (orderId) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      pending: 'status-pending',
      completed: 'status-completed',
      cancelled: 'status-cancelled',
      processing: 'status-processing'
    };

    const statusLabels = {
      pending: 'PENDING PAYMENT',
      completed: 'COMPLETED',
      cancelled: 'CANCELLED',
      processing: 'PROCESSING'
    };

    const statusIcons = {
      pending: '⏳',
      completed: '✅',
      cancelled: '❌',
      processing: '🔄'
    };

    return (
      <span className={`order-status ${statusClasses[status] || 'status-pending'}`}>
        {statusIcons[status] || '⏳'} {statusLabels[status] || status?.toUpperCase() || 'PENDING'}
      </span>
    );
  };

  const canCancelOrder = (order) => {
    // Can only cancel orders that are not already cancelled
    return order.status !== 'cancelled';
  };

  if (loading) {
    return (
      <div className="order-history-loading">
        <div className="spinner"></div>
        <p>Loading your orders...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="order-history-error">
        <p>❌ {error}</p>
        <button className="btn btn-primary" onClick={loadOrders}>
          Try Again
        </button>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="order-history-empty">
        <h3>📦 No Orders Yet</h3>
        <p>Your order history will appear here once you make your first purchase.</p>
      </div>
    );
  }

  return (
    <div className="order-history">
      <div className="order-history-header">
        <h2>Order History</h2>
        <button className="btn btn-secondary" onClick={loadOrders}>
          🔄 Refresh
        </button>
      </div>

      {message && (
        <div className={`message ${message.type}`} style={{marginBottom: '1rem'}}>
          {message.text}
        </div>
      )}

      <div className="orders-list">
        {orders.map((order) => (
          <div key={order.id} className="order-card">
            <div className="order-header" onClick={() => toggleOrder(order.id)}>
              <div className="order-header-left">
                <h3>Order #{order.id}</h3>
                <span className="order-date">{formatDate(order.created_at)}</span>
              </div>
              <div className="order-header-right">
                {getStatusBadge(order.status)}
                <span className="order-total">${parseFloat(order.total).toFixed(2)}</span>
                <button className="expand-btn">
                  {expandedOrder === order.id ? '▼' : '▶'}
                </button>
              </div>
            </div>

            {expandedOrder === order.id && (
              <div className="order-details">
                <h4>Order Items:</h4>
                <div className="order-items-list">
                  {order.items.map((item, index) => (
                    <div key={index} className="order-item">
                      <div className="order-item-info">
                        <span className="order-item-sku">SKU: {item.sku}</span>
                        <span className="order-item-qty">Quantity: {item.qty}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="order-summary">
                  <div className="order-summary-row">
                    <span>Items:</span>
                    <span>{order.items.reduce((sum, item) => sum + item.qty, 0)}</span>
                  </div>
                  <div className="order-summary-row">
                    <span>Status:</span>
                    <span>{order.status?.toUpperCase() || 'PENDING'}</span>
                  </div>
                  <div className="order-summary-row order-summary-total">
                    <span>Total:</span>
                    <span>${parseFloat(order.total).toFixed(2)}</span>
                  </div>
                </div>

                {/* Cancel Order Button */}
                {canCancelOrder(order) && (
                  <div className="order-actions" style={{marginTop: '1rem', paddingTop: '1rem', borderTop: '2px solid #e0e0e0'}}>
                    <button
                      className="btn btn-danger btn-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelOrder(order.id);
                      }}
                      disabled={cancellingOrder === order.id}
                    >
                      {cancellingOrder === order.id ? 'Cancelling...' : '❌ Cancel Order & Restore Inventory'}
                    </button>
                    <p style={{fontSize: '0.85rem', color: '#666', marginTop: '0.5rem', textAlign: 'center'}}>
                      ℹ️ Cancelling will restore all items to inventory
                    </p>
                  </div>
                )}

                {order.status === 'cancelled' && (
                  <div style={{marginTop: '1rem', padding: '1rem', background: '#f8d7da', borderRadius: '8px', textAlign: 'center'}}>
                    <p style={{color: '#721c24', margin: 0}}>
                      ℹ️ This order has been cancelled. Inventory was restored.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default OrderHistory;
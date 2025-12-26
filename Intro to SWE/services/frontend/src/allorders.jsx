import React, { useState, useEffect } from 'react';
import { useKeycloak } from './keycloakContext';

function AllOrders({ apiUrl = 'http://localhost:3000' }) {
  const { getToken } = useKeycloak();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchUser, setSearchUser] = useState('');
  const [cancellingOrder, setCancellingOrder] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadAllOrders();
  }, []);

  const loadAllOrders = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${apiUrl}/orders/all`, {
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
      console.error('Failed to load all orders:', err);
      setError('Failed to load orders. Make sure you have admin privileges.');
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
      await loadAllOrders();
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

  // Helper function to format user_id for display
  const formatUserId = (userId) => {
    if (!userId) return 'Unknown';
    // Show first 8 chars of user_id
    return userId.length > 8 ? `${userId.substring(0, 8)}...` : userId;
  };

  const canCancelOrder = (order) => {
    // Can only cancel orders that are not already cancelled
    return order.status !== 'cancelled';
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    const matchesUser = !searchUser || order.user_id.toLowerCase().includes(searchUser.toLowerCase());
    return matchesStatus && matchesUser;
  });

  // Calculate statistics
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    completed: orders.filter(o => o.status === 'completed').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
    totalRevenue: orders
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + parseFloat(o.total), 0)
  };

  if (loading) {
    return (
      <div className="order-history-loading">
        <div className="spinner"></div>
        <p>Loading all orders...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="order-history-error">
        <p>❌ {error}</p>
        <button className="btn btn-primary" onClick={loadAllOrders}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="all-orders">
      <div className="admin-orders-header">
        <h2>👑 All Orders (Admin View)</h2>
        <button className="btn btn-secondary" onClick={loadAllOrders}>
          🔄 Refresh
        </button>
      </div>

      {message && (
        <div className={`message ${message.type}`} style={{marginBottom: '1rem'}}>
          {message.text}
        </div>
      )}

      {/* Statistics Dashboard */}
      <div className="orders-stats">
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-content">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Orders</div>
          </div>
        </div>
        <div className="stat-card stat-pending">
          <div className="stat-icon">⏳</div>
          <div className="stat-content">
            <div className="stat-value">{stats.pending}</div>
            <div className="stat-label">Pending</div>
          </div>
        </div>
        <div className="stat-card stat-completed">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <div className="stat-value">{stats.completed}</div>
            <div className="stat-label">Completed</div>
          </div>
        </div>
        <div className="stat-card stat-cancelled">
          <div className="stat-icon">❌</div>
          <div className="stat-content">
            <div className="stat-value">{stats.cancelled}</div>
            <div className="stat-label">Cancelled</div>
          </div>
        </div>
        <div className="stat-card stat-revenue">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-value">${stats.totalRevenue.toFixed(2)}</div>
            <div className="stat-label">Total Revenue</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="orders-filters">
        <div className="filter-group">
          <label>Filter by Status:</label>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Orders</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="processing">Processing</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Search by User ID:</label>
          <input
            type="text"
            value={searchUser}
            onChange={(e) => setSearchUser(e.target.value)}
            placeholder="Enter user ID..."
            className="filter-input"
          />
        </div>
        <div className="filter-results">
          Showing {filteredOrders.length} of {orders.length} orders
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="order-history-empty">
          <h3>📦 No Orders Found</h3>
          <p>No orders match your current filters.</p>
        </div>
      ) : (
        <div className="orders-list">
          {filteredOrders.map((order) => (
            <div key={order.id} className="order-card">
              <div className="order-header" onClick={() => toggleOrder(order.id)}>
                <div className="order-header-left">
                  <h3>Order #{order.id}</h3>
                  <span className="order-date">{formatDate(order.created_at)}</span>
                  <span className="order-user-id" title={order.user_id}>
                    👤 User ID: {formatUserId(order.user_id)}
                  </span>
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
                  <div className="order-details-grid">
                    <div className="order-detail-section">
                      <h4>Order Information</h4>
                      <div className="order-info-row">
                        <span className="label">Order ID:</span>
                        <span className="value">#{order.id}</span>
                      </div>
                      <div className="order-info-row">
                        <span className="label">User ID:</span>
                        <span className="value" style={{fontSize: '0.85rem', fontFamily: 'monospace', wordBreak: 'break-all'}}>
                          {order.user_id}
                        </span>
                      </div>
                      <div className="order-info-row">
                        <span className="label">Status:</span>
                        <span className="value">{order.status?.toUpperCase()}</span>
                      </div>
                      <div className="order-info-row">
                        <span className="label">Created:</span>
                        <span className="value">{formatDate(order.created_at)}</span>
                      </div>
                    </div>
                    
                    <div className="order-detail-section">
                      <h4>Order Items ({order.items.reduce((sum, item) => sum + item.qty, 0)} items)</h4>
                      <div className="order-items-list">
                        {order.items.map((item, index) => (
                          <div key={index} className="order-item">
                            <div className="order-item-info">
                              <span className="order-item-sku">SKU: {item.sku}</span>
                              <span className="order-item-qty">Qty: {item.qty}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="order-summary">
                    <div className="order-summary-row order-summary-total">
                      <span>Total:</span>
                      <span>${parseFloat(order.total).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Admin Cancel Order Button */}
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
                        {cancellingOrder === order.id ? 'Cancelling...' : '👑 Admin: Cancel Order & Restore Inventory'}
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
      )}
    </div>
  );
}

export default AllOrders;
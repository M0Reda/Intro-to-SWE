import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { KeycloakProvider, useKeycloak } from './keycloakContext.jsx';
import Cart from './cart.jsx';
import SearchInventory from './searchinventory.jsx';
import Payment from './payment.jsx';
import OrderHistory from './orderhistory.jsx';
import AdminInventory from './admininventory.jsx';
import './styles.css';

// API URLs - using direct ports
const API_URLS = {
  cart: 'http://localhost:3005',
  orders: 'http://localhost:3000',
  inventory: 'http://localhost:3004',
  payments: 'http://localhost:3002'
};

function App() {
  const { authenticated, loading, login, logout, getToken, getUserInfo } = useKeycloak();
  const [cart, setCart] = useState([]);
  const [loadingState, setLoadingState] = useState(false);
  const [message, setMessage] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [activeTab, setActiveTab] = useState('browse');
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if user is admin - SIMPLIFIED VERSION
  useEffect(() => {
    if (authenticated) {
      const userInfo = getUserInfo();
      const username = userInfo?.preferred_username || userInfo?.username || '';
      
      // Check if username is 'admin' (case-insensitive)
      const adminStatus = username.toLowerCase() === 'admin';
      setIsAdmin(adminStatus);
      
      console.log('👤 User:', username);
      console.log('🔐 Is Admin:', adminStatus);
    }
  }, [authenticated]);

  // Load cart on mount and when authenticated
  useEffect(() => {
    if (authenticated) {
      loadCart();
    }
  }, [authenticated]);

  const loadCart = async () => {
    if (!authenticated) return;
    
    try {
      const res = await fetch(`${API_URLS.cart}/cart`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      
      if (!res.ok) {
        throw new Error(`Cart API returned ${res.status}`);
      }
      
      const data = await res.json();
      setCart(data.items || []);
    } catch (err) {
      console.error('Failed to load cart:', err);
      setCart([]);
    }
  };

  const addToCart = async (item) => {
    if (!authenticated) {
      showMessage('Please login to add items to cart', 'error');
      return;
    }

    try {
      setLoadingState(true);
      const res = await fetch(`${API_URLS.cart}/cart`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          sku: item.sku,
          qty: 1,
          name: item.name,
          price: item.price
        })
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || `Failed to add to cart: ${res.status}`);
      }
      
      const data = await res.json();
      setCart(data.items || []);
      showMessage(`Added ${item.name} to cart!`, 'success');
    } catch (err) {
      console.error('Add to cart error:', err);
      showMessage(err.message, 'error');
    } finally {
      setLoadingState(false);
    }
  };

  const createOrder = async () => {
    if (!authenticated) {
      showMessage('Please login to create an order', 'error');
      return;
    }

    if (cart.length === 0) {
      showMessage('Your cart is empty!', 'error');
      return;
    }

    try {
      setLoadingState(true);
      const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
      const res = await fetch(`${API_URLS.orders}/orders`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          items: cart.map(item => ({ sku: item.sku, qty: item.qty })),
          total: total.toFixed(2)
        })
      });
      
      if (!res.ok) {
        throw new Error('Failed to create order');
      }
      
      const data = await res.json();
      setCurrentOrder(data);
      showMessage(`Order #${data.id} created successfully!`, 'success');
      setShowPayment(true);
    } catch (err) {
      console.error('Create order error:', err);
      showMessage('Failed to create order', 'error');
    } finally {
      setLoadingState(false);
    }
  };

  const handlePaymentSuccess = async (paymentData) => {
    showMessage('Payment completed successfully!', 'success');
    setShowPayment(false);
    setCurrentOrder(null);
    await clearCart();
    setActiveTab('orders');
  };

  const handlePaymentCancel = () => {
    setShowPayment(false);
    showMessage('Payment cancelled', 'info');
  };

  const clearCart = async () => {
    if (!authenticated) return;

    try {
      const res = await fetch(`${API_URLS.cart}/cart`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      
      if (!res.ok) {
        throw new Error('Failed to clear cart');
      }
      
      setCart([]);
      showMessage('Cart cleared', 'success');
    } catch (err) {
      console.error('Clear cart error:', err);
      showMessage('Failed to clear cart', 'error');
      setCart([]);
    }
  };

  const removeFromCart = async (sku) => {
    if (!authenticated) return;

    try {
      const res = await fetch(`${API_URLS.cart}/cart/${sku}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      
      if (!res.ok) {
        throw new Error('Failed to remove item');
      }
      
      const data = await res.json();
      setCart(data.items || []);
      showMessage('Item removed from cart', 'success');
    } catch (err) {
      console.error('Remove from cart error:', err);
      showMessage('Failed to remove item', 'error');
    }
  };

  const updateQuantity = async (sku, qty) => {
    if (!authenticated) return;

    try {
      const res = await fetch(`${API_URLS.cart}/cart/${sku}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ qty })
      });
      
      if (!res.ok) {
        throw new Error('Failed to update quantity');
      }
      
      const data = await res.json();
      setCart(data.items || []);
    } catch (err) {
      console.error('Update quantity error:', err);
      showMessage('Failed to update quantity', 'error');
    }
  };

  const showMessage = (text, type = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(''), 3000);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  const safeCart = Array.isArray(cart) ? cart : [];
  const cartTotal = safeCart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const cartCount = safeCart.reduce((sum, item) => sum + item.qty, 0);
  const userInfo = getUserInfo();

  return (
    <div className="app">
      <header className="header">
        <h1>🛍️ Marketplace</h1>
        <div className="header-actions">
          {authenticated ? (
            <>
              {!isAdmin && (
                <button 
                  className="cart-button"
                  onClick={() => setShowCart(!showCart)}
                >
                  🛒 Cart ({cartCount}) - ${cartTotal.toFixed(2)}
                </button>
              )}
              <div className="user-info">
                {isAdmin ? '👑' : '👤'} {userInfo?.username || userInfo?.preferred_username || 'User'}
                {isAdmin && <span className="admin-badge">ADMIN</span>}
              </div>
              <button className="btn btn-secondary" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={login}>
              Login
            </button>
          )}
        </div>
      </header>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="container">
        <div className="main-content">
          {!authenticated && (
            <div className="auth-notice">
              <h2>Welcome to Marketplace</h2>
              <p>Please login to start shopping and manage your cart</p>
              <button className="btn btn-primary btn-large" onClick={login}>
                Login with Keycloak
              </button>
            </div>
          )}

          {authenticated && (
            <>
              <div className="tabs">
                <button 
                  className={`tab ${activeTab === 'browse' ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab('browse')}
                >
                  🛍️ Browse Products
                </button>
                {!isAdmin && (
                  <button 
                    className={`tab ${activeTab === 'orders' ? 'tab-active' : ''}`}
                    onClick={() => setActiveTab('orders')}
                  >
                    📦 Order History
                  </button>
                )}
                {isAdmin && (
                  <button 
                    className={`tab ${activeTab === 'admin' ? 'tab-active' : ''}`}
                    onClick={() => setActiveTab('admin')}
                  >
                    🔧 Manage Inventory
                  </button>
                )}
              </div>

              <section className="section">
                {activeTab === 'browse' && (
                  <>
                    <h2>Browse Inventory</h2>
                    <SearchInventory onAddToCart={addToCart} apiUrl={API_URLS.inventory} />
                  </>
                )}
                
                {activeTab === 'orders' && !isAdmin && (
                  <OrderHistory apiUrl={API_URLS.orders} />
                )}
                
                {activeTab === 'admin' && isAdmin && (
                  <AdminInventory apiUrl={API_URLS.inventory} />
                )}
              </section>
            </>
          )}
        </div>

        {authenticated && showCart && !isAdmin && (
          <aside className="cart-sidebar">
            <Cart 
              userId={userInfo?.id}
              cart={safeCart}
              onRemove={removeFromCart}
              onUpdateQty={updateQuantity}
              onClose={() => setShowCart(false)}
              onCreateOrder={createOrder}
              onClearCart={clearCart}
              loading={loadingState}
            />
          </aside>
        )}
      </div>

      {showPayment && currentOrder && (
        <Payment
          orderId={currentOrder.id}
          amount={currentOrder.total}
          onSuccess={handlePaymentSuccess}
          onCancel={handlePaymentCancel}
          apiUrl={API_URLS.payments}
        />
      )}
    </div>
  );
}

function Root() {
  return (
    <KeycloakProvider>
      <App />
    </KeycloakProvider>
  );
}

createRoot(document.getElementById('root')).render(<Root />);
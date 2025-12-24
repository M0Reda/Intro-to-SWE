import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { KeycloakProvider, useKeycloak } from './keycloakContext.jsx';
import Cart from './cart.jsx';
import SearchInventory from './searchInventory.jsx';
import Payment from './payment.jsx';
import './styles.css';

function App() {
  const { authenticated, loading, login, logout, getToken, getUserInfo } = useKeycloak();
  const [cart, setCart] = useState([]);
  const [loadingState, setLoadingState] = useState(false);
  const [message, setMessage] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);

  // Load cart on mount and when authenticated
  useEffect(() => {
    if (authenticated) {
      loadCart();
    }
  }, [authenticated]);

  const loadCart = async () => {
    if (!authenticated) return;
    
    try {
      const res = await fetch(`http://cart.localhost/cart`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      const data = await res.json();
      setCart(data.items || []);
    } catch (err) {
      console.error('Failed to load cart:', err);
    }
  };

  const addToCart = async (item) => {
    if (!authenticated) {
      showMessage('Please login to add items to cart', 'error');
      return;
    }

    try {
      setLoadingState(true);
      const res = await fetch(`http://cart.localhost/cart`, {
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
      const data = await res.json();
      setCart(data.items);
      showMessage(`Added ${item.name} to cart!`, 'success');
    } catch (err) {
      showMessage('Failed to add item to cart', 'error');
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
      const res = await fetch('http://api.localhost/orders', {
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
      
      // Show payment modal
      setShowPayment(true);
    } catch (err) {
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
  };

  const handlePaymentCancel = () => {
    setShowPayment(false);
    showMessage('Payment cancelled', 'info');
  };

  const clearCart = async () => {
    if (!authenticated) return;

    try {
      await fetch(`http://cart.localhost/cart`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      setCart([]);
      showMessage('Cart cleared', 'success');
    } catch (err) {
      showMessage('Failed to clear cart', 'error');
    }
  };

  const removeFromCart = async (sku) => {
    if (!authenticated) return;

    try {
      const res = await fetch(`http://cart.localhost/cart/${sku}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      const data = await res.json();
      setCart(data.items);
      showMessage('Item removed from cart', 'success');
    } catch (err) {
      showMessage('Failed to remove item', 'error');
    }
  };

  const updateQuantity = async (sku, qty) => {
    if (!authenticated) return;

    try {
      const res = await fetch(`http://cart.localhost/cart/${sku}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ qty })
      });
      const data = await res.json();
      setCart(data.items);
    } catch (err) {
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

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const userInfo = getUserInfo();

  return (
    <div className="app">
      <header className="header">
        <h1>🛍️ Marketplace</h1>
        <div className="header-actions">
          {authenticated ? (
            <>
              <button 
                className="cart-button"
                onClick={() => setShowCart(!showCart)}
              >
                🛒 Cart ({cartCount}) - ${cartTotal.toFixed(2)}
              </button>
              <div className="user-info">
                👤 {userInfo?.username || 'User'}
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

          <section className="section">
            <h2>Browse Inventory</h2>
            <SearchInventory onAddToCart={addToCart} />
          </section>

          {authenticated && (
            <section className="section">
              <h2>Quick Actions</h2>
              <div className="actions">
                <button 
                  className="btn btn-primary"
                  onClick={createOrder}
                  disabled={loadingState || cart.length === 0}
                >
                  {loadingState ? 'Processing...' : 'Create Order & Pay'}
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={clearCart}
                  disabled={loadingState || cart.length === 0}
                >
                  Clear Cart
                </button>
              </div>
            </section>
          )}
        </div>

        {authenticated && showCart && (
          <aside className="cart-sidebar">
            <Cart 
              userId={userInfo?.id}
              cart={cart}
              onRemove={removeFromCart}
              onUpdateQty={updateQuantity}
              onClose={() => setShowCart(false)}
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
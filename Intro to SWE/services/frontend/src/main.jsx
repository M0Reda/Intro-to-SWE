import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import Cart from './cart.jsx';
import SearchInventory from './searchInventory.jsx';
import './styles.css';

function App() {
  const [userId] = useState('user1');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showCart, setShowCart] = useState(false);

  // Load cart on mount
  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = async () => {
    try {
      const res = await fetch(`http://cart.localhost/cart/${userId}`);
      const data = await res.json();
      setCart(data.items || []);
    } catch (err) {
      console.error('Failed to load cart:', err);
    }
  };

  const addToCart = async (item) => {
    try {
      setLoading(true);
      const res = await fetch(`http://cart.localhost/cart/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      setLoading(false);
    }
  };

  const createOrder = async () => {
    if (cart.length === 0) {
      showMessage('Your cart is empty!', 'error');
      return;
    }

    try {
      setLoading(true);
      const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
      const res = await fetch('http://api.localhost/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          items: cart.map(item => ({ sku: item.sku, qty: item.qty })),
          total: total.toFixed(2)
        })
      });
      const data = await res.json();
      showMessage(`Order #${data.id} created successfully!`, 'success');
      
      // Clear cart after order
      await clearCart();
    } catch (err) {
      showMessage('Failed to create order', 'error');
    } finally {
      setLoading(false);
    }
  };

  const clearCart = async () => {
    try {
      await fetch(`http://cart.localhost/cart/${userId}`, {
        method: 'DELETE'
      });
      setCart([]);
      showMessage('Cart cleared', 'success');
    } catch (err) {
      showMessage('Failed to clear cart', 'error');
    }
  };

  const removeFromCart = async (sku) => {
    try {
      const res = await fetch(`http://cart.localhost/cart/${userId}/${sku}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      setCart(data.items);
      showMessage('Item removed from cart', 'success');
    } catch (err) {
      showMessage('Failed to remove item', 'error');
    }
  };

  const updateQuantity = async (sku, qty) => {
    try {
      const res = await fetch(`http://cart.localhost/cart/${userId}/${sku}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className="app">
      <header className="header">
        <h1>🛍️ Marketplace</h1>
        <div className="header-actions">
          <button 
            className="cart-button"
            onClick={() => setShowCart(!showCart)}
          >
            🛒 Cart ({cartCount}) - ${cartTotal.toFixed(2)}
          </button>
          <div className="user-info">👤 {userId}</div>
        </div>
      </header>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="container">
        <div className="main-content">
          <section className="section">
            <h2>Browse Inventory</h2>
            <SearchInventory onAddToCart={addToCart} />
          </section>

          <section className="section">
            <h2>Quick Actions</h2>
            <div className="actions">
              <button 
                className="btn btn-primary"
                onClick={createOrder}
                disabled={loading || cart.length === 0}
              >
                {loading ? 'Processing...' : 'Create Order'}
              </button>
              <button 
                className="btn btn-secondary"
                onClick={clearCart}
                disabled={loading || cart.length === 0}
              >
                Clear Cart
              </button>
            </div>
          </section>
        </div>

        {showCart && (
          <aside className="cart-sidebar">
            <Cart 
              userId={userId}
              cart={cart}
              onRemove={removeFromCart}
              onUpdateQty={updateQuantity}
              onClose={() => setShowCart(false)}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
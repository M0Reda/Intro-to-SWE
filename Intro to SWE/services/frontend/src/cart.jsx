import React from 'react';

function Cart({ userId, cart, onRemove, onUpdateQty, onClose }) {
  const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  return (
    <div className="cart">
      <div className="cart-header">
        <h2>Your Cart</h2>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      {cart.length === 0 ? (
        <div className="empty-cart">
          <p>🛒 Your cart is empty</p>
          <p className="empty-cart-subtitle">Start shopping to add items!</p>
        </div>
      ) : (
        <>
          <div className="cart-items">
            {cart.map((item, index) => (
              <div key={item.sku} className="cart-item">
                <div className="cart-item-info">
                  <h4>{item.name}</h4>
                  <p className="cart-item-sku">SKU: {item.sku}</p>
                  <p className="cart-item-price">${item.price.toFixed(2)} each</p>
                </div>
                <div className="cart-item-actions">
                  <div className="quantity-controls">
                    <button 
                      className="qty-btn"
                      onClick={() => onUpdateQty(item.sku, item.qty - 1)}
                    >
                      -
                    </button>
                    <span className="quantity">{item.qty}</span>
                    <button 
                      className="qty-btn"
                      onClick={() => onUpdateQty(item.sku, item.qty + 1)}
                    >
                      +
                    </button>
                  </div>
                  <button 
                    className="remove-btn"
                    onClick={() => onRemove(item.sku)}
                  >
                    Remove
                  </button>
                </div>
                <div className="cart-item-total">
                  ${(item.price * item.qty).toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          <div className="cart-footer">
            <div className="cart-total">
              <span>Total:</span>
              <span className="total-amount">${total.toFixed(2)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Cart;
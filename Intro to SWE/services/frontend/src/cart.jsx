import React, { useEffect, useState } from 'react';

function cart({ userId }) {
  const [cart, setCart] = useState([]);

  useEffect(() => {
    fetch(`http://cart.localhost/cart/${userId}`)
      .then(res => res.json())
      .then(data => setCart(data.items))
      .catch(err => console.error(err));
  }, [userId]);

  return (
    <div style={{ padding: 20 }}>
      <h1>{userId}'s Cart</h1>
      {cart.length === 0 ? (
        <p>Your cart is empty</p>
      ) : (
        <ul>
          {cart.map((item, i) => (
            <li key={i}>{item.sku} x {item.qty}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default cart;

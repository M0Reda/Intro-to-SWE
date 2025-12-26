import React, { useState, useEffect } from 'react';
import { useKeycloak } from './keycloakContext';

function AdminInventory({ apiUrl = 'http://localhost:3004' }) {
  const { getToken, getUserInfo } = useKeycloak();
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // Form states
  const [newProduct, setNewProduct] = useState({
    sku: '',
    name: '',
    price: '',
    quantity: ''
  });

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiUrl}/inventory/search?q=`);
      const data = await res.json();
      setInventory(data);
    } catch (err) {
      console.error('Failed to load inventory:', err);
      showMessage('Failed to load inventory', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text, type = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(''), 3000);
  };

  // Add new product
  const handleAddProduct = async (e) => {
    e.preventDefault();
    
    if (!newProduct.sku || !newProduct.name || !newProduct.price || !newProduct.quantity) {
      showMessage('All fields are required', 'error');
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/inventory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          sku: newProduct.sku,
          name: newProduct.name,
          price: parseFloat(newProduct.price),
          quantity: parseInt(newProduct.quantity)
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to add product');
      }

      showMessage('Product added successfully!', 'success');
      setNewProduct({ sku: '', name: '', price: '', quantity: '' });
      setShowAddForm(false);
      loadInventory();
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  // Update product details
  const handleUpdateProduct = async (sku, updates) => {
    try {
      const res = await fetch(`${apiUrl}/inventory/${sku}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(updates)
      });

      if (!res.ok) {
        throw new Error('Failed to update product');
      }

      showMessage('Product updated successfully!', 'success');
      setEditingItem(null);
      loadInventory();
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  // Add stock
  const handleAddStock = async (sku, quantity) => {
    try {
      const res = await fetch(`${apiUrl}/inventory/${sku}/add-stock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ quantity: parseInt(quantity) })
      });

      if (!res.ok) {
        throw new Error('Failed to add stock');
      }

      showMessage(`Added ${quantity} units to stock`, 'success');
      loadInventory();
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  // Remove stock
  const handleRemoveStock = async (sku, quantity) => {
    try {
      const res = await fetch(`${apiUrl}/inventory/${sku}/remove-stock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ quantity: parseInt(quantity) })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to remove stock');
      }

      showMessage(`Removed ${quantity} units from stock`, 'success');
      loadInventory();
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  // Delete product
  const handleDeleteProduct = async (sku, name) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/inventory/${sku}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      if (!res.ok) {
        throw new Error('Failed to delete product');
      }

      showMessage('Product deleted successfully!', 'success');
      loadInventory();
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const StockControls = ({ item }) => {
    const [stockQty, setStockQty] = useState(10);

    return (
      <div className="stock-controls">
        <input
          type="number"
          value={stockQty}
          onChange={(e) => setStockQty(e.target.value)}
          min="1"
          className="stock-input"
        />
        <button
          className="btn btn-sm btn-success"
          onClick={() => handleAddStock(item.sku, stockQty)}
        >
          + Add
        </button>
        <button
          className="btn btn-sm btn-warning"
          onClick={() => handleRemoveStock(item.sku, stockQty)}
        >
          - Remove
        </button>
      </div>
    );
  };

  const EditForm = ({ item, onSave, onCancel }) => {
    const [formData, setFormData] = useState({
      name: item.name,
      price: item.price,
      quantity: item.quantity
    });

    return (
      <tr className="edit-row">
        <td>{item.sku}</td>
        <td>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="form-input"
          />
        </td>
        <td>
          <input
            type="number"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            step="0.01"
            className="form-input"
          />
        </td>
        <td>
          <input
            type="number"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
            className="form-input"
          />
        </td>
        <td>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => onSave(item.sku, formData)}
          >
            Save
          </button>
          <button
            className="btn btn-sm btn-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
        </td>
      </tr>
    );
  };

  if (loading) {
    return <div className="loading">Loading inventory...</div>;
  }

  return (
    <div className="admin-inventory">
      <div className="admin-header">
        <h2>🔧 Admin Inventory Management</h2>
        <button
          className="btn btn-primary"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Cancel' : '+ Add New Product'}
        </button>
      </div>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      {showAddForm && (
        <div className="add-product-form">
          <h3>Add New Product</h3>
          <form onSubmit={handleAddProduct}>
            <div className="form-row">
              <input
                type="text"
                placeholder="SKU (e.g., LAPTOP-001)"
                value={newProduct.sku}
                onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                className="form-input"
                required
              />
              <input
                type="text"
                placeholder="Product Name"
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                className="form-input"
                required
              />
            </div>
            <div className="form-row">
              <input
                type="number"
                placeholder="Price"
                value={newProduct.price}
                onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                step="0.01"
                min="0"
                className="form-input"
                required
              />
              <input
                type="number"
                placeholder="Initial Quantity"
                value={newProduct.quantity}
                onChange={(e) => setNewProduct({ ...newProduct, quantity: e.target.value })}
                min="0"
                className="form-input"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Add Product
            </button>
          </form>
        </div>
      )}

      <div className="inventory-table-container">
        <table className="inventory-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Name</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((item) => (
              editingItem === item.sku ? (
                <EditForm
                  key={item.sku}
                  item={item}
                  onSave={handleUpdateProduct}
                  onCancel={() => setEditingItem(null)}
                />
              ) : (
                <tr key={item.sku}>
                  <td className="sku-col">{item.sku}</td>
                  <td>{item.name}</td>
                  <td>${parseFloat(item.price).toFixed(2)}</td>
                  <td>
                    <span className={item.quantity > 10 ? 'stock-good' : 'stock-low'}>
                      {item.quantity} units
                    </span>
                  </td>
                  <td className="actions-col">
                    <StockControls item={item} />
                    <div className="action-buttons">
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => setEditingItem(item.sku)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDeleteProduct(item.sku, item.name)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>

      {inventory.length === 0 && (
        <div className="no-inventory">
          No products in inventory. Add your first product above!
        </div>
      )}
    </div>
  );
}

export default AdminInventory;
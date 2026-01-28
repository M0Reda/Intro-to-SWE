# Marketplace

A full-stack e-commerce platform built with microservices architecture, featuring real-time inventory management, secure authentication, and integrated payment processing.

## 🌟 Features

- **User Authentication**: Secure login and registration using Keycloak OAuth2
- **Product Browse & Search**: Search and filter through available inventory
- **Shopping Cart**: Real-time cart management with stock validation
- **Order Management**: Complete order workflow from cart to payment
- **Payment Processing**: Integrated PayPal payment gateway (sandbox mode)
- **Cash on Delivery**: Alternative payment option for customers
- **Admin Dashboard**: 
  - Inventory management (add, edit, delete products)
  - Stock control (add/remove inventory)
  - View all orders across users
  - Order cancellation and refund processing
- **Event-Driven Architecture**: Asynchronous communication between services using RabbitMQ
- **Real-time Updates**: Automatic inventory updates after orders

## 🏗️ Architecture

The application follows a microservices architecture with the following services:

- **Frontend**: React-based user interface with Keycloak integration
- **Orders Service**: Handles order creation, completion, and cancellation
- **Inventory Service**: Manages product stock and availability
- **Cart Service**: Manages user shopping carts with stock validation
- **Payments Service**: Integrates with PayPal for payment processing
- **Message Broker**: RabbitMQ for event-driven communication
- **Authentication**: Keycloak for user management and SSO
- **API Gateway**: Traefik for routing and load balancing

## 🛠️ Tech Stack

**Frontend:**
- React 18
- Vite
- Keycloak-js

**Backend:**
- Node.js
- Express.js
- PostgreSQL
- RabbitMQ (AMQP)

**Infrastructure:**
- Docker & Docker Compose
- Traefik (Reverse Proxy)
- Keycloak (Identity Management)

**External Services:**
- PayPal Checkout SDK

## 📋 Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ (for local development)
- PayPal Sandbox account (optional, for real PayPal testing)

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/marketplace.git
cd marketplace
```

### 2. Start all services with Docker Compose

```bash
docker-compose up -d
```

This will start all services including:
- PostgreSQL database
- RabbitMQ message broker
- Keycloak authentication server
- All microservices (orders, inventory, cart, payments)
- Frontend application

### 3. Access the application

- **Frontend**: http://localhost:3001 or http://app.localhost
- **Keycloak Admin**: http://localhost:8081 (admin/admin)
- **RabbitMQ Management**: http://localhost:15672 (guest/guest)
- **Traefik Dashboard**: http://localhost:8080

### 4. Default User Accounts

**Regular User:**
- Username: `test`
- Password: `test`

**Admin User:**
- Username: `admin`
- Password: `admin`

## 📱 Usage

### For Customers:

1. **Login** using the test account or register a new account
2. **Browse Products** from the inventory
3. **Add to Cart** - items are validated against available stock
4. **Checkout** - choose between PayPal or Cash on Delivery
5. **View Orders** - track your order history
6. **Cancel Orders** - cancel orders and restore inventory

### For Admins:

1. **Login** with admin account
2. **Manage Inventory** tab:
   - Add new products
   - Update product details
   - Add/remove stock
   - Delete products
3. **View All Orders** tab:
   - See orders from all users
   - Cancel any order
   - Monitor order status

## 🔧 Configuration

### Environment Variables

Each service can be configured through environment variables in `docker-compose.yml`:

**Database:**
- `DATABASE_URL`: PostgreSQL connection string
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`

**RabbitMQ:**
- `RABBITMQ_URL`: AMQP connection string

**Keycloak:**
- `KEYCLOAK_URL`: Keycloak server URL
- `KEYCLOAK_REALM`: Realm name (default: marketplace)

**PayPal:**
- `PAYPAL_CLIENT_ID`: Your PayPal app client ID
- `PAYPAL_CLIENT_SECRET`: Your PayPal app secret
- `PAYPAL_MODE`: sandbox or live

### Network Access

The application supports two access modes:

**Direct Port Access:**
```
Frontend: http://localhost:3001
Orders: http://localhost:3000
Inventory: http://localhost:3004
Cart: http://localhost:3005
Payments: http://localhost:3002
```

**Traefik Routing (*.localhost):**
```
Frontend: http://app.localhost
Orders: http://api.localhost
Inventory: http://inventory.localhost
Cart: http://cart.localhost
Payments: http://payments.localhost
```

## 🔄 Event Flow

The application uses event-driven architecture for key operations:

### Order Completion Flow:
1. User completes payment
2. Orders service publishes `order.completed` event
3. Inventory service consumes event and deducts stock
4. Order status updated to "completed"

### Order Cancellation Flow:
1. User/Admin cancels order
2. Orders service publishes `order.cancelled` event
3. Inventory service consumes event and restores stock
4. Order status updated to "cancelled"

## 📁 Project Structure

```
marketplace/
├── docker-compose.yml          # Container orchestration
├── migrations/                 # Database schema
│   ├── 001-create-orders.sql
│   └── 002-seed-inventory.sql
├── keycloak/
│   └── realm-export.json      # Keycloak configuration
├── services/
│   ├── frontend/              # React application
│   ├── orders/                # Orders microservice
│   ├── inventory/             # Inventory microservice
│   ├── cart/                  # Cart microservice
│   └── payments/              # Payments microservice
└── shared/                    # Shared utilities
```

## 🧪 Testing

### Test Payment Processing

**Mock PayPal:**
- Use the "Mock PayPal" option during checkout
- Simulates payment flow without real credentials
- No actual charges

**Real PayPal Sandbox:**
1. Get credentials from [PayPal Developer Dashboard](https://developer.paypal.com)
2. Choose "Real PayPal" during checkout
3. Enter your sandbox Client ID and Secret
4. Complete payment in PayPal sandbox environment

### Test User Flows

1. **Shopping Flow**: Browse → Add to Cart → Checkout → Pay
2. **Stock Validation**: Try adding more items than available stock
3. **Order Cancellation**: Cancel an order and verify inventory restoration
4. **Admin Functions**: Add products, modify stock, view all orders

## 🐛 Troubleshooting

### Services won't start
```bash
docker-compose down -v
docker-compose up -d
```

### Database connection errors
Wait 30 seconds for PostgreSQL to initialize on first run.

### Keycloak authentication fails
Ensure Keycloak is fully started (can take 1-2 minutes on first run).

### RabbitMQ events not processing
Check RabbitMQ management console at http://localhost:15672 for queue status.

## 📝 API Documentation

### Orders Service (Port 3000)

```
GET    /orders              # Get user's orders
GET    /orders/all          # Get all orders (admin)
GET    /orders/:id          # Get specific order
POST   /orders              # Create new order
POST   /orders/:id/complete # Complete order with payment
POST   /orders/:id/confirm-cod # Confirm cash on delivery
POST   /orders/:id/cancel   # Cancel order
```

### Inventory Service (Port 3004)

```
GET    /inventory/search    # Search products
GET    /inventory/:sku      # Get product details
POST   /inventory           # Add product (admin)
PUT    /inventory/:sku      # Update product (admin)
DELETE /inventory/:sku      # Delete product (admin)
POST   /inventory/:sku/add-stock    # Add stock (admin)
POST   /inventory/:sku/remove-stock # Remove stock (admin)
```

### Cart Service (Port 3005)

```
GET    /cart               # Get user's cart
POST   /cart               # Add item to cart
PUT    /cart/:sku          # Update item quantity
DELETE /cart/:sku          # Remove item from cart
DELETE /cart               # Clear entire cart
```

### Payments Service (Port 3002)

```
POST   /payments/create-with-credentials  # Create PayPal order
POST   /payments/:id/status               # Check order status
POST   /payments/:id/capture              # Capture payment
```


## 🙏 Acknowledgments

- Keycloak for authentication
- PayPal for payment processing
- RabbitMQ for message brokering
- Traefik for reverse proxy

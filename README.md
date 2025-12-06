# E-Commerce Analytics Platform

A powerful multi-tenant analytics dashboard for Shopify stores, providing real-time insights into sales, customers, and inventory data.

## Features

- 📊 **Real-time Dashboard** - Live analytics with interactive charts
- 🛒 **Order Management** - Track and analyze all store orders
- 👥 **Customer Insights** - Understand customer behavior and trends
- 📦 **Inventory Tracking** - Monitor product stock levels
- 🔐 **Multi-tenant Architecture** - Secure data isolation per store
- 🔄 **Auto Sync** - Automatic data synchronization with Shopify

## Tech Stack

### Backend
- Node.js with Express.js
- TypeScript for type safety
- Prisma ORM with PostgreSQL
- JWT Authentication
- RESTful API architecture

### Frontend
- Next.js 14 with App Router
- React 18 with TypeScript
- TailwindCSS for styling
- Recharts for data visualization
- Responsive design

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Shopify Partner account (for API access)

### Installation

1. Clone the repository
```bash
git clone <your-repo-url>
cd shopify-insights-platform
```

2. Install backend dependencies
```bash
cd backend
npm install
```

3. Configure environment variables
```bash
cp .env.example .env
# Edit .env with your database and Shopify credentials
# Make sure to set JWT_SECRET for authentication security
```

4. Setup database
```bash
npx prisma migrate dev
npx prisma db seed
```

5. Install frontend dependencies
```bash
cd ../frontend
npm install
```

6. Run the application
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## Demo Credentials

- **Email:** demo@example.com
- **Password:** demo123

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User authentication |
| POST | `/api/auth/register` | User registration |
| GET | `/api/dashboard/stats` | Dashboard statistics |
| GET | `/api/orders` | List all orders |
| GET | `/api/customers` | List all customers |
| GET | `/api/products` | List all products |

## License

MIT License - See [LICENSE](LICENSE) for details.

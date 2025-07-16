# 🚀 Block Country – Technical Project Overview

**Block Country** is a full-stack Shopify app built with modern web technologies. It features a robust Node.js backend, React frontend, PostgreSQL database, comprehensive blocking middleware, and analytics tracking.

---

## 🛠️ Tech Stack

### Backend
- **Node.js & Express** – RESTful API server
- **PostgreSQL** – Primary database with session storage
- **Shopify API Integration** – OAuth, webhooks, GraphQL/REST APIs
- **Advanced Middleware** – IP detection, bot analysis, blocking logic

### Frontend
- **React 18** – Modern component-based UI
- **Shopify Polaris** – Design system and components
- **React Router** – Client-side routing
- **React Query** – Data fetching and caching
- **Vite** – Fast build tool and dev server

### Infrastructure
- **Theme Extensions** – Shopify 2.0 app blocks
- **App Proxy** – Storefront API endpoints
- **Session Management** – PostgreSQL-based storage
- **Real-time Analytics** – Event tracking and reporting

---

## 🧱 Key Architecture Components

### 📊 Database Schema (9 Tables)
- `shops`
- `blocked_countries`
- `blocked_ips`
- `bot_settings`
- `content_protection_settings`
- `user_analytics`
- `performance_analytics`
- `country_settings`
- `ip_settings`

### 📡 API Routes
- `/api/blocked-countries` – Country management CRUD
- `/api/blocked-ips` – IP management with validation
- `/api/bot-management` – Bot rules and analytics
- `/api/content-protection` – Protection settings
- `/api/analytics/*` – Comprehensive analytics endpoints
- `/data/info/*` – Public storefront checking APIs

### 🛡️ Middleware Systems
- **Enhanced Blocking Middleware** – Multi-layer access control
- **IP Detection Utilities** – 10+ IP extraction methods
- **User Agent Analysis** – Bot detection & device fingerprinting
- **Session Tracking** – Accurate visitor analytics

---

## ⚡ Advanced Features

### 🔍 IP Detection
- Cloudflare, NGINX, proxy header parsing
- IPv4/IPv6 normalization
- Private/public IP classification
- CIDR range matching for bulk blocking

### 🤖 Bot Analysis
- Search engine bot whitelisting
- Social media crawler detection
- SEO tool identification
- Headless browser detection

### 📊 Analytics Engine
- Session-based visitor tracking
- Real-time metrics (updates every 30 seconds)
- Performance monitoring integration
- Geographic and device analytics

### 🛡️ Content Protection
- Dynamic script generation
- Multi-layer CSS + JS protection
- Mobile-optimized
- Developer tools detection

---

## 📁 File Structure

```shell
├── web/                          # Backend application
│   ├── routes/                   # API endpoint handlers
│   ├── middleware/               # Request processing layers  
│   ├── utils/                    # Utility functions
│   └── frontend/                 # React application
│       ├── pages/                # Route components
│       ├── components/           # Reusable UI components
│       └── utils/                # Frontend utilities
├── extensions/blocker-country/   # Shopify theme extension
└── Database migration files
```
---

## 🧪 Development Setup

```shell
npm install         # Install dependencies
npm run dev         # Start development server
npm run build       # Build for production
node db-table.js    # Initialize database
```

## Environment Requirements
- Node.js 16+
- PostgreSQL
- Shopify Partner Account
- Ngrok or similar tunneling tool for development
# 🍽️ Bistro Moderne - Production-Ready QR Food Ordering System

A high-performance, real-time QR code food ordering web application designed for restaurants, bars, and bistros. Customers scan a table QR code to browse an interactive visual menu, customize dishes, add to cart, and checkout. Orders are dispatched instantly via **WebSockets** to the kitchen's live Kanban board and sent directly to a **Telegram Bot** alert channel for restaurant staff.

---

## 🏗️ Architecture Overview

```
                        [ Customer Phone ]
                                 │
                     (Scans QR Code at Table)
                                 │
                                 ▼
                     [ Next.js 14 Frontend ]
            (App Router, TypeScript, Tailwind, Lucide)
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                     ▼
      [ REST API Requests ]                [ WebSockets Channel ]
      (Checkout, Menu, QR)                 (Live Order Tracking)
              │                                     │
              └──────────────────┬──────────────────┘
                                 │
                                 ▼
                     [ FastAPI Async Backend ]
                 (Python 3.11+, Pydantic, JWT)
                                 │
                 ┌───────────────┼───────────────┐
                 ▼               ▼               ▼
          [ PostgreSQL ]     [ Redis ]     [ Telegram Bot ]
          (SQLAlchemy 2.0)  (Cache/Queue)  (Staff Group Alerts)
                 ▲
                 │ (Live WebSocket Updates)
                 │
       [ Kitchen Admin Dashboard ]
     (Live Kanban, Menu CRUD, QR Print, Analytics)
```

---

## 🌟 Key Features

### 📱 1. Hybrid Customer Experience (Dine-In & Online Home Delivery)
- **Table QR Code Scan (Dine-In)**: Scanned URLs encode table numbers and cryptographic session tokens (e.g. `https://yourshop.com/menu?table=12&token=...`) to prevent URL spoofing.
- **Online Home Delivery Mode**: Direct home ordering (`/menu?mode=delivery`) with auto-address capture, customer profiles, and estimated dispatch countdowns.
- **Customer Accounts & Order History**: Sign up / Log in to save delivery addresses, phone numbers, and view past orders with live tracking links.
- **Interactive Visual Menu**: Category tabs, instant search filtering, dietary tags (Vegetarian 🥦, Spicy 🔥, Chef's Special ⭐).
- **Customization Modal**: Choose meat doneness, spice levels, add-on extras (Bacon, Extra Truffle Mayo), and special kitchen instructions with real-time price calculation.
- **Persistent Floating Cart**: Add items, adjust quantities, toggle between dine-in table or delivery destination, select staff tips (0%, 10%, 15%, 20%), and pay with demo card, KHQR/ABA, or cash.
- **Live Order Tracking (`/orders/[id]`)**: Real-time status stepper (`Pending` ➔ `In Kitchen` ➔ `Ready / Out for Delivery` ➔ `Completed`) synchronized live via WebSockets!

### 👨‍🍳 2. Kitchen & Admin Dashboard
- **Live Kanban Order Board (`/admin/dashboard`)**:
  - Four status columns: **New Orders (Pending)**, **In Kitchen (Cooking)**, **Ready to Serve / Out for Delivery**, and **Completed (Served)**.
  - Distinct badges and indicators separating **Dine-In Tables** vs **Online Delivery Orders** with customer delivery addresses and phone numbers.
  - Real-time WebSocket sync: New orders pop into the board immediately with an audio chime and visual ping alert without refreshing.
  - One-click status progression buttons (`Start Cooking`, `Mark Ready`, `Mark Served / Delivered`).
  - Slide-over order inspector with item lines, customizations, customer contacts, and special requests.
- **Menu Manager (`/admin/menu`)**:
  - Full CRUD: Add new dishes, edit prices, descriptions, and categories.
  - Instant **"Out of Stock"** toggle switch that immediately disables ordering for that dish across customer phones.
- **Table & Printable QR Generator (`/admin/tables`)**:
  - Manage dining tables and seating capacity.
  - Generates high-resolution, printable table QR stand cards with restaurant branding and table numbers ready for table placement.
- **Sales & Dining Analytics (`/admin/analytics`)**:
  - Real-time revenue metrics: Total Revenue, Today's Sales, Average Order Value (AOV), and Active Kitchen Orders.
  - Interactive **Recharts 7-Day Revenue Trend** area chart.
  - Top 5 best-selling dishes leaderboard and dining table activity breakdown.

### 🤖 3. Staff Telegram Bot Alerts
- Instant notification dispatched to staff Telegram group upon order placement.
- Tailored formatting: Shows whether order is **Dine-In Table #** or **🏠 Online Home Delivery** with recipient phone & street address, item customizations, tax, tip, subtotal, and direct admin dashboard link.

---

## ⚡ Quickstart

### Option A: Using Docker Compose (Recommended)

Make sure Docker and Docker Compose are installed:

```bash
# 1. Clone repository
git clone https://github.com/yourusername/modern-food-service.git
cd modern-food-service

# 2. Copy and configure environment variables
cp .env.example .env

# 3. Launch the full stack (PostgreSQL, Redis, FastAPI, Next.js)
docker-compose up -d --build
```

- **Customer Menu**: [http://localhost:3000](http://localhost:3000)
- **Kitchen Admin**: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)
- **FastAPI Interactive Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Option B: Local Development (Without Docker)

#### 1. Backend (FastAPI + SQLite / PostgreSQL)

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# macOS / Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server (models and seed data automatically initialize on launch!)
uvicorn app.main:app --reload --port 8000
```

The backend is now running at `http://localhost:8000`.

#### 2. Frontend (Next.js 14 App Router)

```bash
cd frontend

# Install npm packages
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Default Credentials & Sample Tables

| Role | Email / ID | Password | Notes |
| :--- | :--- | :--- | :--- |
| **Admin / Chef** | `admin@restaurant.com` | `admin123` | Quick "Use Demo Account" button on login page |
| **Tables 1 to 12** | Table `1` through `12` | *N/A* | Pre-configured with active QR codes |

---

## 🤖 Telegram Bot Configuration

1. Open Telegram and search for `@BotFather`.
2. Send `/newbot` and follow the instructions to get your **HTTP API Token** (e.g. `7123456789:AAHqj...`).
3. Create a restaurant staff group, add your bot to the group as an admin.
4. Get your chat ID (e.g. using `@userinfobot` or `@GetIDsBot`).
5. Add to `.env` or `backend/.env`:
   ```env
   TELEGRAM_BOT_TOKEN=your_token_here
   TELEGRAM_ADMIN_CHAT_ID=-1001234567890
   ```
6. When an order is placed, an immediate notification is sent:

```text
🍽️ NEW ORDER RECEIVED!
━━━━━━━━━━━━━━━━━━━━
🏷️ Order: ORD-2345-891
🪑 Table: Table #3
👤 Customer: Sarah Jenkins
💳 Payment: Card (PAID)
━━━━━━━━━━━━━━━━━━━━
Order Items:
• 2x The Truffle Wagyu Burger — $37.00
   ↳ Meat Doneness: Medium
   ↳ Crispy Bacon, Extra Truffle Mayo
• 1x Crispy Truffle Parmesan Fries — $8.50
━━━━━━━━━━━━━━━━━━━━
💵 Subtotal: $45.50
🧾 Tax: $3.64
🪙 Tip: $4.00
💰 TOTAL: $53.14

📝 Special Requests: Extra napkins please!
⏱️ Time: 2026-09-15 00:30:00 UTC
━━━━━━━━━━━━━━━━━━━━
🔗 Open Admin Dashboard: http://localhost:3000/admin/orders
```

---

## 🌐 API Endpoints Reference

### Public (Customer)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/tables/{table_id}/validate` | Validates table and returns signed session token |
| `GET` | `/api/v1/tables/{table_id}/qr` | Returns Base64 QR code and scannable link |
| `GET` | `/api/v1/menu` | Returns active categories and dishes (cached) |
| `POST` | `/api/v1/orders` | Checkout cart, compute tax/tip, broadcast WS event |
| `GET` | `/api/v1/orders/{id}` | Real-time order details and prep countdown |
| `WS` | `/api/v1/ws/orders/{id}` | WebSocket channel for customer live order tracker |

### Protected (Kitchen & Staff)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | Admin login (returns JWT token) |
| `GET` | `/api/v1/auth/me` | Current staff profile |
| `GET` | `/api/v1/orders` | Filter orders by status (`pending`, `preparing`, `ready`, `served`) |
| `PATCH`| `/api/v1/orders/{id}/status` | Advance order status with instant WS broadcast |
| `GET` | `/api/v1/menu/admin` | List all menu items including inactive |
| `POST` | `/api/v1/menu/items` | Add new menu item |
| `PUT` | `/api/v1/menu/items/{id}` | Update menu item details |
| `PATCH`| `/api/v1/menu/items/{id}/availability` | Instant "Out of Stock" toggle |
| `DELETE`| `/api/v1/menu/items/{id}` | Delete menu item |
| `GET` | `/api/v1/tables` | List restaurant tables |
| `POST` | `/api/v1/tables` | Add new dining table |
| `GET` | `/api/v1/analytics/sales` | Sales KPIs, 7-day revenue chart, top items |
| `WS` | `/api/v1/ws/admin` | WebSocket channel for live kitchen Kanban board |

---

## 🚀 Production Deployment Guide

### 1. Frontend (Next.js on Vercel)
1. Push repository to GitHub.
2. Import project into [Vercel](https://vercel.com).
3. Set **Root Directory** to `frontend`.
4. Add Environment Variable:
   - `NEXT_PUBLIC_API_URL`: `https://your-backend-api.com`
5. Click **Deploy**.

### 2. Backend (FastAPI on Render, Railway, or VPS)
#### Deploy on Render / Railway:
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:$PORT`
- Set Environment Variables:
  - `DATABASE_URL`: `postgresql+asyncpg://user:pass@host:5432/dbname`
  - `SECRET_KEY`: `strong-random-production-key`
  - `FRONTEND_URL`: `https://your-frontend-domain.vercel.app`
  - `TELEGRAM_BOT_TOKEN`: `your-bot-token`
  - `TELEGRAM_ADMIN_CHAT_ID`: `your-chat-id`

#### Self-Hosted with Nginx + Systemd:
A sample Nginx reverse proxy configuration with WebSocket support:
```nginx
server {
    listen 80;
    server_name api.yourshop.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 🛡️ Security & Reliability
- **Signed Table Tokens**: Table IDs are verified with cryptographic signatures to prevent customers from guessing other table URLs.
- **Async Database Connection Pooling**: Handled via SQLAlchemy 2.0 async engine with pre-ping connections.
- **Input Validation**: Pydantic v2 validation and type safety on all input schemas.
- **Password Protection**: BCrypt salted password hashing and JWT access tokens.

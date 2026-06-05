# 🌊 Zhuu Hosting

**Hosting Premium, Otomatis, Andal** — Pterodactyl Panel automated reseller hosting platform with a deep ocean / bioluminescent theme.

---

## 📋 Features

- **Multi-auth**: Google, GitHub, Discord OAuth + Email/Password
- **Auto-deploy**: Orders automatically provision servers on Pterodactyl Panel via API
- **Reseller System**: Full reseller panel with sub-user management
- **Admin Panel**: Order management, user management, confirm/reject orders
- **Owner Secret Panel**: `/zhuu-owner-secret-2077` — Full system configuration
- **Beautiful UI**: Deep ocean glassmorphism theme with bubble animations and wave effects
- **Payment Support**: QRIS, Dana, GoPay, OVO, ShopeePay, Bank Transfer
- **JSON DB**: No external DB needed — all data stored in `db.json`

---

## 🚀 Quick Start (Local)

### 1. Clone & Install

```bash
git clone <repo-url>
cd zhuu-hosting
npm install
```

### 2. Setup Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials (see below).

### 3. Run

```bash
node server.js
# or
npm start
```

App runs at `http://localhost:3000`

---

## 🔑 Environment Variables

Create `.env` file with:

```env
# OAuth Credentials
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret

# Session
SESSION_SECRET=zhuu_hosting_secret_2077

# App URL (your Vercel domain after deploy)
BASE_URL=https://your-app.vercel.app

# Owner email (hardcoded owner access)
OWNER_EMAIL=zhuusite@gmail.com
```

---

## 🔐 Getting OAuth Credentials

### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project → APIs & Services → Credentials
3. Create OAuth 2.0 Client ID
4. Authorized redirect URIs: `https://your-domain.vercel.app/auth/google/callback`
5. Copy Client ID and Client Secret to `.env`

### GitHub OAuth
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. New OAuth App
3. Homepage URL: `https://your-domain.vercel.app`
4. Authorization callback URL: `https://your-domain.vercel.app/auth/github/callback`
5. Copy Client ID and Client Secret to `.env`

### Discord OAuth
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. New Application → OAuth2 tab
3. Add redirect: `https://your-domain.vercel.app/auth/discord/callback`
4. Scopes: `identify`, `email`
5. Copy Client ID and Client Secret to `.env`

---

## ☁️ Deploy to Vercel

### Method 1: Vercel CLI

```bash
npm install -g vercel
vercel login
vercel --prod
```

When prompted, add all environment variables.

### Method 2: Vercel Dashboard

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import your GitHub repo
4. Add all environment variables in Project Settings
5. Deploy!

### Important: Set Environment Variables in Vercel

In Vercel Dashboard → Project → Settings → Environment Variables, add:
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`
- `SESSION_SECRET`
- `BASE_URL` = `https://your-actual-vercel-domain.vercel.app`
- `OWNER_EMAIL` = your owner email

**Update OAuth callback URLs** in each provider's dashboard to use your Vercel domain.

---

## 👑 Owner Panel

**URL**: `/zhuu-owner-secret-2077`

This page is not linked anywhere on the site for security.

**PIN**: `ZHUU2077`

### What you can configure in Owner Panel:
- **Pterodactyl API**: Application API URL & Key, Client API URL & Key, Node/Nest/Egg/Allocation IDs
- **Pricing**: Price per RAM GB, CPU%, Disk GB, Database slot, Backup slot, Reseller multiplier
- **Payment**: QRIS image, Dana/GoPay/OVO/ShopeePay numbers, Bank details
- **Branding**: Site name, tagline, WhatsApp number, logo URL
- **User Management**: Change roles, ban/unban, reset passwords, delete accounts
- **Order Management**: Confirm, reject, delete orders with optional manual server ID

---

## 🦕 Pterodactyl Setup

After login to Owner Panel:

1. Go to **Pterodactyl API** tab
2. Fill in:
   - **Application API URL**: Your panel domain (e.g. `https://panel.example.com`)
   - **Application API Key**: Generate in Pterodactyl → Admin → API → Create record
   - **Node ID**: ID of the node to deploy servers on
   - **Nest ID**: ID of the nest (e.g. Minecraft = 1)
   - **Egg ID**: ID of the specific egg (e.g. Paper = 15)
   - **Allocation ID**: Default allocation ID for new servers
3. Click **Test Koneksi** to verify
4. Save

---

## 📁 File Structure

```
zhuu-hosting/
├── server.js              # Main Express server + Passport config
├── vercel.json            # Vercel deployment config
├── .env.example           # Environment variables template
├── package.json           # Dependencies
├── db.json                # Auto-created JSON database
├── config.json            # Auto-created system config
├── uploads/               # Payment proofs + QRIS images
├── sessions/              # Session files (local dev only)
├── routes/
│   ├── auth.js            # OAuth + local auth routes
│   ├── orders.js          # Order CRUD + confirm/reject
│   ├── admin.js           # Admin routes
│   ├── owner.js           # Owner secret routes
│   └── pterodactyl.js     # Pterodactyl API integration
├── middleware/
│   └── authMiddleware.js  # requireLogin/Admin/Owner middleware
└── public/
    ├── index.html         # Landing page
    ├── login.html         # Login page
    ├── register.html      # Register page
    ├── order.html         # Order form (3 steps)
    ├── dashboard.html     # User dashboard
    ├── admin.html         # Admin panel
    ├── owner.html         # Owner secret panel
    ├── css/
    │   └── style.css      # Full ocean theme CSS
    └── js/
        ├── main.js        # Shared utilities
        ├── order.js       # Order form logic
        ├── dashboard.js   # Dashboard logic
        ├── admin.js       # Admin panel logic
        └── owner.js       # Owner panel logic
```

---

## 🎨 Theme

Deep ocean / underwater bioluminescent theme:
- Color palette: deep navy (`#060d1f`) to teal (`#00d4ff`) to aqua (`#00ffcc`)
- Animated CSS bubbles (25 bubbles floating up)
- 3-layer SVG wave animation at page bottom
- 6 bioluminescent glow orbs drifting slowly
- Glassmorphism cards with backdrop-filter blur
- Fonts: Cinzel Decorative (headings), Cinzel (subheadings), Exo 2 (body)

---

## 📝 Notes

- **Session storage**: Local dev uses file-based sessions (`session-file-store`). Vercel is serverless — sessions reset on each function invocation. For production, consider upgrading to Redis/database sessions.
- **File uploads**: `multer` stores files locally. On Vercel, use external storage (Cloudinary, S3) for persistent file uploads since Vercel's filesystem is ephemeral.
- **db.json**: Works great for development and low-traffic production. For high traffic, migrate to PostgreSQL or MongoDB.

---

## 🆘 Support

Contact: Owner WhatsApp (configured in Owner Panel)

© 2024 Zhuu Hosting. All rights reserved.


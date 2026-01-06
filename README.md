# SEO Insights - React Frontend

This is the React version of the SEO Insights application. It has been converted from the original HTML/CSS/JavaScript version while maintaining all functionality and backend integration.

## Features

- Landing page with hero section, features, and pricing
- User authentication (Login/Register)
- Dashboard with keyword analysis, content gaps, and AI suggestions
- **SEO Audit Pipeline** - Automated SEO analysis with rule-based checks
- Reports page
- Settings page with multiple sections
- All backend API calls preserved exactly as in the original

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas cloud)

## Installation

1. Install dependencies:
```bash
npm install
```

## Running the Application

### Step 1: Start MongoDB

Make sure MongoDB is running on your system:
- **Local MongoDB**: Should be running on `mongodb://127.0.0.1:27017`
- **MongoDB Atlas**: Use your cloud connection string in `.env` file

### Step 2: Start Backend Server

Open a terminal and run:
```bash
npm run server
```

You should see:
```
MongoDB connected
Server running on http://localhost:5000
```

### Step 3: Start Frontend (React)

Open another terminal and run:
```bash
npm start
```

The React app will open in your browser at `http://localhost:3000`

## Quick Start (Both Servers)

**Terminal 1 - Backend:**
```bash
npm run server
```

**Terminal 2 - Frontend:**
```bash
npm start
```

- Backend API: http://localhost:5000
- React Frontend: http://localhost:3000

## Environment Variables (Optional)

Create a `.env` file in the root directory:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/seo_tool
JWT_SECRET=your_secret_key_here
```

If you don't create `.env`, defaults will be used (see `server.js`).

## Troubleshooting

### MongoDB Connection Error
- Make sure MongoDB is installed and running
- Check connection string in `.env` or use default: `mongodb://127.0.0.1:27017/seo_tool`
- See `BACKEND_SETUP.md` for detailed troubleshooting

### Port Already in Use
- Change PORT in `.env` file
- Or kill the process using the port

For more details, see `BACKEND_SETUP.md`

## Project Structure

```
src/
├── components/
│   ├── LandingPage.js      # Landing page with hero, features, pricing
│   ├── LoginModal.js       # Login modal component
│   ├── RegisterModal.js    # Registration modal component
│   ├── PlanModal.js        # Plan selection/payment modal
│   ├── AppContainer.js     # Main app container (dashboard wrapper)
│   ├── Navbar.js           # Navigation bar
│   ├── Dashboard.js        # Dashboard page with tabs
│   ├── Reports.js          # Reports page
│   ├── Settings.js         # Settings page
│   └── NotificationPanel.js # Notification panel
├── App.js                  # Main app component
├── index.js                # React entry point
└── index.css               # All styles from original HTML

public/
└── index.html              # HTML template
```

## Backend Integration

The app connects to your existing backend at `http://localhost:5000`:
- `/api/auth/login` - User login
- `/api/auth/register` - User registration
- `/api/analysis` - Save analysis input (requires auth token)
- `/api/seo-audit` - **NEW**: Perform automated SEO audit on URLs or HTML content
- `/api/seo-audit` (GET) - Get user's audit history
- `/api/seo-audit/:id` (GET) - Get specific audit details

All API calls are identical to the original HTML version.

### SEO Audit Pipeline

The SEO Audit Pipeline performs automated rule-based SEO analysis:
- Title tag analysis (length, presence)
- Meta description checks
- Heading structure (H1, H2)
- Image alt text validation
- Content length analysis
- Social media tags (Open Graph, Twitter Card)
- Generates SEO score (0-100) with grade (A-F)
- Provides actionable recommendations

**See `SEO_AUDIT_API.md` for complete API documentation.**

## Notes

- All functionality from the original HTML file has been preserved
- Same styling and design
- Same backend API endpoints
- React hooks used for state management
- Components are modular and reusable

## Building for Production

```bash
npm run build
```

This creates an optimized production build in the `build` folder.


# Backend Setup Guide

## Prerequisites

1. **Node.js** - Make sure you have Node.js installed (v14 or higher)
2. **MongoDB** - You need MongoDB running on your system

## Step 1: Install Dependencies

The backend dependencies are already included in the main `package.json`. Install them:

```bash
npm install
```

## Step 2: Setup MongoDB

### Option A: Local MongoDB (Recommended for Development)

1. **Install MongoDB** if you haven't already:
   - Download from: https://www.mongodb.com/try/download/community
   - Or use MongoDB Atlas (cloud): https://www.mongodb.com/cloud/atlas

2. **Start MongoDB**:
   - **Windows**: MongoDB should start automatically as a service, or run `mongod` from command prompt
   - **Mac/Linux**: Run `mongod` or `sudo systemctl start mongod`

3. **Verify MongoDB is running**:
   - MongoDB should be accessible at `mongodb://127.0.0.1:27017`

### Option B: MongoDB Atlas (Cloud)

1. Create a free account at https://www.mongodb.com/cloud/atlas
2. Create a cluster
3. Get your connection string
4. Create a `.env` file (see Step 3)

## Step 3: Environment Variables (Optional)

Create a `.env` file in the root directory (optional - defaults are provided):

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/seo_tool
JWT_SECRET=your_secret_key_here_change_in_production
```

**Note**: If you don't create a `.env` file, the server will use default values:
- PORT: 5000
- MONGO_URI: mongodb://127.0.0.1:27017/seo_tool
- JWT_SECRET: changeme_dev_secret

## Step 4: Run the Backend Server

```bash
npm run server
```

Or:

```bash
node server.js
```

You should see:
```
MongoDB connected
Server running on http://localhost:5000
```

## Step 5: Verify Backend is Running

Open your browser and go to: `http://localhost:5000`

You should see the HTML version of your app (or an error if MongoDB isn't connected).

## Troubleshooting

### MongoDB Connection Error

If you see `MongoDB connection error`:

1. **Check if MongoDB is running**:
   ```bash
   # Windows
   net start MongoDB
   
   # Mac/Linux
   sudo systemctl status mongod
   ```

2. **Check MongoDB connection string**:
   - Default: `mongodb://127.0.0.1:27017/seo_tool`
   - Make sure MongoDB is listening on port 27017

3. **Try connecting manually**:
   ```bash
   mongosh mongodb://127.0.0.1:27017/seo_tool
   ```

### Port Already in Use

If port 5000 is already in use:

1. Change the PORT in `.env` file
2. Or kill the process using port 5000:
   ```bash
   # Windows
   netstat -ano | findstr :5000
   taskkill /PID <PID> /F
   
   # Mac/Linux
   lsof -ti:5000 | xargs kill
   ```

## Running Both Frontend and Backend

### Terminal 1 - Backend:
```bash
npm run server
```

### Terminal 2 - Frontend:
```bash
npm start
```

- Backend: http://localhost:5000
- Frontend: http://localhost:3000

## API Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/analysis` - Save analysis input (requires auth token)

All endpoints return JSON responses.






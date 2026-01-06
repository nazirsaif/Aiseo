# SEO Audit Error Troubleshooting Guide

## Common Errors & Solutions

### 1. "Server error during SEO audit"

**Possible Causes:**

#### A. Axios Not Installed
**Solution:**
```bash
npm install axios
```

#### B. Service File Path Issue
**Check:**
- Make sure `services/seoAuditService.js` file exists
- Check if file path is correct in `server.js`:
  ```javascript
  const seoAuditService = require('./services/seoAuditService');
  ```

#### C. URL Fetch Failed
**Common reasons:**
- URL is not accessible (blocked, requires authentication)
- Network timeout
- Invalid URL format
- SSL certificate issues

**Solution:**
- Try a simple URL like `https://example.com`
- Check if URL is accessible in browser
- Try with `http://` instead of `https://`

#### D. MongoDB Connection Issue
**Check:**
- MongoDB is running
- Connection string is correct
- Database `seo_tool` exists

**Solution:**
```bash
# Check MongoDB
mongosh
use seo_tool
db.stats()
```

### 2. "Failed to fetch URL"

**Solutions:**
- Check internet connection
- Try different URL (e.g., `https://www.google.com`)
- Some sites block automated requests
- Check server console for detailed error

### 3. "SEO Audit Service not available"

**Solution:**
- Check if `services/seoAuditService.js` exists
- Check file permissions
- Restart server after creating service file

### 4. Module Not Found Error

**Solution:**
```bash
# Reinstall dependencies
npm install

# Check if axios is installed
npm list axios
```

## Debugging Steps

### Step 1: Check Server Console

Look at the terminal where `npm run server` is running. You should see detailed error messages:

```
SEO audit error: [actual error message]
Error stack: [stack trace]
```

### Step 2: Test Service File Directly

Create a test file `test-audit.js`:

```javascript
const seoAuditService = require('./services/seoAuditService');

async function test() {
  const result = await seoAuditService.performSEOAudit('https://example.com', null);
  console.log(JSON.stringify(result, null, 2));
}

test().catch(console.error);
```

Run:
```bash
node test-audit.js
```

### Step 3: Check Network Requests

Use Postman/Thunder Client to test API directly:

**POST** `http://localhost:5000/api/seo-audit`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json
```

**Body:**
```json
{
  "url": "https://example.com"
}
```

Check the response for detailed error message.

### Step 4: Verify File Structure

Make sure your project structure is:
```
fyp/
├── server.js
├── services/
│   └── seoAuditService.js
├── package.json
└── ...
```

## Quick Fixes

### Fix 1: Restart Server
```bash
# Stop server (Ctrl+C)
# Start again
npm run server
```

### Fix 2: Clear Node Cache
```bash
# Delete node_modules and reinstall
rm -rf node_modules
npm install
```

### Fix 3: Check Node Version
```bash
node --version
# Should be v14 or higher
```

### Fix 4: Test with HTML Instead of URL

If URL fetching fails, try with HTML content:

**POST** `/api/seo-audit`

```json
{
  "html": "<html><head><title>Test</title></head><body><h1>Hello</h1></body></html>"
}
```

## Common Error Messages

| Error Message | Cause | Solution |
|--------------|-------|----------|
| "Cannot find module 'axios'" | Axios not installed | `npm install axios` |
| "Cannot find module './services/seoAuditService'" | File path wrong | Check file exists |
| "Failed to fetch URL" | Network/URL issue | Try different URL |
| "MongoDB connection error" | MongoDB not running | Start MongoDB |
| "Invalid token" | Auth issue | Login again |

## Still Not Working?

1. **Check server logs** - Most detailed errors appear there
2. **Test with simple URL** - `https://example.com`
3. **Test with HTML content** - Skip URL fetching
4. **Check MongoDB** - Make sure it's running
5. **Restart everything** - Server + MongoDB

## Getting More Details

The updated code now shows more detailed errors. Check:
- Server console (terminal)
- API response (if in development mode)
- Browser console (for frontend errors)


# SEO Audit Feature - Testing Guide

## Frontend Par Kaise Dikhega (How to See on Frontend)

### Step 1: Start Servers

**Terminal 1 - Backend:**
```bash
npm run server
```

**Terminal 2 - Frontend:**
```bash
npm start
```

### Step 2: Login/Register

1. Open browser: `http://localhost:3000`
2. Login ya Register karo
3. Dashboard me "SEO Audit" tab dikhega navbar me

### Step 3: Use SEO Audit Feature

1. Navbar me **"SEO Audit"** click karo
2. URL enter karo (e.g., `https://example.com`)
3. **"Run Audit"** button click karo
4. Results dikhenge:
   - SEO Score (0-100)
   - Grade (A-F)
   - Issues list
   - Recommendations
   - Detailed analysis

### Step 4: View History

- **"Show Audit History"** button click karo
- Previous audits ki list dikhegi
- Kisi bhi audit pe click karke details dekh sakte ho

---

## Database Par Kaise Check Karein (How to Check in Database)

### Option 1: MongoDB Compass (GUI Tool - Recommended)

1. **MongoDB Compass install karo** (agar nahi hai):
   - Download: https://www.mongodb.com/try/download/compass

2. **Connect karo**:
   - Connection String: `mongodb://127.0.0.1:27017`
   - Connect button click karo

3. **Database select karo**:
   - `seo_tool` database select karo
   - `seoaudits` collection me jao

4. **Data dekh lo**:
   - Har audit record dikhega
   - Score, grade, issues, recommendations sab dikhenge

### Option 2: MongoDB Shell (Command Line)

**Terminal me:**
```bash
# MongoDB shell open karo
mongosh

# Database select karo
use seo_tool

# Collection me data dekh lo
db.seoaudits.find().pretty()

# Latest 5 audits dekhne ke liye
db.seoaudits.find().sort({createdAt: -1}).limit(5).pretty()

# Specific user ke audits dekhne ke liye (user ID se)
db.seoaudits.find({user: ObjectId("USER_ID_HERE")}).pretty()

# Count total audits
db.seoaudits.countDocuments()
```

### Option 3: VS Code MongoDB Extension

1. VS Code me **MongoDB Extension** install karo
2. Connect to `mongodb://127.0.0.1:27017`
3. `seo_tool` database > `seoaudits` collection
4. Data directly VS Code me dikhega

---

## API Testing (Postman/Thunder Client)

### 1. Login (Token lene ke liye)

**POST** `http://localhost:5000/api/auth/login`

```json
{
  "email": "your@email.com",
  "password": "yourpassword"
}
```

**Response me token milega**, use copy karo.

### 2. SEO Audit Run Karo

**POST** `http://localhost:5000/api/seo-audit`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json
```

**Body:**
```json
{
  "url": "https://example.com"
}
```

**Response:**
```json
{
  "message": "SEO audit completed successfully",
  "auditId": "507f1f77bcf86cd799439011",
  "result": {
    "success": true,
    "url": "https://example.com",
    "audit": {
      "score": 78,
      "grade": "C",
      "issues": [...],
      "recommendations": [...]
    }
  }
}
```

### 3. Audit History Dekho

**GET** `http://localhost:5000/api/seo-audit`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN_HERE
```

**Response:**
```json
{
  "count": 5,
  "audits": [...]
}
```

### 4. Specific Audit Dekho

**GET** `http://localhost:5000/api/seo-audit/AUDIT_ID_HERE`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN_HERE
```

---

## Quick Test URLs

Try these URLs for testing:

1. **Good SEO**: `https://www.google.com`
2. **Medium SEO**: `https://example.com`
3. **Your own site**: Apni kisi website ka URL

---

## Expected Results

### Good SEO Site (Score 80+):
- Title tag present
- Meta description present
- H1 tag present
- Good word count
- Few issues

### Poor SEO Site (Score <60):
- Missing title/meta description
- No H1 tags
- Images without alt text
- Low word count
- Many issues

---

## Troubleshooting

### Frontend me "SEO Audit" tab nahi dikh raha?
- Check karo `src/components/Navbar.js` me code sahi hai
- Browser refresh karo (Ctrl+F5)

### API call fail ho rahi hai?
- Backend running hai? (`npm run server`)
- Token sahi hai? (Login karke fresh token lo)
- CORS error? (Backend me CORS enabled hai)

### Database me data nahi dikh raha?
- MongoDB running hai?
- Connection string sahi hai?
- `seo_tool` database me `seoaudits` collection check karo

### URL fetch nahi ho raha?
- Internet connection check karo
- URL valid hai? (https:// ya http:// ke saath)
- Some sites may block automated requests

---

## Evaluation Ke Liye Demo Steps

1. **Frontend Demo**:
   - Login karo
   - SEO Audit tab open karo
   - URL enter karke audit run karo
   - Results dikhao (score, issues, recommendations)

2. **Database Demo**:
   - MongoDB Compass open karo
   - `seoaudits` collection dikhao
   - Records explain karo

3. **API Demo**:
   - Postman me API call dikhao
   - Request/Response explain karo

4. **Code Demo**:
   - `services/seoAuditService.js` dikhao
   - Explain karo kaise checks hote hain
   - Future ML enhancement plan batao

---

## Checklist

- [ ] Frontend me SEO Audit tab dikh raha hai
- [ ] URL enter karke audit run ho raha hai
- [ ] Results properly display ho rahe hain
- [ ] Audit history show ho rahi hai
- [ ] Database me records save ho rahe hain
- [ ] API endpoints working hain
- [ ] Error handling sahi hai

---

## Sample Test Data

After running audits, database me aise records dikhenge:

```json
{
  "_id": "...",
  "user": "...",
  "url": "https://example.com",
  "score": 78,
  "grade": "C",
  "elements": {
    "title": "Example Domain",
    "metaDescription": "...",
    "h1Count": 1,
    "wordCount": 450
  },
  "audit": {
    "issues": [...],
    "recommendations": [...]
  },
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

Ye sab automatically save hota hai jab bhi audit run karte ho!


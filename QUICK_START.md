# QUICK START GUIDE

## ⚡ Fast Setup (5 minutes)

### Terminal 1: Backend
```bash
cd Backend/nodejs
npm install
npm run dev
```
Expected output:
```
✅ Database connected successfully
🚀 Server running on http://localhost:5000
```

### Terminal 2: Frontend
```bash
cd frontend
npm install
npm run dev
```
Expected output:
```
▲ Next.js ready on http://localhost:3000
```

---

## 🧪 Quick Test

1. Open browser to `http://localhost:3000`
2. Click "Create account"
3. Enter: 
   - Name: `Test User`
   - Email: `test@example.com`
   - Password: `password123`
4. Click "Create account"
5. ✅ Should see dashboard with data from real database

---

## 🔧 What's Connected

| Component | Before | After |
|-----------|--------|-------|
| Login | Dummy API | Real API ✅ |
| Register | Dummy API | Real API ✅ |
| Dashboard | Mock data | Real database ✅ |
| Accounts | Hardcoded | From DB ✅ |
| Trades | Hardcoded | From DB ✅ |
| Auth Token | Not stored | JWT in localStorage ✅ |

---

## 📝 Key Changes

1. **frontend/.env.local** - Added API URL
2. **frontend/app/lib/api.ts** - Real API calls (no more mock data)
3. **frontend/app/context/UserContext.tsx** - JWT token management
4. **frontend/app/hooks/useDashboard.ts** - Real data fetching

---

## ⚠️ Important

- Backend must be running before frontend loads data
- JWT token stored in localStorage (use httpOnly cookies for production)
- Database must be set up first (see API_INTEGRATION_COMPLETE.md)

---

## 🆘 If Something Goes Wrong

**Backend won't start**:
```bash
# Check database connection
# Check .env variables
# Check port 5000 is free
```

**Frontend shows "Cannot connect to API"**:
```bash
# Check backend is running
# Check .env.local has correct API URL
# Check no firewall blocking
```

**Data still showing as dummy**:
```bash
# Clear browser cache
# Refresh page
# Check Network tab in DevTools
```

---

For detailed setup instructions, see: **API_INTEGRATION_COMPLETE.md**

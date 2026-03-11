# Text Summarizer - Setup Guide

You have **two versions** to choose from based on your network situation:

## 🌐 Option 1: Original CDN Version (No Server Needed)
**File:** `index.html`

**Best for:** Home networks, networks with CDN access, or when you want zero-setup client-side processing.

### How to run:
1. Open the file in VS Code
2. Right-click → "Open with Live Server" (or use `Ctrl+Shift+P` → "Live Server: Open with Live Server")
3. The app loads the Transformers.js library from CDN
4. All processing happens in your browser (no server needed)

### Why it might not work:
- ❌ Corporate firewalls blocking external CDNs (jsDelivr, unpkg, esm.sh)
- ❌ ISP blocking external services
- ❌ Antivirus/security software blocking CDN access
- ❌ VPN or proxy not allowing external connections

**Troubleshooting:** See [NETWORK_BLOCKING_SOLUTIONS.md](./NETWORK_BLOCKING_SOLUTIONS.md)

---

## 🖥️ Option 2: Backend Server Version (Recommended for Firewalls)
**Files:** `index-backend.html` + `server.js`

**Best for:** Corporate networks, restricted network environments, or guaranteed reliability.

### Why this is better for firewall situations:
- ✅ Runs entirely on **localhost** (no external CDN calls)
- ✅ Only accesses internal network
- ✅ Works even if firewall blocks all external services
- ✅ Faster processing (no CDN download delays)
- ✅ More reliable (doesn't depend on CDN availability)

### Setup (2 mins):

**Step 1: Install Node.js dependencies**
```bash
cd /home/vigneshwaran/Natchathra/github/huggingface
npm install express transformers cors dotenv
```

**Step 2: Start the backend server**
```bash
node server.js
```

You should see:
```
Server running on http://localhost:3000
API ready at http://localhost:3000/api/summarize
```

**Step 3: Open the frontend in a new terminal**
```bash
# In VS Code, open index-backend.html with Live Server
# Or start it manually:
cd /home/vigneshwaran/Natchathra/github/huggingface
python -m http.server 5500  # or: npx http-server -p 5500
```

**Step 4: Use the app**
- Go to `http://localhost:5500/index-backend.html` (or wherever Live Server opens it)
- Type your text
- Click "Summarize"
- **No external CDN calls** - everything stays local!

---

## 🔄 Switching Between Versions

### From CDN to Backend:
If CDN version doesn't work for you:
1. ✅ Start backend server: `node server.js`
2. ✅ Switch to `index-backend.html`
3. ✅ Done! The app now calls your local API instead of CDN

### From Backend to CDN:
If you want to try CDN version:
1. Stop the backend: `Ctrl+C`
2. Use `index.html` file instead
3. Should work if firewalls permit CDN access

---

## 📊 Comparison Table

| Feature | index.html (CDN) | index-backend.html (Server) |
|---------|------------------|---------------------------|
| Setup required | No | Yes (npm install + node server.js) |
| Processing location | Browser | Node.js server |
| CDN access needed | ✅ Yes (required) | ❌ No (internal only) |
| Works behind firewall | Depends | ✅ Always |
| Processing speed | 30-120s (first load) | ~5-10s consistent |
| Model download | ~300MB to browser | ~300MB to server (once) |
| Privacy | Your device | Your server |
| Offline support | ❌ No | ✅ (after first run) |

---

## 🧪 Quick Test to Check Your Network

**Test 1: Can your network access CDNs?**
```bash
# Try each CDN
curl -I https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0/dist/transformers.min.js
curl -I https://unpkg.com/@xenova/transformers@2.6.0/dist/transformers.min.js
curl -I https://esm.sh/@xenova/transformers@2.6.0
```

**If all fail:** Your firewall blocks external CDNs → **Use backend version**

**If some work:** Try `index.html` - it will use the working CDN

---

## ⚠️ Troubleshooting

### "Server not running" message
```bash
# Make sure you're in the right directory and ran:
node server.js
# Should see: Server running on http://localhost:3000
```

### "Cannot find module 'express'"
```bash
# Install dependencies:
npm install express transformers cors dotenv
```

### "Port 3000 already in use"
```bash
# Use a different port - edit server.js line: const PORT = 3000;
# Change to: const PORT = 3001;
```

### Still not working?
1. Check browser console (F12 → Console tab) for error messages
2. Make sure server.js is running in a terminal
3. Make sure index-backend.html is opened in the browser
4. Try the CDN version to see if it's a network limitation

---

## 📝 Next Steps

1. **Test your network:** Try `index.html` first
2. **Check for errors:** Open DevTools (F12) if something fails
3. **Use backend if needed:** Switch to `index-backend.html` + `node server.js`
4. **Deploy to production:** See [NETWORK_BLOCKING_SOLUTIONS.md](./NETWORK_BLOCKING_SOLUTIONS.md) for deployment options

---

## 🚀 Production Deployment

### For Backend Version:
```bash
# Option 1: Docker
docker build -t summarizer-api .
docker run -p 3000:3000 summarizer-api

# Option 2: Heroku
git push heroku main

# Option 3: Google Cloud / Azure
gcloud run deploy summarizer-api --source .
```

### For CDN Version:
```bash
# Deploy to GitHub Pages
git push origin main

# Or any static hosting (Netlify, Vercel, etc.)
```

---

**Questions?** Check the console (F12) for detailed error messages, or try the other version!

# API Reference - Text Summarizer Backend

Complete documentation for the `/api/summarize` endpoint.

---

## 🖥️ Server Details

**Base URL:** `http://localhost:3000`

**Default Port:** 3000 (configurable in `server.js` line 3)

**Status Check:** `GET http://localhost:3000/api/health`

---

## POST /api/summarize

Summarizes the provided text using the Xenova/distilbart-cnn-6-6 model.

### Request

**Method:** `POST`

**Content-Type:** `application/json`

**Body:**
```json
{
  "text": "Your text to summarize here. Must be at least 50 characters..."
}
```

### Response - Success (200)

```json
{
  "success": true,
  "summary": "This is the summarized version of your text...",
  "originalLength": 500,
  "summaryLength": 120,
  "processingTime": "2.45s",
  "model": "Xenova/distilbart-cnn-6-6"
}
```

### Response - Error (400)

```json
{
  "success": false,
  "message": "Text is too short. Minimum 50 characters required."
}
```

### Response - Server Error (500)

```json
{
  "success": false,
  "message": "Model failed to load. Please try again."
}
```

---

## Examples

### JavaScript / Fetch API

```javascript
async function summarizeText(text) {
  try {
    const response = await fetch('http://localhost:3000/api/summarize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    const data = await response.json();
    console.log('Summary:', data.summary);
    console.log('Processing time:', data.processingTime);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Usage
summarizeText('Your long text here...');
```

### Python / Requests

```python
import requests
import json

url = 'http://localhost:3000/api/summarize'
payload = {
    'text': 'Your text to summarize here...'
}

response = requests.post(url, json=payload)
data = response.json()

if data['success']:
    print(f"Summary: {data['summary']}")
    print(f"Time: {data['processingTime']}")
else:
    print(f"Error: {data['message']}")
```

### cURL

```bash
curl -X POST http://localhost:3000/api/summarize \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your text to summarize here. It should be at least 50 characters long for best results..."
  }'
```

### Node.js / Axios

```javascript
const axios = require('axios');

async function summarize(text) {
  try {
    const response = await axios.post('http://localhost:3000/api/summarize', {
      text
    });
    console.log(response.data.summary);
  } catch (error) {
    console.error(error.response.data.message);
  }
}
```

---

## GET /api/health

Check if the server is running and ready to accept requests.

### Response - OK (200)

```json
{
  "status": "ok",
  "message": "Server is ready to summarize text"
}
```

### Response - Server Down

No response or connection refused

---

## Error Codes

| Code | Message | Solution |
|------|---------|----------|
| 400 | Text is too short | Send at least 50 characters |
| 400 | Text is required | Include a `text` field in JSON body |
| 500 | Model failed to load | Server needs internet to download model (first run only) |
| 500 | Summarization failed | Try a different text, or restart server |
| Connection refused | Server not running | Run `node server.js` |
| CORS error | Cross-origin blocked | Server has CORS enabled for localhost |

---

## Request Limits

| Limit | Value | Notes |
|-------|-------|-------|
| Min text length | 50 chars | Shorter text produces poor summaries |
| Max text length | No limit | Large texts take longer to process |
| Request timeout | 60 seconds | Server will abort if processing > 60s |
| Model download | ~300MB total | Downloaded once, cached for future requests |

---

## Performance Benchmarks

**Cold Start (First Request):**
- Model loading: 5-10 seconds
- Processing: 2-5 seconds
- Total: ~10-15 seconds

**Warm Start (Cached Model):**
- Processing: 1-3 seconds
- Total: ~1-3 seconds

---

## Configuration

### Change Server Port

Edit `server.js` line 3:
```javascript
const PORT = process.env.PORT || 3000;  // Change 3000 to your port
```

### Environment Variables

```bash
# Set port via environment
export PORT=8080
node server.js

# Or on Windows
set PORT=8080 && node server.js
```

### Enable Logging

The server logs:
- ✅ `Server started on port 3000`
- ✅ `Received request: <timestamp>`
- ✅ `Processing: <text_length> characters`
- ✅ `Completed in <time>ms`
- ❌ `Error loading model: <error_message>`

Check console output when running `node server.js`

---

## Integrating with Frontend

### Using index-backend.html

```javascript
// Provided form handler in index-backend.html
const response = await fetch('http://localhost:3000/api/summarize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text })
});
const data = await response.json();
resultBox.textContent = data.summary;
```

### Building Your Own Client

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Summarizer</title>
</head>
<body>
  <textarea id="text" placeholder="Enter text..."></textarea>
  <button onclick="summarize()">Summarize</button>
  <div id="result"></div>

  <script>
    async function summarize() {
      const text = document.getElementById('text').value;
      const result = document.getElementById('result');
      
      try {
        result.textContent = 'Processing...';
        const response = await fetch('http://localhost:3000/api/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        
        const data = await response.json();
        result.textContent = data.success ? data.summary : data.message;
      } catch (error) {
        result.textContent = 'Error: ' + error.message;
      }
    }
  </script>
</body>
</html>
```

---

## Docker Deployment

### Build Docker Image

```dockerfile
# Dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

### Build & Run

```bash
docker build -t summarizer-api .
docker run -p 3000:3000 summarizer-api
```

---

## Troubleshooting

### Server starts but requests timeout

**Issue:** Port 3000 is busy or server hasn't finished loading model

**Solution:**
```bash
# Check if port is in use
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill process on that port
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows

# Or use a different port
export PORT=3001 && node server.js
```

### CORS errors in browser

**Issue:** Frontend can't reach the server (different port/origin)

**Solution:** Server already has CORS enabled. Check:
1. Frontend and backend on same machine?
2. Frontend has correct API URL?
3. Both services running?

### Model won't download

**Issue:** Server can't download the 300MB model

**Solution:**
- Check internet connection
- Try again (it's a large download, might be slow)
- Check `server.js` runs without errors
- Verify you have 500MB free disk space

---

## Rate Limiting

Currently: **No rate limiting** (add if needed for production)

To add rate limiting, install `express-rate-limit`:

```bash
npm install express-rate-limit
```

Then update `server.js`:

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use(limiter);
```

---

## Production Checklist

- [ ] Change `localhost` to actual server IP/domain
- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS (use `express` with SSL)
- [ ] Add authentication if needed
- [ ] Add rate limiting
- [ ] Monitor server logs
- [ ] Set up auto-restart (PM2 or systemd)
- [ ] Allocate enough RAM for model (~2GB)

---

## Getting Help

1. **Check console logs** while running `node server.js`
2. **Test endpoint** with curl or Postman
3. **Verify model downloads** (happens on first request)
4. **Check firewall** isn't blocking port 3000
5. **Try different port** if 3000 is busy

---

**API Version:** v1.0  
**Model:** Xenova/distilbart-cnn-6-6  
**Last Updated:** 2024
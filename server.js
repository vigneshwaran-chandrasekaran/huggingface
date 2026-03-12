// Backend Text Summarizer - No External CDN Needed
// Requires: npm install express @xenova/transformers cors

const express = require('express');
const cors = require('cors');
const path = require('path');
const { pipeline } = require('@xenova/transformers');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

const app = express();
const PORT = 3000;

// Configuration constants
const CONFIG = {
  MAX_HTML_SIZE_MB: 10,
  FETCH_TIMEOUT_MS: 30000,
  MAX_EXTRACTED_LENGTH: 5000,
  PREVIEW_LENGTH: 500
};

// SSRF Protection - Blacklist private/internal IPs
const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2[0-9]|3[01])\.\d+\.\d+$/,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i
];

function isPrivateIP(hostname) {
  return PRIVATE_IP_PATTERNS.some(pattern => pattern.test(hostname));
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname)));

// Initialize summarizer (lazy loaded on first request)
let summarizer = null;
let isInitializingPromise = null;

async function initializeSummarizer() {
  if (isInitializingPromise) return isInitializingPromise;
  if (summarizer) return;
  
  isInitializingPromise = (async () => {
    try {
      console.log('Loading Transformers.js model on server...');
      summarizer = await pipeline('summarization', 'Xenova/distilbart-cnn-6-6');
      console.log('✅ Model loaded successfully');
    } catch (err) {
      console.error('❌ Failed to load model:', err.message);
      isInitializingPromise = null;
      throw err;
    }
  })();
  
  return isInitializingPromise;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    modelLoaded: !!summarizer,
    isInitializing: !!isInitializingPromise
  });
});

// Summarize endpoint
app.post('/api/summarize', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    if (text.length < 50) {
      return res.status(400).json({ 
        error: 'Please provide at least 50 characters' 
      });
    }

    // Initialize model on first request
    if (!summarizer) {
      console.log('Initializing model on first request...');
      await initializeSummarizer();
    }

    console.log(`Summarizing text (${text.length} chars)...`);
    const startTime = Date.now();

    // Perform summarization
    const result = await summarizer(text, {
      max_length: 130,
      min_length: 30,
    });

    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const summary = result[0].summary_text;

    res.json({
      success: true,
      summary,
      processingTime: `${processingTime}s`,
      originalLength: text.length,
      summaryLength: summary.length
    });
  } catch (err) {
    console.error('Summarization error:', err);
    res.status(500).json({
      error: 'Summarization failed',
      message: err.message
    });
  }
});

// URL Summarization endpoint - Extract content from URL and summarize
app.post('/api/summarize-url', async (req, res) => {
  let dom = null;  // Track DOM for cleanup
  
  try {
    const { url } = req.body;

    // Input validation
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format
    let urlObj;
    try {
      urlObj = new URL(url);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }
    
    // SSRF Protection - Reject private/internal IPs
    if (isPrivateIP(urlObj.hostname)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Cannot access URLs from private networks (${urlObj.hostname})`
      });
    }

    console.log(`Fetching content from: ${url}`);
    const startTime = Date.now();

    // Fetch the webpage content with proper timeout using AbortController
    let html;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        CONFIG.FETCH_TIMEOUT_MS
      );

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate'
        },
        signal: controller.signal,
        timeout: CONFIG.FETCH_TIMEOUT_MS
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return res.status(400).json({
          error: `Failed to fetch webpage`,
          message: `HTTP ${response.status}: ${response.statusText}`
        });
      }

      // Check content-length header for size limit
      const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
      if (contentLength > CONFIG.MAX_HTML_SIZE_MB * 1024 * 1024) {
        return res.status(413).json({
          error: 'Payload too large',
          message: `Webpage exceeds maximum size of ${CONFIG.MAX_HTML_SIZE_MB}MB`
        });
      }

      html = await response.text();

      // Verify actual size after decompression
      if (html.length > CONFIG.MAX_HTML_SIZE_MB * 1024 * 1024) {
        return res.status(413).json({
          error: 'Payload too large',
          message: `Webpage exceeds maximum size of ${CONFIG.MAX_HTML_SIZE_MB}MB after decompression`
        });
      }

      if (!html || html.length === 0) {
        return res.status(400).json({
          error: 'Empty webpage content',
          message: 'The webpage returned no content'
        });
      }
    } catch (err) {
      // Distinguish between timeout and other errors
      if (err.name === 'AbortError') {
        return res.status(408).json({
          error: 'Request timeout',
          message: `Webpage took longer than ${CONFIG.FETCH_TIMEOUT_MS / 1000}s to load`
        });
      }
      return res.status(502).json({
        error: 'Failed to fetch webpage',
        message: err.message
      });
    }

    console.log(`Successfully fetched ${html.length} bytes from ${url}`);

    // Extract main content using Readability
    let extractedContent;
    try {
      dom = new JSDOM(html, { url: url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (!article || !article.textContent) {
        return res.status(400).json({
          error: 'Failed to extract article content',
          message: 'Could not find readable content on the webpage'
        });
      }

      // Clean up extracted text
      extractedContent = article.textContent
        .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
        .trim()
        .substring(0, CONFIG.MAX_EXTRACTED_LENGTH);  // Limit content length

      console.log(`Extracted ${extractedContent.length} characters of content`);

      if (extractedContent.length < 50) {
        return res.status(400).json({
          error: 'Insufficient content',
          message: 'Extracted content is too short to summarize (minimum 50 characters needed)'
        });
      }
    } catch (err) {
      console.error('Content extraction error:', err);
      return res.status(500).json({
        error: 'Failed to extract article content',
        message: err.message
      });
    } finally {
      // IMPORTANT: Clean up JSDOM to prevent memory leaks
      if (dom) {
        dom.window.close();
        dom = null;
      }
    }

    // Initialize model on first request
    if (!summarizer) {
      console.log('Initializing model on first request...');
      await initializeSummarizer();
    }

    console.log(`Summarizing extracted content (${extractedContent.length} chars)...`);
    const summaryStartTime = Date.now();

    // Perform summarization
    const result = await summarizer(extractedContent, {
      max_length: 130,
      min_length: 30,
    });

    const summaryTime = ((Date.now() - summaryStartTime) / 1000).toFixed(2);
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const summary = result[0].summary_text;

    // Safe preview truncation - don't split mid-word
    let preview = extractedContent.substring(0, CONFIG.PREVIEW_LENGTH);
    if (extractedContent.length > CONFIG.PREVIEW_LENGTH) {
      // Find last space before limit to avoid breaking mid-word
      const lastSpace = preview.lastIndexOf(' ');
      if (lastSpace > 0) {
        preview = preview.substring(0, lastSpace) + '...';
      } else {
        preview = preview + '...';
      }
    }

    res.json({
      success: true,
      summary,
      extractedContent: preview,
      url: url,
      timings: {
        summaryTime: `${summaryTime}s`,
        totalTime: `${totalTime}s`
      },
      stats: {
        extractedLength: extractedContent.length,
        summaryLength: summary.length
      }
    });
  } catch (err) {
    console.error('URL summarization error:', err);
    // Ensure DOM is cleaned up even on error
    if (dom) {
      try {
        dom.window.close();
      } catch (e) {
        console.warn('Error closing DOM:', e);
      }
    }
    res.status(500).json({
      error: 'URL summarization failed',
      message: err.message
    });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   Text Summarizer Backend Server      ║
║                                        ║
║   URL: http://localhost:${PORT}        ║
║   API: POST http://localhost:${PORT}/api/summarize   ║
║   Health: http://localhost:${PORT}/api/health       ║
║                                        ║
║   Note: First request will load the   ║
║   Transformers.js model (~200MB)      ║
║   This may take 1-3 minutes            ║
╚════════════════════════════════════════╝
  `);
});

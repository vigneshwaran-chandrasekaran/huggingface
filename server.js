// Backend Text Summarizer - No External CDN Needed
// Requires: npm install express @xenova/transformers cors

const express = require('express');
const cors = require('cors');
const path = require('path');
const { pipeline } = require('@xenova/transformers');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname)));

// Initialize summarizer (lazy loaded on first request)
let summarizer = null;
let isInitializing = false;

async function initializeSummarizer() {
  if (summarizer || isInitializing) return;
  
  isInitializing = true;
  try {
    console.log('Loading Transformers.js model on server...');
    summarizer = await pipeline('summarization', 'Xenova/distilbart-cnn-6-6');
    console.log('✅ Model loaded successfully');
  } catch (err) {
    console.error('❌ Failed to load model:', err.message);
    isInitializing = false;
    throw err;
  }
  isInitializing = false;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    modelLoaded: !!summarizer,
    isInitializing
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

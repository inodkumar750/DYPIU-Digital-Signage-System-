import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import screensRouter from './routes/screens.js';
import mediaRouter from './routes/media.js';
import playlistsRouter from './routes/playlists.js';
import campaignsRouter from './routes/campaigns.js';
import groupsRouter from './routes/groups.js';
import publishingRouter from './routes/publishing.js';
import usersRouter from './routes/users.js';
import authRouter from './routes/auth.js';
import settingsRouter from './routes/settings.js';
import deviceRouter from './routes/device.js';
import { pool } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for React frontend (localhost:3000) and TV clients
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded media files statically with caching for instant TV playback
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    maxAge: '30d',
    etag: true,
    lastModified: true,
  })
);

// Also serve built-in sample assets on port 5000 for TV manifest compatibility
app.use(
  '/src/assets',
  express.static(path.join(__dirname, '..', 'src', 'assets'), {
    maxAge: '30d',
  })
);

// Serve Android TV APK directly for OTA updates & direct download
app.get('/CampusCast-TV.apk', (req, res) => {
  res.download(path.join(__dirname, '..', 'public', 'CampusCast-TV.apk'), 'CampusCast-TV.apk');
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'CampusCast Digital Signage Backend API',
    timestamp: new Date().toISOString(),
  });
});

// API Routes (v1)
app.use('/api/v1/screens', screensRouter);
app.use('/api/v1/media', mediaRouter);
app.use('/api/v1/playlists', playlistsRouter);
app.use('/api/v1/campaigns', campaignsRouter);
app.use('/api/v1/groups', groupsRouter);
app.use('/api/v1/publishing', publishingRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/settings', settingsRouter);
app.use('/api/v1/device', deviceRouter);

// Ensure optional QR campaign columns exist on live database
async function ensureCampaignQrColumns() {
  try {
    const [cols] = await pool.query("SHOW COLUMNS FROM campaigns LIKE 'qr_url'");
    if (cols.length === 0) {
      await pool.query(
        'ALTER TABLE campaigns ADD COLUMN qr_url VARCHAR(500) DEFAULT NULL, ADD COLUMN qr_label VARCHAR(120) DEFAULT NULL'
      );
      console.log('✅ Added optional qr_url & qr_label columns to campaigns table');
    }
  } catch (err) {
    console.warn('⚠️ Could not verify campaigns QR columns:', err.message);
  }
}

// Start server
app.listen(PORT, '0.0.0.0', async () => {
  await ensureCampaignQrColumns();
  console.log(`🚀 CampusCast Backend running at: http://localhost:${PORT}`);
  console.log(`📺 Android TV Sync Manifest: http://localhost:${PORT}/api/v1/device/:screenId/manifest`);
  console.log(`📡 TV Heartbeat Ingest:      http://localhost:${PORT}/api/v1/device/:screenId/heartbeat`);
});

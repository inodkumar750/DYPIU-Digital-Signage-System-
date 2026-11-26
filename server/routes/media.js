import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';
import { ensureMp4FastStart } from '../utils/mp4FastStart.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${cleanName}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB max
});

const router = Router();

// GET all media
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM media_assets ORDER BY created_at DESC');
    const media = rows.map((r) => ({
      id: r.id,
      fileName: r.file_name,
      title: r.title,
      type: r.type,
      category: r.category,
      uploadDate: r.upload_date,
      durationSeconds: r.duration_seconds,
      fileSize: r.file_size,
      dimensions: r.dimensions,
      aspectRatio:
        r.aspect_ratio ||
        (r.dimensions && r.dimensions.includes('1080 × 1920') ? '9:16' : '16:9'),
      thumbnailUrl: r.thumbnail_url || r.file_url,
      fileUrl: r.file_url,
      accentTone: r.accent_tone,
      uploadedBy: r.uploaded_by,
      description: r.description,
    }));
    res.json({ success: true, data: media });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST upload media file
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const {
      title,
      category,
      type,
      durationSeconds,
      description,
      uploadedBy,
      aspectRatio: rawAspectRatio,
      dimensions: rawDimensions,
    } = req.body;
    const file = req.file;

    // Enforce limits: 20 MB for Images, 30 MB for Videos
    if (file) {
      const isVideoCheck = file.mimetype.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(file.originalname);
      if (!isVideoCheck && file.size > 20 * 1024 * 1024) {
        fs.unlinkSync(file.path);
        return res.status(400).json({ success: false, error: 'Image size exceeds maximum allowed limit of 20 MB.' });
      }
      if (isVideoCheck && file.size > 30 * 1024 * 1024) {
        fs.unlinkSync(file.path);
        return res.status(400).json({ success: false, error: 'Video size exceeds maximum allowed limit of 30 MB.' });
      }
      if (isVideoCheck && /\.(mp4|m4v|mov)$/i.test(file.originalname)) {
        ensureMp4FastStart(file.path);
      }
    }

    const id = `med-${Date.now().toString().slice(-4)}`;
    const uploadDate = new Date().toISOString().substring(0, 10);
    const fileSize = file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : (req.body.fileSize || '2.5 MB');
    const isVideo = type === 'Video' || (file && file.mimetype.startsWith('video/')) || (file && /\.(mp4|webm|mov|mkv)$/i.test(file.originalname));
    const fileName = file ? file.filename : (req.body.fileName || `asset_${id}.${isVideo ? 'mp4' : 'jpg'}`);
    const fileUrl = file ? `/uploads/${file.filename}` : (req.body.fileUrl || '');
    const thumbnailUrl = file ? `/uploads/${file.filename}` : (req.body.thumbnailUrl || fileUrl);
    const aspectRatio = rawAspectRatio === '9:16' ? '9:16' : '16:9';
    const dimensions = rawDimensions || (aspectRatio === '9:16' ? '1080 × 1920' : '1920 × 1080');

    await pool.query(
      `INSERT INTO media_assets (id, file_name, title, type, category, upload_date, duration_seconds, file_size, dimensions, aspect_ratio, thumbnail_url, file_url, uploaded_by, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        fileName,
        title || fileName,
        isVideo ? 'Video' : 'Image',
        category || 'University Admissions',
        uploadDate,
        isVideo ? parseInt(durationSeconds || '30', 10) : null,
        fileSize,
        dimensions,
        aspectRatio,
        thumbnailUrl,
        fileUrl,
        uploadedBy || 'Vinod Kumar Jain',
        description || '',
      ]
    );

    res.json({
      success: true,
      data: {
        id,
        fileName,
        title: title || fileName,
        type: isVideo ? 'Video' : 'Image',
        category: category || 'University Admissions',
        uploadDate,
        durationSeconds: isVideo ? parseInt(durationSeconds || '30', 10) : undefined,
        fileSize,
        dimensions,
        aspectRatio,
        thumbnailUrl,
        fileUrl,
        uploadedBy: uploadedBy || 'Vinod Kumar Jain',
        description: description || '',
      },
    });
  } catch (err) {
    console.error('Upload Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT update media metadata
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, description } = req.body;
    await pool.query(
      'UPDATE media_assets SET title=?, category=?, description=? WHERE id=?',
      [title, category, description, id]
    );
    res.json({ success: true, message: 'Media metadata updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE media asset
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM media_assets WHERE id=?', [id]);
    res.json({ success: true, message: 'Media asset deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

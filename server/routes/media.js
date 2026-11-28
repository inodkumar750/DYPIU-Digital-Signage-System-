import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { pool, withTx } from '../db.js';
import { config } from '../config.js';
import { requireMenu } from '../middleware/auth.js';
import { asyncHandler, badRequest, conflict, newId, notFound, oneOf, str } from '../utils/http.js';
import { ensureMp4FastStart, readMp4DurationSeconds } from '../utils/mp4FastStart.js';
import { listMedia } from '../services/serializers.js';
import { formatTimestamp } from '../utils/heartbeat.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const VIDEO_EXT = new Set(['.mp4', '.m4v', '.mov', '.webm']);
const CATEGORIES = ['University Admissions', 'Events', 'Workshops', 'Placements', 'Student Activities', 'Announcements'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  // Random server-side name: no user-controlled path/extension reaches the disk (prevents overwrite + stored XSS tricks).
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomBytes(12).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: Math.max(config.maxImageMb, config.maxVideoMb) * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isImg = IMAGE_EXT.has(ext) && file.mimetype.startsWith('image/');
    const isVid = VIDEO_EXT.has(ext) && file.mimetype.startsWith('video/');
    if (isImg || isVid) return cb(null, true);
    cb(badRequest('Unsupported file. Allowed: JPG, PNG, GIF, WebP images and MP4, MOV, WebM videos.'));
  },
});

function removeFile(p) {
  fs.promises.unlink(p).catch(() => {});
}

/** Deletes a stored upload (only ever inside the uploads directory). */
function removeUploadByUrl(fileUrl) {
  if (!fileUrl || !fileUrl.startsWith('/uploads/')) return;
  const target = path.join(uploadDir, path.basename(fileUrl));
  if (path.dirname(target) === uploadDir) removeFile(target);
}

const router = Router();
const canEdit = requireMenu('media');

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await listMedia() });
  })
);

router.post(
  '/upload',
  canEdit,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const file = req.file;
    const b = req.body || {};
    try {
      const title = str(b.title, { field: 'Title', max: 255 });
      const category = oneOf(b.category, CATEGORIES, { field: 'Category', fallback: 'University Admissions' });
      const aspectRatio = b.aspectRatio === '9:16' ? '9:16' : '16:9';
      const dimensions = str(b.dimensions, { max: 50 }) || (aspectRatio === '9:16' ? '1080 × 1920' : '1920 × 1080');
      const description = str(b.description, { max: 2000 });
      const id = newId('med');
      const uploadDate = formatTimestamp(Date.now()).slice(0, 10);

      let isVideo;
      let fileName;
      let fileUrl;
      let fileSize;
      let duration = null;

      if (file) {
        const ext = path.extname(file.originalname).toLowerCase();
        isVideo = VIDEO_EXT.has(ext);
        const limitMb = isVideo ? config.maxVideoMb : config.maxImageMb;
        if (file.size > limitMb * 1024 * 1024) {
          removeFile(file.path);
          throw badRequest(`${isVideo ? 'Video' : 'Image'} size exceeds the ${limitMb} MB limit.`);
        }
        if (isVideo && /\.(mp4|m4v|mov)$/i.test(ext)) {
          ensureMp4FastStart(file.path);
          duration = readMp4DurationSeconds(file.path);
        }
        if (isVideo && !duration) duration = Math.max(1, parseInt(b.durationSeconds || '30', 10) || 30);
        const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9 _.-]/g, '_').slice(0, 120);
        fileName = `${base}${ext}`;
        fileUrl = `/uploads/${file.filename}`;
        fileSize = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
      } else {
        // Metadata-only record: only built-in sample assets may be referenced (no arbitrary external URLs).
        const url = str(b.fileUrl, { max: 255 });
        if (!url || !/^\/(src\/assets|uploads)\//.test(url) || url.includes('..')) {
          throw badRequest('Please choose a file to upload.');
        }
        isVideo = b.type === 'Video';
        fileUrl = url;
        fileName = str(b.fileName, { max: 255, fallback: path.basename(url) });
        fileSize = str(b.fileSize, { max: 50, fallback: 'n/a' });
        if (isVideo) duration = Math.max(1, parseInt(b.durationSeconds || '30', 10) || 30);
      }

      await pool.query(
        `INSERT INTO media_assets (id, file_name, title, type, category, upload_date, duration_seconds, file_size, dimensions, aspect_ratio, thumbnail_url, file_url, uploaded_by, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, fileName, title || fileName, isVideo ? 'Video' : 'Image', category, uploadDate, duration, fileSize, dimensions, aspectRatio, fileUrl, fileUrl, req.user.name, description]
      );

      res.json({
        success: true,
        data: {
          id,
          fileName,
          title: title || fileName,
          type: isVideo ? 'Video' : 'Image',
          category,
          uploadDate,
          durationSeconds: duration ?? undefined,
          fileSize,
          dimensions,
          aspectRatio,
          thumbnailUrl: fileUrl,
          fileUrl,
          uploadedBy: req.user.name,
          description,
        },
      });
    } catch (err) {
      if (file) removeFile(file.path); // never leave orphan files behind on validation / DB errors
      throw err;
    }
  })
);

router.put(
  '/:id',
  canEdit,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const title = str(b.title, { field: 'Title', max: 255, required: true });
    const category = oneOf(b.category, CATEGORIES, { field: 'Category' });
    const [r] = await pool.query('UPDATE media_assets SET title=?, category=?, description=? WHERE id=?', [
      title,
      category,
      str(b.description, { max: 2000 }),
      req.params.id,
    ]);
    if (r.affectedRows === 0) throw notFound('Media not found');
    res.json({ success: true, message: 'Media metadata updated' });
  })
);

/** Blocks deletion while the asset is in a playlist, unless ?force=1 (then it is removed from those playlists). */
router.delete(
  '/:id',
  canEdit,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const force = req.query.force === '1';
    const fileUrl = await withTx(async (conn) => {
      const [rows] = await conn.query('SELECT file_url FROM media_assets WHERE id=? FOR UPDATE', [id]);
      if (rows.length === 0) throw notFound('Media not found');
      const [uses] = await conn.query(
        'SELECT DISTINCT p.name FROM playlist_items pi JOIN playlists p ON p.id = pi.playlist_id WHERE pi.media_id=? LIMIT 5',
        [id]
      );
      if (uses.length > 0 && !force) {
        throw conflict(
          `This file is used in playlist(s): ${uses.map((u) => `"${u.name}"`).join(', ')}. Remove it from them first, or delete anyway to remove it everywhere.`
        );
      }
      await conn.query('DELETE FROM playlist_items WHERE media_id=?', [id]);
      await conn.query('DELETE FROM media_assets WHERE id=?', [id]);
      return rows[0].file_url;
    });
    removeUploadByUrl(fileUrl);
    res.json({ success: true, message: 'Media asset deleted successfully' });
  })
);

export default router;

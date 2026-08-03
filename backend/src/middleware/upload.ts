import multer from 'multer'
import path from 'path'
import crypto from 'crypto'
import fs from 'fs'

const uploadDir = path.join(__dirname, '../../uploads')

// Ensure uploads directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// Whitelist of raster image types only — SVG is deliberately excluded since it
// can embed <script> and gets served back with a browser-executable
// Content-Type (image/svg+xml) from the public /uploads static path.
const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    // Extension is derived from the validated MIME type, not the
    // attacker-controlled original filename.
    const ext = ALLOWED_MIME_TO_EXT[file.mimetype] || path.extname(file.originalname).slice(0, 10)
    const uniqueSuffix = crypto.randomBytes(8).toString('hex')
    cb(null, `${Date.now()}-${uniqueSuffix}${ext}`)
  }
})

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (Object.prototype.hasOwnProperty.call(ALLOWED_MIME_TO_EXT, file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only JPEG, PNG, WebP, or GIF images are allowed'))
    }
  }
})

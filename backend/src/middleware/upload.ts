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

// The client-declared MIME type is just a header. After multer has stored the file, check the real signature
// (magic bytes) so a script/HTML/SVG payload renamed to .png is rejected; rejected or failed uploads are deleted.
const SIGNATURES: Record<string, (b: Buffer) => boolean> = {
  'image/jpeg': b => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': b => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/gif': b => b.length > 6 && (b.subarray(0, 6).toString('latin1') === 'GIF87a' || b.subarray(0, 6).toString('latin1') === 'GIF89a'),
  'image/webp': b => b.length > 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
}

export const verifyUploadedImage = (req: any, res: any, next: any) => {
  const file = req.file as Express.Multer.File | undefined
  if (!file) return next()
  const discard = () => fs.unlink(file.path, () => {})
  try {
    const fd = fs.openSync(file.path, 'r')
    const head = Buffer.alloc(16)
    fs.readSync(fd, head, 0, 16, 0)
    fs.closeSync(fd)
    if (!Object.values(SIGNATURES).some(check => check(head))) {
      discard()
      return res.status(400).json({ success: false, message: 'The uploaded file is not a valid image.' })
    }
  } catch {
    discard()
    return res.status(400).json({ success: false, message: 'Could not read the uploaded file.' })
  }
  // If the request later fails (validation, balance, lock...), don't leave an orphaned file behind
  res.on('finish', () => { if (res.statusCode >= 400) discard() })
  next()
}

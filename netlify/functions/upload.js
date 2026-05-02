// netlify/functions/upload.js
// Receives base64 file from browser → uploads to Cloudinary → returns URL
// Used for: profile photos, certificates, resume PDFs, order PNGs

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  }

  try {
    const { fileData, fileName, orderId } = JSON.parse(event.body)

    if (!fileData) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No file data' }) }
    }

    const CLOUD  = process.env.CLOUDINARY_CLOUD_NAME
    const KEY    = process.env.CLOUDINARY_API_KEY
    const SECRET = process.env.CLOUDINARY_API_SECRET

    if (!CLOUD || !KEY || !SECRET) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Cloudinary env vars missing' }) }
    }

    // Generate signed upload signature
    const crypto  = require('crypto')
    const timestamp = Math.round(Date.now() / 1000)
    const folder    = 'tapfreaks-profiles'
    const publicId  = `${orderId || 'user'}_${timestamp}`
    const sigStr    = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${SECRET}`
    const signature = crypto.createHash('sha1').update(sigStr).digest('hex')

    // Build multipart form
    const boundary = '----TapFreaksBoundary' + Date.now()
    const CRLF = '\r\n'

    // Determine file type
    let mimeType = 'image/jpeg'
    if (fileName?.toLowerCase().endsWith('.png'))  mimeType = 'image/png'
    if (fileName?.toLowerCase().endsWith('.pdf'))  mimeType = 'application/pdf'
    if (fileName?.toLowerCase().endsWith('.webp')) mimeType = 'image/webp'

    // Build body as Buffer
    const parts = [
      `--${boundary}${CRLF}Content-Disposition: form-data; name="file"${CRLF}Content-Type: ${mimeType}${CRLF}${CRLF}`,
      Buffer.from(fileData, 'base64'),
      `${CRLF}--${boundary}${CRLF}Content-Disposition: form-data; name="api_key"${CRLF}${CRLF}${KEY}`,
      `${CRLF}--${boundary}${CRLF}Content-Disposition: form-data; name="timestamp"${CRLF}${CRLF}${timestamp}`,
      `${CRLF}--${boundary}${CRLF}Content-Disposition: form-data; name="signature"${CRLF}${CRLF}${signature}`,
      `${CRLF}--${boundary}${CRLF}Content-Disposition: form-data; name="folder"${CRLF}${CRLF}${folder}`,
      `${CRLF}--${boundary}${CRLF}Content-Disposition: form-data; name="public_id"${CRLF}${CRLF}${publicId}`,
      `${CRLF}--${boundary}--${CRLF}`,
    ]

    const body = Buffer.concat(parts.map(p => Buffer.isBuffer(p) ? p : Buffer.from(p)))

    // Upload to Cloudinary
    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD}/auto/upload`,
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
        body: body,
      }
    )

    const data = await uploadRes.json()

    if (data.error) {
      throw new Error(data.error.message)
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success:  true,
        url:      data.secure_url,
        publicId: data.public_id,
      })
    }

  } catch (err) {
    console.error('Upload error:', err.message)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    }
  }
}

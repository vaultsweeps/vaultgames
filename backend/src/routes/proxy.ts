import { Router, Request, Response } from 'express'
import axios from 'axios'
import { logger } from '../utils/logger'

const router = Router()

// User-controlled query values end up inside the returned HTML/JS, so accept only what is valid
// and HTML-escape the rest (previously "amount" was injected into a script unvalidated).
const escapeHtml = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
// Body of the POST proxies: values are forwarded to a third-party gateway, so only well-formed ones are accepted
const cleanForm = (b: any) => ({
  is_pay: /^\d{1,2}$/.test(String(b?.is_pay ?? '')) ? String(b.is_pay) : '',
  amount: /^\d{1,7}(\.\d{1,2})?$/.test(String(b?.amount ?? '')) ? String(b.amount) : '',
  name: String(b?.name ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60),
})
// The gateway response decides where the browser is sent: only absolute https URLs are followed
const safeRedirect = (u: string | null) => (u && /^https:\/\/[^\s"'<>]{4,2000}$/i.test(u) ? u : null)
const DOLLARPAY_URL = 'https://check.dollarpay.vip/pay.php?uid=GaRrD'
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'

// 1. GET Proxy: Serve DollarPay checkout page but remove mobile restriction
router.get('/dollarpay-proxy', async (req: Request, res: Response) => {
  try {
    const amountRaw = typeof req.query.amount === 'string' ? req.query.amount : ''
    const amount = /^\d{1,7}(\.\d{1,2})?$/.test(amountRaw) ? amountRaw : ''
    const name = (typeof req.query.name === 'string' ? req.query.name : '').replace(/[\u0000-\u001f<>]/g, '').slice(0, 60)

    const response = await axios.get(DOLLARPAY_URL, {
      timeout: 15000,
      headers: { 'User-Agent': MOBILE_UA },
      responseType: 'text'
    })

    let html = response.data

    // Inject base tag so assets load correctly
    html = html.replace('<head>', '<head><base href="https://check.dollarpay.vip/">')

    // Change form action to submit to our POST proxy instead of directly to DollarPay
    html = html.replace(/action="\/pay\.php\?uid=GaRrD"/g, 'action="/api/proxy/dollarpay-proxy"')

    // Neutralize the mobile device check script
    html = html.replace(
      'var isMobile = /iPhone|iPod|iPad|Android|BlackBerry|BB10|Silk|Mobi|webOS|IEMobile|Opera Mini/i.test(userAgent);',
      'var isMobile = true;'
    )
    
    // Remove the redirect just in case
    html = html.replace("window.location.href = '/index.html';", "console.log('Bypassed mobile redirect');")

    // Pre-fill amount and name and auto-select Cash App (is_pay=1)
    if (amount) {
      html = html.replace(
        'const initialAmount = "";',
        () => `const initialAmount = "${amount}"; document.getElementById('is_pay').value = "1"; updateAmountOptions("${amount}");`
      )
    }
    if (name) {
      html = html.replace(
        'value="" required>',
        () => `value="${escapeHtml(name)}" required>`
      )
    }

    res.send(html)
  } catch (error: any) {
    logger.error(`DollarPay proxy GET error: ${error.message}`)
    res.status(500).send('Failed to load payment gateway')
  }
})

// 2. POST Proxy: Handle native form submission, extract redirectUrl, and redirect the user
router.post('/dollarpay-proxy', async (req: Request, res: Response) => {
  try {
    const { is_pay, amount, name } = cleanForm(req.body)

    if (!is_pay || !amount || !name) {
      return res.status(400).send('Missing required fields')
    }

    const formData = new URLSearchParams()
    formData.append('id', 'GaRrD')
    formData.append('is_pay', String(is_pay))
    formData.append('amount', String(amount))
    formData.append('name', String(name))

    const response = await axios.post(DOLLARPAY_URL, formData.toString(), {
      headers: {
        'User-Agent': MOBILE_UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': DOLLARPAY_URL,
        'Origin': 'https://check.dollarpay.vip'
      },
      maxRedirects: 5,
      timeout: 15000,
      validateStatus: () => true,
      responseType: 'text'
    })

    const html = (response.data || '') as string

    // Extract redirectUrl from response JS: const redirectUrl = "https://...";
    const redirectUrlMatch = html.match(/redirectUrl\s*=\s*["']([^"']+)["']/)
    let redirectUrl = safeRedirect(redirectUrlMatch ? redirectUrlMatch[1].replace(/\\\/|\\/g, '/') : null)

    if (redirectUrl) {
      logger.info(`[DollarPay Proxy] Redirecting user to: ${redirectUrl}`)
      return res.redirect(redirectUrl)
    }

    // Fallback if no redirect URL was generated
    return res.send(`
      <html>
        <body>
          <h2>Payment Processing</h2>
          <p>Your payment request has been submitted. If you were not redirected, please complete your payment on the gateway window.</p>
        </body>
      </html>
    `)
  } catch (error: any) {
    logger.error(`[DollarPay Proxy] Submit error: ${error.message}`)
    return res.status(500).send('Failed to communicate with DollarPay server')
  }
})

// 3. API Submit: For the modal (AJAX) - keeping it just in case
router.post('/dollarpay-submit', async (req: Request, res: Response) => {
  try {
    const { is_pay, amount, name } = cleanForm(req.body)
    if (!is_pay || !amount || !name) {
      return res.status(400).json({ success: false, message: 'Missing or invalid fields' })
    }

    const formData = new URLSearchParams()
    formData.append('id', 'GaRrD')
    formData.append('is_pay', String(is_pay))
    formData.append('amount', String(amount))
    formData.append('name', String(name))

    const response = await axios.post(DOLLARPAY_URL, formData.toString(), {
      headers: {
        'User-Agent': MOBILE_UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': DOLLARPAY_URL,
        'Origin': 'https://check.dollarpay.vip'
      }
    })

    const html = (response.data || '') as string
    const redirectUrlMatch = html.match(/redirectUrl\s*=\s*["']([^"']+)["']/)
    let redirectUrl = safeRedirect(redirectUrlMatch ? redirectUrlMatch[1].replace(/\\\/|\\/g, '/') : null)

    return res.json({ success: true, redirectUrl })
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to communicate with DollarPay server' })
  }
})

export default router

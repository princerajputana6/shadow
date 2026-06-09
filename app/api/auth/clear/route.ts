import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Force-clear NextAuth cookies. Returns a 200 HTML page (NOT a redirect)
// because Safari and some other browsers ignore Set-Cookie headers on
// 3xx responses. A 200 with HTML + JS redirect reliably applies the cookie
// wipe, then navigates to /login.
const COOKIE_NAMES = [
  'authjs.session-token', '__Secure-authjs.session-token',
  'next-auth.session-token', '__Secure-next-auth.session-token',
  'authjs.csrf-token', '__Host-authjs.csrf-token',
  'next-auth.csrf-token', '__Host-next-auth.csrf-token',
  'authjs.callback-url', '__Secure-authjs.callback-url',
  'next-auth.callback-url', '__Secure-next-auth.callback-url'
]

const HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Clearing session…</title>
  <meta http-equiv="refresh" content="0; url=/login">
  <style>
    body { font-family: system-ui, sans-serif; background:#0a0a0b; color:#fafafa; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
    .card { text-align:center; opacity:0.8; }
    .spinner { width:24px; height:24px; border:2px solid #27272a; border-top-color:#fb923c; border-radius:50%; margin:0 auto 12px; animation:spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg) } }
    a { color:#fb923c; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <p>Clearing your session…</p>
    <p style="font-size:12px;opacity:0.6">Redirecting in a moment. <a href="/login">Click here if it doesn't redirect.</a></p>
  </div>
  <script>
    // Belt and braces — also clear any non-HttpOnly cookies via document.cookie
    document.cookie.split(';').forEach(c => {
      const eq = c.indexOf('=');
      const name = (eq > -1 ? c.substring(0, eq) : c).trim();
      document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
    });
    setTimeout(() => { window.location.replace('/login'); }, 50);
  </script>
</body>
</html>`

function clearAll(res: NextResponse) {
  for (const name of COOKIE_NAMES) {
    res.cookies.set(name, '', { path: '/', expires: new Date(0), httpOnly: true, sameSite: 'lax' })
  }
  return res
}

export async function GET() {
  const res = new NextResponse(HTML, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  })
  return clearAll(res)
}

export async function POST() {
  return clearAll(NextResponse.json({ ok: true }))
}

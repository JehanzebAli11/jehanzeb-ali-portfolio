// Serves the AI portfolio (the ai/ folder) at the root of ai.jehanzeb.xyz.
// A vercel.json rewrite cannot do this: Vercel serves a matching static file
// (the classic site's index.html, style.css) before it applies rewrites.
// Routing Middleware runs before that lookup. Every other host passes through.

export const config = {
  // shared assets keep their own paths; /ai/ itself is never rewritten twice
  matcher: '/((?!ai/|media/|fonts/|cv/|favicon\\.svg).*)',
};

export default function middleware(request) {
  try {
    const url = new URL(request.url);
    if (url.hostname !== 'ai.jehanzeb.xyz') return;
    url.pathname = '/ai' + (url.pathname === '/' ? '/' : url.pathname);
    return new Response(null, { headers: { 'x-middleware-rewrite': url.toString() } });
  } catch {
    // never break the site over the subdomain: fall through to normal serving
    return;
  }
}

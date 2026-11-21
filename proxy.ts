import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';
import { CLIENT_SESSION_COOKIE, verifyClientSessionToken } from '@/lib/auth/session-token';

const adminMiddleware = auth.middleware({
  loginUrl: '/admin/login',
  publicRoutes: ['/admin/login'],
});

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const portalRoute = pathname === '/portal' || pathname.startsWith('/portal/');
  const merchantApiRoute = pathname.startsWith('/api/merchant/');

  if (portalRoute && pathname !== '/portal/login') {
    const token = request.cookies.get(CLIENT_SESSION_COOKIE)?.value;
    const session = await verifyClientSessionToken(token);
    if (!session) return NextResponse.redirect(new URL('/portal/login', request.url));
    return NextResponse.next();
  }

  if (merchantApiRoute) {
    const token = request.cookies.get(CLIENT_SESSION_COOKIE)?.value;
    const session = await verifyClientSessionToken(token);
    if (!session) return NextResponse.json({ error: 'Sesión de cliente requerida.' }, { status: 401 });
    return NextResponse.next();
  }

  return adminMiddleware(request);
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/portal/:path*', '/api/merchant/:path*'],
};

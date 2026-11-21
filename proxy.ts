import { auth } from '@/lib/auth/server';

export default auth.middleware({
  loginUrl: '/login',
  // Customer routes use ARCREDIX's independent signed identifier cookie.
  // Their pages and API handlers enforce membership and RLS themselves.
  publicRoutes: [
    '/',
    '/login',
    '/admin/login',
    '/admin',
    '/registro',
    '/api/health',
    '/api/public',
    '/api/auth/client-login',
    '/api/auth/client-logout',
    '/dashboard',
    '/dashboard/:path*',
    '/api/merchant/:path*',
  ],
});

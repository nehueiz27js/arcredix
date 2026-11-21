import { auth } from '@/lib/auth/server';

export default auth.middleware({
  loginUrl: '/login',
  publicRoutes: ['/', '/login', '/admin/login', '/admin', '/registro', '/api/health', '/api/public', '/api/auth/client-login'],
});

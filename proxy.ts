import { auth } from '@/lib/auth/server';

export default auth.middleware({
  loginUrl: '/login',
  publicRoutes: ['/', '/login', '/admin/login', '/registro', '/api/health', '/api/public'],
});

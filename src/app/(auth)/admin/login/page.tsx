import Link from 'next/link';

import { AuthForm } from '@/components/auth/auth-form';
import { Brand } from '@/components/landing/brand';

export default function AdminLoginPage() {
  return (
    <main className='auth-shell'>
      <section className='auth-card auth-card-functional'>
        <Brand />
        <span className='section-kicker'>ACCESO RESTRINGIDO</span>
        <h1>Superadministración.</h1>
        <p>Ingresá con las credenciales administrativas de ARCREDIX.</p>
        <AuthForm mode='login' />
        <div className='mt-5 text-center'>
          <Link className='text-sm text-slate-400 hover:text-emerald-300' href='/login'>Volver al acceso de comercios</Link>
        </div>
      </section>
    </main>
  );
}

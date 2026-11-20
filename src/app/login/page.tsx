import Link from 'next/link';

import { AuthForm } from '@/components/auth/auth-form';
import { Brand } from '@/components/landing/brand';

export default function LoginPage() {
  return (
    <main className='auth-shell'>
      <section className='auth-card auth-card-functional'>
        <Brand />
        <span className='section-kicker'>ACCESO A LA PLATAFORMA</span>
        <h1>Ingresá a tu comercio.</h1>
        <p>Accedé al panel de control de cobros, cajas y movimientos de tu comercio.</p>
        <AuthForm mode='login' />
        <Link className='auth-back-link' href='/'>Volver al sitio</Link>
      </section>
    </main>
  );
}

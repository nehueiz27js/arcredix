import Link from 'next/link';

import { AuthForm } from '@/components/auth/auth-form';
import { Brand } from '@/components/landing/brand';

export default function RegisterPage() {
  return (
    <main className='auth-shell'>
      <section className='auth-card auth-card-functional'>
        <Brand />
        <span className='section-kicker'>ALTA DE COMERCIOS</span>
        <h1>Empezá a proteger tus cobros.</h1>
        <p>Creá tu acceso y registrá los datos básicos del comercio. La cuenta quedará pendiente de activación comercial.</p>
        <AuthForm mode='register' />
        <Link className='auth-back-link' href='/'>Volver al sitio</Link>
      </section>
    </main>
  );
}

import Link from 'next/link';

import { ClientAccessForm } from '@/components/auth/client-access-form';
import { Brand } from '@/components/landing/brand';

export default function LoginPage() {
  return (
    <main className='auth-shell'>
      <section className='auth-card auth-card-functional'>
        <Brand />
        <span className='section-kicker'>ACCESO A LA PLATAFORMA</span>
        <h1>Ingresá a tu comercio.</h1>
        <p>Usá el identificador de acceso que te entregó el administrador de tu comercio.</p>
        <ClientAccessForm />
        <Link className='auth-back-link' href='/'>Volver al sitio</Link>
      </section>
    </main>
  );
}

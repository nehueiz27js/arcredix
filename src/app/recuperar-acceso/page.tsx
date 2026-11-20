import { Brand } from '@/components/landing/brand';
import { PasswordReset } from '@/components/auth/password-reset';

export default function RecoverAccessPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card auth-card-functional">
        <Brand />
        <span className="section-kicker">ACCESO ADMINISTRATIVO</span>
        <h1>Configurá tu acceso.</h1>
        <p>Te enviaremos un enlace seguro para establecer o recuperar la contraseña de tu cuenta.</p>
        <PasswordReset mode="request" />
      </section>
    </main>
  );
}

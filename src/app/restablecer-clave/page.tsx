import { Brand } from '@/components/landing/brand';
import { PasswordReset } from '@/components/auth/password-reset';

export default function ResetPasswordPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card auth-card-functional">
        <Brand />
        <span className="section-kicker">SEGURIDAD DE LA CUENTA</span>
        <h1>Nueva contraseña.</h1>
        <p>El enlace es de un solo uso y puede vencer. Elegí una contraseña segura que no utilices en otros servicios.</p>
        <PasswordReset mode="reset" />
      </section>
    </main>
  );
}

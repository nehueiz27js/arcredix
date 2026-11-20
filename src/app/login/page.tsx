import Link from "next/link";
import { Brand } from "@/components/landing/brand";
export default function LoginPage() {
  return <main className="auth-shell"><div className="auth-card"><Brand/><span className="section-kicker">ACCESO A LA PLATAFORMA</span><h1>Ingresá a tu comercio.</h1><p>El acceso al portal estará disponible cuando terminemos de integrar autenticación y gestión de cuentas.</p><Link className="button" href="/">Volver al sitio</Link></div></main>;
}

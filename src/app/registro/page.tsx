import Link from "next/link";
import { Brand } from "@/components/landing/brand";
export default function RegisterPage() {
  return <main className="auth-shell"><div className="auth-card"><Brand/><span className="section-kicker">ALTA DE COMERCIOS</span><h1>Empezá a proteger tus cobros.</h1><p>El registro de comercios se habilitará cuando estén listas las cuentas, los planes y el proceso de alta.</p><Link className="button" href="/#planes">Consultar planes</Link></div></main>;
}

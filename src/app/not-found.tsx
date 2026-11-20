import Link from "next/link";
import { Brand } from "@/components/landing/brand";
export default function NotFound(){return <main className="not-found"><Brand/><h1>Esta página no está disponible.</h1><p>Volvé al inicio de ARCREDIX.</p><Link className="button" href="/">Ir al inicio</Link></main>}

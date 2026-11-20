import type { Metadata } from "next";
import "./globals.css";
import "./arcredix-demo.css";

export const metadata: Metadata = {
  title: "ARCREDIX | Validá tus cobros. Evitá estafas.",
  description: "Separá comprobantes de ingresos acreditados. Organizá cobros, cajas y proveedores de pago con ARCREDIX.",
  applicationName: "ARCREDIX",
  keywords: [
    "validación de transferencias",
    "comprobantes falsos",
    "seguridad para comercios",
    "control de cobros",
    "antiestafas",
    "cajas y QR de cobro",
  ],
  openGraph: {
    title: "ARCREDIX | Validá tus cobros. Evitá estafas.",
    description: "La tranquilidad de distinguir un comprobante de un ingreso realmente recibido.",
    type: "website",
    locale: "es_AR",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es-AR"><body>{children}</body></html>;
}

import Link from "next/link";
import {
  ArrowDown, ArrowRight, AudioLines, BadgeCheck, Banknote, BellRing,
  Building2, Check, CheckCircle2, ChevronDown, Clock3, Fingerprint,
  LockKeyhole, QrCode, ScanLine, ShieldAlert, ShieldCheck, Smartphone,
  WalletCards, Zap,
} from "lucide-react";
import { Brand } from "@/components/landing/brand";
import { PaymentDemo } from "@/components/landing/payment-demo";

const plans = [
  {
    name: "Starter",
    price: "15",
    description: "Control de cobros para comercios que están empezando.",
    connections: "Hasta 3 conexiones bancarias o proveedores de pago",
    features: [
      "1 comercio y caja inicial",
      "Hasta 3 conexiones",
      "Avisos de ingresos recibidos",
      "Control de operaciones duplicadas",
      "Historial de movimientos",
    ],
  },
  {
    name: "Growth",
    price: "29",
    description: "Más capacidad para comercios con varias cuentas y cajas.",
    featured: true,
    connections: "Hasta 5 conexiones bancarias o proveedores de pago",
    features: [
      "Varias cajas y usuarios",
      "Hasta 5 conexiones",
      "Lectura asistida de comprobantes (OCR)",
      "Historial y reportes ampliados",
      "Exportación de movimientos",
    ],
  },
  {
    name: "Business",
    price: "55",
    description: "Control centralizado y herramientas avanzadas de cobro.",
    connections: "Conexiones ilimitadas",
    features: [
      "Múltiples cajas y sucursales",
      "Conexiones ampliadas",
      "QR compartido o exclusivo por caja",
      "Replicación de QR oficial entre cajas",
      "Conciliación e historial descargable",
      "Auditoría y alertas avanzadas",
    ],
  },
];

const faqs = [
  [
    "¿ARCREDIX confirma que el dinero llegó realmente?",
    "La confirmación real requiere una integración habilitada con el banco o proveedor de pagos y la recepción de datos auténticos de la operación. Un comprobante, una captura o el escaneo de un QR no acreditan por sí solos que el dinero haya llegado.",
  ],
  [
    "¿Qué diferencia hay entre un comprobante y un ingreso recibido?",
    "El comprobante es un archivo que presenta una persona. El ingreso recibido es una operación informada por una fuente financiera conectada y confiable. ARCREDIX debe mantenerlos separados: solo una confirmación financiera válida puede habilitar el flujo de autorización de entrega.",
  ],
  [
    "¿Puedo usar una misma cuenta de Mercado Pago en varias cajas?",
    "Sí. Una conexión corresponde a una cuenta o proveedor conectado, no a cada caja ni a cada QR. Una misma cuenta puede utilizarse desde varias cajas, de acuerdo con las funciones habilitadas en el plan.",
  ],
  [
    "¿Puedo tener un QR distinto por caja o compartir uno?",
    "El plan Business contempla QR oficial compartido o exclusivo por caja y opciones de replicación. La disponibilidad y vigencia del QR dependen del proveedor de pagos; ARCREDIX no puede garantizar que un proveedor nunca lo revoque.",
  ],
  [
    "¿ARCREDIX reemplaza al banco o a Mercado Pago?",
    "No. ARCREDIX es una capa de control operativo. No procesa pagos ni custodia fondos y depende de las integraciones y permisos que ofrezcan los proveedores financieros.",
  ],
];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <div className="container nav-wrap">
          <Brand />
          <nav className="desktop-nav" aria-label="Navegación principal">
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#funciones">Funciones</a>
            <a href="#qr-cajas">QR y cajas</a>
            <a href="#planes">Planes</a>
            <a href="#preguntas">Preguntas frecuentes</a>
          </nav>
          <div className="nav-actions">
            <Link className="nav-login" href="/login">Ingresar</Link>
            <a className="button button-small" href="#planes">Ver planes <ArrowRight size={15} /></a>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="container hero-layout">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-icon"><ShieldCheck size={14} /></span> CONTROL INTELIGENTE DE COBROS</div>
            <h1>El comprobante no alcanza. <span>Verificá que el dinero llegó.</span></h1>
            <p className="hero-lead">Separá los archivos que te envían tus clientes de los ingresos realmente recibidos. Más control para cada caja, cada transferencia y cada entrega.</p>
            <div className="hero-buttons">
              <a className="button" href="#planes">Conocer los planes <ArrowRight size={17} /></a>
              <a className="button button-ghost" href="#demo"><span className="play-icon">▶</span> Ver demostración</a>
            </div>
            <div className="hero-proof">
              <div className="proof-avatars"><span>✓</span><span>✓</span><span>✓</span></div>
              <p><strong>Comprobantes e ingresos, por separado.</strong><br />La entrega depende de una confirmación financiera válida.</p>
            </div>
          </div>
          <div className="hero-visual">
            <div className="visual-glow" /><div className="orbit orbit-one" /><div className="orbit orbit-two" />
            <div className="hero-shield"><ShieldCheck size={86} strokeWidth={1.15} /></div>
            <div className="floating-chip chip-top"><span className="chip-check"><Check size={13} /></span><span><strong>Ingreso detectado</strong><small>Fuente financiera conectada</small></span></div>
            <div className="floating-chip chip-bottom"><AudioLines size={19} /><span><strong>Estado en caja</strong><small>Información clara para el equipo</small></span><span className="sound-bars"><i /><i /><i /><i /></span></div>
            <div className="visual-caption">TECNOLOGÍA PARA COBROS MÁS SEGUROS</div>
          </div>
        </div>
        <div className="container hero-bottom"><span>UNA NUEVA FORMA DE CONTROLAR TUS COBROS</span><a href="#problema">Descubrí cómo funciona <ArrowDown size={14} /></a></div>
      </section>

      <section className="problem-section section-pad" id="problema">
        <div className="container problem-layout">
          <div>
            <div className="section-kicker">EL RIESGO ES REAL</div>
            <h2>Una captura de pantalla <span>no confirma un pago.</span></h2>
            <p className="section-lead">Los comprobantes pueden editarse, reutilizarse o mostrar operaciones que nunca impactaron en tu cuenta. La caja necesita distinguir una imagen presentada de un ingreso confirmado por el proveedor financiero.</p>
          </div>
          <div className="risk-list">
            <div className="risk-item"><div className="risk-icon"><ScanLine /></div><div><strong>Comprobantes adulterados</strong><p>Imágenes modificadas para simular transferencias inexistentes.</p></div><ShieldAlert className="risk-alert" /></div>
            <div className="risk-item"><div className="risk-icon"><Fingerprint /></div><div><strong>Comprobantes reutilizados</strong><p>Una misma operación presentada más de una vez en el mostrador.</p></div><ShieldAlert className="risk-alert" /></div>
            <div className="risk-item"><div className="risk-icon"><Clock3 /></div><div><strong>Demoras y errores en caja</strong><p>Verificaciones manuales que frenan la atención y generan dudas.</p></div><ShieldAlert className="risk-alert" /></div>
          </div>
        </div>
      </section>

      <section className="how-section section-pad" id="como-funciona">
        <div className="container">
          <div className="section-heading centered">
            <div className="section-kicker">SIMPLE PARA TU EQUIPO</div>
            <h2>Cuatro pasos. <span>Más seguridad en cada venta.</span></h2>
            <p>ARCREDIX organiza las señales de cobro y ayuda al equipo a actuar sobre información verificable.</p>
          </div>
          <div className="steps-grid">
            <article className="step-card"><span className="step-number">01</span><div className="step-icon"><WalletCards /></div><h3>El cliente paga</h3><p>Tu comprador transfiere al alias, cuenta o QR oficial del comercio.</p></article>
            <article className="step-card"><span className="step-number">02</span><div className="step-icon"><Zap /></div><h3>Se recibe una señal</h3><p>Una integración financiera habilitada informa una operación recibida.</p></article>
            <article className="step-card"><span className="step-number">03</span><div className="step-icon"><BellRing /></div><h3>La caja la identifica</h3><p>El cajero ve el remitente, el importe y el estado de la operación.</p></article>
            <article className="step-card"><span className="step-number">04</span><div className="step-icon"><BadgeCheck /></div><h3>Validás y autorizás</h3><p>La operación se registra y puede habilitar la entrega según las reglas configuradas.</p></article>
          </div>
          <div className="how-note"><LockKeyhole size={17} /><span>Un comprobante subido nunca equivale a dinero acreditado. La autorización real depende de una confirmación auténtica de una fuente financiera integrada.</span></div>
        </div>
      </section>

      <section className="demo-section section-pad" id="demo">
        <div className="container demo-layout">
          <div className="demo-copy">
            <div className="section-kicker">PROBALO VOS MISMO</div>
            <h2>Ingresos simulados y comprobantes. <span>Dos registros diferentes.</span></h2>
            <p className="section-lead">La demostración muestra cinco ingresos informados por una fuente financiera simulada y diez comprobantes adjuntos. Los importes se muestran en pesos argentinos (ARS). Solo los ingresos simulados aparecen como movimientos disponibles para validar.</p>
            <ul className="check-list">
              <li><CheckCircle2 /> Remitente e importe de cada ingreso</li>
              <li><CheckCircle2 /> Comprobantes separados de los ingresos</li>
              <li><CheckCircle2 /> Autorización de entrega solo en el flujo de ingreso</li>
            </ul>
            <p className="demo-small-note">Entorno demostrativo: los datos son ficticios y no se consulta ningún banco, billetera ni cuenta real.</p>
          </div>
          <PaymentDemo />
        </div>
      </section>

      <section className="features-section section-pad" id="funciones">
        <div className="container">
          <div className="section-heading"><div className="section-kicker">UNA PLATAFORMA. MÁS CONTROL.</div><h2>Herramientas para <span>la operación diaria.</span></h2><p>Una estructura preparada para crecer desde una caja hasta múltiples sucursales.</p></div>
          <div className="features-grid">
            <article className="feature-card feature-large"><div className="feature-icon"><BellRing /></div><h3>Alertas de ingresos</h3><p>Visualizá los ingresos informados por las fuentes financieras conectadas, sin confundirlos con archivos adjuntos.</p><div className="mini-feed"><div><span className="feed-dot" /><span>Ingreso informado</span><strong>$ 32.000 ARS</strong></div><div><span className="feed-dot" /><span>Ingreso informado</span><strong>$ 8.500 ARS</strong></div><div><span className="feed-dot" /><span>Comprobante adjunto</span><strong>Sin acreditar</strong></div></div></article>
            <article className="feature-card"><div className="feature-icon"><AudioLines /></div><h3>Confirmación por voz</h3><p>El equipo puede escuchar el importe y el estado de una operación.</p></article>
            <article className="feature-card"><div className="feature-icon"><ScanLine /></div><h3>Lectura de comprobantes</h3><p>OCR para extraer datos y comparar información, sin tratar una imagen como acreditación.</p></article>
            <article className="feature-card"><div className="feature-icon"><Fingerprint /></div><h3>Control de doble uso</h3><p>Registro de operaciones validadas y alertas ante intentos de reutilización.</p></article>
            <article className="feature-card"><div className="feature-icon"><Building2 /></div><h3>Cajas y sucursales</h3><p>Administrá usuarios, puntos de cobro y permisos desde una estructura centralizada.</p></article>
            <article className="feature-card"><div className="feature-icon"><Banknote /></div><h3>Historial y reportes</h3><p>Consultá movimientos registrados y prepará cierres de caja.</p></article>
          </div>
        </div>
      </section>

      <section className="how-section section-pad" id="qr-cajas">
        <div className="container">
          <div className="section-heading centered"><div className="section-kicker">COBROS ORGANIZADOS</div><h2>Una cuenta. <span>Varias cajas.</span></h2><p>La conexión identifica la cuenta del proveedor; las cajas organizan quién cobra y desde dónde opera.</p></div>
          <div className="features-grid qr-feature-grid">
            <article className="feature-card"><div className="feature-icon"><QrCode /></div><h3>QR compartido</h3><p>Varias cajas pueden utilizar el mismo QR oficial del comercio, cuando el proveedor lo permita.</p></article>
            <article className="feature-card"><div className="feature-icon"><Smartphone /></div><h3>QR exclusivo por caja</h3><p>Asigná un QR oficial distinto a cada punto de cobro para mejorar la organización.</p></article>
            <article className="feature-card"><div className="feature-icon"><Building2 /></div><h3>Una conexión, varias cajas</h3><p>La misma cuenta conectada puede utilizarse en distintas cajas. Las cajas y los QR no consumen conexiones adicionales.</p></article>
          </div>
          <div className="how-note"><LockKeyhole size={17} /><span>Los QR deben provenir del proveedor de pagos. Su vigencia, disponibilidad y posibilidad de reutilización dependen de ese proveedor; ARCREDIX no inventa ni reemplaza códigos oficiales.</span></div>
        </div>
      </section>

      <section className="plans-section section-pad" id="planes">
        <div className="container">
          <div className="section-heading centered">
            <div className="section-kicker">ELEGÍ TU NIVEL DE CONTROL</div>
            <h2>Un plan para cada <span>etapa de tu comercio.</span></h2>
            <p>Los límites se aplican a conexiones de cuentas o proveedores, no a cada caja ni a cada QR.</p>
            <span className="price-note">Precios de referencia en USD · Valores sujetos a confirmación comercial e impuestos aplicables</span>
          </div>
          <div className="plans-grid">
            {plans.map((plan) => (
              <article className={`plan-card ${plan.featured ? "plan-featured" : ""}`} key={plan.name}>
                {plan.featured && <div className="popular-tag">MÁS ELEGIDO</div>}
                <div className="plan-name">{plan.name}</div>
                <p className="plan-description">{plan.description}</p>
                <div className="plan-price"><span>USD</span> {plan.price}<small> / mes</small></div>
                <p className="plan-setup">{plan.connections}</p>
                <a className={plan.featured ? "button" : "button button-outline"} href="mailto:ventas@arcredix.com?subject=Consulta%20por%20ARCREDIX">Consultar este plan <ArrowRight size={16} /></a>
                <div className="plan-divider" /><div className="includes-label">INCLUYE</div>
                <ul>{plan.features.map((feature) => <li key={feature}><Check size={16} />{feature}</li>)}</ul>
              </article>
            ))}
          </div>
          <div className="lifetime-card">
            <div><div className="lifetime-label">¿PREFERÍS UN PAGO ÚNICO?</div><h3>Licencia propia.</h3><p>Modalidad independiente de los planes mensuales, con infraestructura e implementación según alcance.</p></div>
            <div className="lifetime-price"><strong>USD 390</strong><span>Pago único · Alcance sujeto a propuesta</span><a href="mailto:ventas@arcredix.com?subject=Licencia%20propia%20ARCREDIX">Consultar licencia <ArrowRight size={15} /></a></div>
          </div>
        </div>
      </section>

      <section className="faq-section section-pad" id="preguntas">
        <div className="container faq-layout">
          <div><div className="section-kicker">PREGUNTAS FRECUENTES</div><h2>Antes de dar <span>el siguiente paso.</span></h2><p className="section-lead">Conocé qué hace ARCREDIX y qué depende de las integraciones financieras disponibles.</p></div>
          <div className="faq-list">{faqs.map(([question, answer]) => <details className="faq-item" key={question}><summary>{question}<ChevronDown size={18} /></summary><p>{answer}</p></details>)}</div>
        </div>
      </section>

      <section className="final-cta"><div className="container final-cta-inner"><div className="cta-orb"><ShieldCheck size={43} /></div><div><div className="section-kicker">CADA COBRO CUENTA</div><h2>Validá tus cobros. <span>Evitá estafas.</span></h2><p>Más claridad para tu equipo antes de entregar cada pedido.</p></div><a className="button" href="#planes">Conocer los planes <ArrowRight size={17} /></a></div></section>

      <footer className="site-footer">
        <div className="container footer-main">
          <div className="footer-brand"><Brand /><p>Validá tus cobros. Evitá estafas.</p><small>Una herramienta de control operativo para comercios.</small></div>
          <div className="footer-column"><strong>Plataforma</strong><a href="#como-funciona">Cómo funciona</a><a href="#funciones">Funciones</a><a href="#qr-cajas">QR y cajas</a><a href="#planes">Planes</a></div>
          <div className="footer-column"><strong>Ayuda</strong><a href="#preguntas">Preguntas frecuentes</a><a href="mailto:ventas@arcredix.com">Contacto comercial</a></div>
          <div className="footer-column"><strong>Acceso</strong><Link href="/login">Ingresar</Link><Link href="/registro">Crear cuenta</Link></div>
        </div>
        <div className="container footer-bottom"><span>© {new Date().getFullYear()} ARCREDIX. Todos los derechos reservados.</span><span>No procesa pagos ni custodia fondos. Las confirmaciones dependen de fuentes financieras integradas.</span></div>
      </footer>
    </main>
  );
}

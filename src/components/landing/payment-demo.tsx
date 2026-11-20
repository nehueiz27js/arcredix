"use client";

import { useState } from "react";
import { AudioLines, Check, CheckCircle2, FileImage, RotateCcw, ShieldAlert, Volume2 } from "lucide-react";

type Transfer = {
  id: string;
  sender: string;
  amount: number;
  time: string;
  destination: string;
};

const initialTransfers: Transfer[] = [
  { id: "TR-1051", sender: "María González", amount: 48500, time: "13:42", destination: "Caja 1" },
  { id: "TR-1052", sender: "Lucas Fernández", amount: 32000, time: "13:40", destination: "Caja 2" },
  { id: "TR-1053", sender: "Sofía Ramírez", amount: 8500, time: "13:37", destination: "Caja 1" },
  { id: "TR-1054", sender: "Julián Pérez", amount: 12700, time: "13:34", destination: "Caja 3" },
  { id: "TR-1055", sender: "Camila Torres", amount: 64000, time: "13:31", destination: "Caja 2" },
];

const money = (amount: number) => new Intl.NumberFormat("es-AR", {
  style: "currency", currency: "ARS", maximumFractionDigits: 0,
}).format(amount);

export function PaymentDemo() {
  const [transfers, setTransfers] = useState(initialTransfers);
  const [authorized, setAuthorized] = useState<string[]>([]);
  const [voice, setVoice] = useState(true);

  function announce(message: string) {
    if (!voice || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "es-AR";
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  }

  function authorize(transfer: Transfer) {
    if (authorized.includes(transfer.id)) return;
    setAuthorized((current) => [...current, transfer.id]);
    const spokenAmount = new Intl.NumberFormat("es-AR", {
      maximumFractionDigits: 0,
    }).format(transfer.amount);
    announce(
      `Pedido autorizado para entregar. Ingreso simulado de ${spokenAmount} pesos argentinos, recibido de ${transfer.sender}.`,
    );
  }

  function reset() {
    window.speechSynthesis?.cancel();
    setTransfers(initialTransfers);
    setAuthorized([]);
  }

  return (
    <div className="demo-card payment-demo-v2">
      <div className="demo-topline"><span className="live-dot" /> ENTORNO DE DEMOSTRACIÓN <span className="demo-live">DATOS FICTICIOS</span></div>
      <div className="demo-summary-grid">
        <div><span>INGRESOS INFORMADOS</span><strong>{transfers.length}</strong><small>Fuente financiera simulada</small></div>
        <div><span>COMPROBANTES ADJUNTOS</span><strong>10</strong><small>No acreditan fondos</small></div>
      </div>
      <div className="demo-separation-note"><ShieldAlert size={16} /><span>Solo se muestran como ingresos las 5 transferencias simuladas. Los 10 archivos adjuntos no se convierten en pagos.</span></div>
      <div className="demo-list-heading"><strong>Ingresos recibidos</strong><span>Ordenados por recepción</span></div>
      <div className="demo-transfer-list">
        {transfers.map((transfer) => {
          const isAuthorized = authorized.includes(transfer.id);
          return (
            <article className={`demo-transfer ${isAuthorized ? "demo-transfer-authorized" : ""}`} key={transfer.id}>
              <div className="demo-transfer-main">
                <div className="demo-transfer-icon"><CheckCircle2 size={17} /></div>
                <div className="demo-transfer-person"><strong>{transfer.sender}</strong><small>{transfer.id} · {transfer.destination} · {transfer.time}</small></div>
                <strong className="demo-transfer-amount">{money(transfer.amount)}</strong>
              </div>
              {isAuthorized ? (
                <div className="demo-authorized-state"><CheckCircle2 size={15} /><span><strong>Pedido autorizado para entregar</strong><small>Simulación: operación marcada como utilizada</small></span></div>
              ) : (
                <button className="demo-primary demo-transfer-action" onClick={() => authorize(transfer)}>
                  Validar ingreso <Check size={15} />
                </button>
              )}
            </article>
          );
        })}
      </div>
      <div className="demo-receipts">
        <div className="demo-receipts-icon"><FileImage size={17} /></div>
        <div><strong>10 comprobantes adjuntos</strong><small>Archivos recibidos · No son confirmación de pago</small></div>
        <span className="demo-receipts-status">Sin acreditar</span>
      </div>
      <div className="demo-actions demo-actions-footer">
        <span className="demo-voice-label"><AudioLines size={15} /> Avisos por voz</span>
        <button className="demo-icon-button" onClick={() => setVoice(!voice)} aria-label={voice ? "Desactivar voz" : "Activar voz"} title={voice ? "Voz activada" : "Voz desactivada"}><Volume2 size={17} style={{ opacity: voice ? 1 : 0.45 }} /></button>
        <button className="demo-icon-button" onClick={reset} aria-label="Reiniciar demostración" title="Reiniciar"><RotateCcw size={17} /></button>
      </div>
      <p className="demo-disclaimer">Simulación interactiva. No consulta bancos ni acredita fondos reales. En producción, esta acción solo se habilitará tras validar una notificación auténtica del proveedor financiero.</p>
    </div>
  );
}

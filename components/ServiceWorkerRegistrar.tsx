"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Registra il service worker e mostra lo stato "offline".
 *
 * Il banner non è decorativo: offline la board è in sola lettura, e chi la usa
 * deve saperlo prima di provare a salvare una prenotazione.
 */
export function ServiceWorkerRegistrar() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* niente offline: l'app resta comunque pienamente funzionante online */
      });
    }

    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="offline-banner no-print" role="status">
      <WifiOff size={15} /> Offline — stai vedendo l&apos;ultimo stato salvato. Le modifiche non
      vengono inviate finché non torna la rete.
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    function onOffline() { setOffline(true); }
    function onOnline() { setOffline(false); }
    setOffline(!navigator.onLine);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
      background: "#7f1d1d", color: "#fecaca",
      padding: "10px 16px",
      textAlign: "center", fontSize: 14, fontWeight: 600,
      paddingTop: "calc(10px + env(safe-area-inset-top))",
    }}>
      No internet connection — please check your network
    </div>
  );
}

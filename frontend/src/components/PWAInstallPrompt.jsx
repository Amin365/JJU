
import { useEffect, useState } from "react";

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault(); // stop auto browser popup
      setDeferredPrompt(e);
      setVisible(true);   // show banner
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;

    setDeferredPrompt(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={styles.container}>
      <span>Install JJU Reading Club App</span>
      <button onClick={installApp} style={styles.button}>
        Install
      </button>
    </div>
  );
}

const styles = {
  container: {
    position: "fixed",
    bottom: 20,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#0f172a",
    color: "#fff",
    padding: "12px 16px",
    borderRadius: "10px",
    display: "flex",
    gap: "12px",
    alignItems: "center",
    zIndex: 9999,
  },
  button: {
    background: "#fff",
    color: "#0f172a",
    border: "none",
    padding: "6px 12px",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
  },
};

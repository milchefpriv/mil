import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";

import AuthGate from "./AuthGate";
import "./globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthGate />
    <Toaster position="top-right" richColors closeButton />
  </StrictMode>,
);

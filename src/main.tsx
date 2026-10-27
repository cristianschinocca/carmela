import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { MotionProvider } from "./motion";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionProvider>
      <App />
    </MotionProvider>
  </StrictMode>,
);

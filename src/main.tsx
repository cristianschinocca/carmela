import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { MotionProvider } from "./motion";
import "./styles/base.css";
import "./styles/shadcn.css";
import "./styles/products.css";
import "./styles/team.css";
import "./styles/workspace.css";
import "./styles/public-menu.css";
import "./styles/cash.css";
import "./styles/dialogs.css";
import "./styles/refinements.css";
import "./styles/stock.css";
import "./pos/table-pos.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionProvider>
      <App />
    </MotionProvider>
  </StrictMode>,
);

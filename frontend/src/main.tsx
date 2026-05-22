import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { NeroPartyProvider } from "./party";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <NeroPartyProvider>
      <App />
    </NeroPartyProvider>
  </React.StrictMode>
);

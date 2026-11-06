import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import SecureApp from "./SecureApp";
import { Routes, Route } from "react-router-dom";
import "./styles.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/preview/*" element={<App />} />
        <Route path="*" element={<SecureApp />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);

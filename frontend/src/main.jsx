import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppBootstrap } from "@/app/app-bootstrap";
import { AppRoutes } from "@/app/router";
import "@/app/styles/index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
    throw new Error("Root element #root was not found.");
}

ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
        <BrowserRouter>
            <AppBootstrap />
            <AppRoutes />
        </BrowserRouter>
    </React.StrictMode>,
);

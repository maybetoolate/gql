import React from "react";
import ReactDOM from "react-dom/client";
import { ApolloProvider } from "@apollo/client";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./auth";
import { LanguageProvider } from "./i18n";
import { client } from "./apollo-client";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LanguageProvider>
      <ApolloProvider client={client}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ApolloProvider>
    </LanguageProvider>
  </React.StrictMode>,
);

// web/frontend/App.jsx
import { BrowserRouter } from "react-router-dom";
import { NavMenu } from "@shopify/app-bridge-react";
import Routes from "./Routes";

import { QueryProvider, PolarisProvider } from "./components";

export default function App() {
  // Any .tsx or .jsx files in /pages will become a route
  // See documentation for <Routes /> for more info
  const pages = import.meta.glob("./pages/**/!(*.test.[jt]sx)*.([jt]sx)", {
    eager: true,
  });

  return (
    <PolarisProvider>
      <BrowserRouter>
        <QueryProvider>
          <NavMenu>
            <a href="/" rel="home" />
            <a href="/country-blocker" rel="country-blocker">
              Country Management
            </a>
            <a href="/ip-blocker" rel="ip-blocker">
              IP Management
            </a>
            <a href="/bot-blocker" rel="bot-blocker">
              Bot Management
            </a>
            <a href="/content-protection" rel="content-protection">
              Content Protection
            </a>
            <a href="/analytics" rel="analytics">
              Analytics & Insights
            </a>
          </NavMenu>
          <Routes pages={pages} />
        </QueryProvider>
      </BrowserRouter>
    </PolarisProvider>
  );
}
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import appCss from "~/styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ORBIS.ID — Your identity. Yours alone." },
      {
        name: "description",
        content:
          "ORBIS.ID is a member-owned self-sovereign identity platform. One verifiable digital ID — no surveillance, no data honeypot, and the ability to prove anything about yourself without disclosing personal data.",
      },
      { name: "theme-color", content: "#0B1020" },
      { property: "og:title", content: "ORBIS.ID — Your identity. Yours alone." },
      {
        property: "og:description",
        content: "Member-owned self-sovereign identity. Prove anything about yourself — without showing everything.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/og/og-banner.svg" },
      { property: "og:url", content: "https://orbis.id" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "ORBIS.ID — Your identity. Yours alone." },
      {
        name: "twitter:description",
        content: "Member-owned self-sovereign identity.",
      },
      { name: "twitter:image", content: "/og/og-banner.svg" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
    ],
  }),
  notFoundComponent: () => (
    <div className="min-h-dvh grid place-items-center text-center p-6">
      <div>
        <p className="eyebrow">404</p>
        <h1 className="display-2 mt-3">Off the orbit.</h1>
        <p className="lead mt-3">This page doesn't exist (yet).</p>
        <a href="/" className="btn btn-primary mt-6">Back to orbis.id</a>
      </div>
    </div>
  ),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-dvh antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

"use client";

import { SessionProvider } from "next-auth/react";

export default function SalesLayout({ children }) {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-muted/30">{children}</div>
    </SessionProvider>
  );
}

import "./globals.css";
import type { ReactNode } from "react";

import { AuthStatus } from "@/components/auth/auth-status";

export const metadata = {
  title: "Situate Editions",
  description: "World flash fiction, anchored to place.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthStatus />
        {children}
      </body>
    </html>
  );
}

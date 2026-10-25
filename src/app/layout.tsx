import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mineforge",
};

// Placeholder root layout (phase 0). The auth phase adds requireUser() here and
// the i18n phase sets `lang` from the active locale.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}

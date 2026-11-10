
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Klinik Antrean",
  description: "Sistem informasi pendaftaran dan antrean pasien klinik.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}

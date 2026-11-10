import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mi Secretaria IA",
  description: "Tu asistente personal para organizar tareas, proyectos y lo que de verdad importa.",
  applicationName: "Mi Secretaria IA",
  icons: { icon: "https://armandmu.github.io/recursos-web/favicon.png", shortcut: "https://armandmu.github.io/recursos-web/favicon.png" },
  manifest: "/manifest.webmanifest"
};
export const viewport: Viewport = {themeColor:"#19312e",width:"device-width",initialScale:1};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="es"><body>{children}</body></html>;
}

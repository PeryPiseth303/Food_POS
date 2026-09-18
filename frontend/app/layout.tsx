import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/store";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#f97316",
};

export const metadata: Metadata = {
  title: "Bistro Moderne | QR Table Ordering",
  description: "Fast, contactless digital menu and instant food ordering at your table.",
};

const antiFlickerScript = `
(function() {
  try {
    var p = window.location.pathname || '';
    var s = window.location.search || '';
    var key = 'delivery_theme';
    if (p.indexOf('/admin') === 0) {
      key = 'admin_theme';
    } else if (s.indexOf('table=') !== -1) {
      key = 'dinein_theme';
    } else {
      key = 'delivery_theme';
    }
    var t = localStorage.getItem(key) || 'light';
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: antiFlickerScript,
          }}
        />
      </head>
      <body className={`${inter.className} min-h-screen antialiased selection:bg-orange-500 selection:text-white`}>
        <ThemeProvider>
          <CartProvider>
            {children}
            <Toaster position="top-center" richColors closeButton />
          </CartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

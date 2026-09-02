import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import Script from "next/script";
import { BrandProvider } from "./components/BrandProvider";
import { StoreProvider } from "./components/StoreProvider";
import "./globals.css";

const sans = Source_Sans_3({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Online banking",
  description: "Personal banking with accounts, payments, and activity in one place.",
  applicationName: "Online banking",
  themeColor: "#0b1f3a",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/api/brand-icon?kind=logo", type: "image/png" }],
    apple: "/api/brand-icon?kind=logo",
  },
  appleWebApp: {
    capable: true,
    title: "Online banking",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} font-[family-name:var(--font-sans)] antialiased`} suppressHydrationWarning>
        <StoreProvider>
          <BrandProvider>{children}</BrandProvider>
        </StoreProvider>

        <Script id="smartsupp-widget" strategy="afterInteractive">
          {`
            var _smartsupp = _smartsupp || {};
            _smartsupp.key = '${process.env.NEXT_PUBLIC_SMARTSUPP_KEY}';
            window.smartsupp||(function(d) {
              var s,c,o=smartsupp=function(){ o._.push(arguments)};o._=[];
              s=d.getElementsByTagName('script')[0];c=d.createElement('script');
              c.type='text/javascript';c.charset='utf-8';c.async=true;
              c.src='https://www.smartsuppchat.com/loader.js?';s.parentNode.insertBefore(c,s);
            })(document);
          `}
        </Script>
      </body>
    </html>
  );
}
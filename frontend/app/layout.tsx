import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "workBoard",
  description: "A drawing canvas workboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem("workboard-theme");var t=s==="light"||s==="dark"?s:window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";var d=document.documentElement;d.dataset.theme=t;d.style.colorScheme=t}catch(e){}})()`,
          }}
        />
      </head>
      <body className="flex h-full flex-col">{children}</body>
    </html>
  );
}

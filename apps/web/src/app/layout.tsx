import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Biota ELN",
  description:
    "A molecular biology electronic lab notebook for modern workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeScript = `
    (function() {
      try {
        var stored = window.localStorage.getItem("biota-theme");
        var theme = stored === "paper" || stored === "mist" || stored === "obsidian"
          ? stored
          : "paper";
        document.documentElement.dataset.theme = theme;
      } catch (error) {
        document.documentElement.dataset.theme = "paper";
      }
    })();
  `;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}

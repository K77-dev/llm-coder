import type { Metadata } from 'next';
import { ThemeProvider } from '../components/ThemeProvider';
import { ToastProvider } from '../components/Toast';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Code LLM',
  description: 'Assistente de código especializado em Java, Node.js, React e Angular',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

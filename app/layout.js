import './globals.css';

export const metadata = {
  title: 'RŌXCOACH — The HYROX Coaching Operating System',
  description: 'The B2B SaaS coaching platform for HYROX coaches. Roster command centre, 8-station performance engine, and athlete mobile companion.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}

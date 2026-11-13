import './globals.css';

export const metadata = {
  title: 'Hyrox Tracker',
  description: 'Track Hyrox sessions for athletes and coaches.',
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

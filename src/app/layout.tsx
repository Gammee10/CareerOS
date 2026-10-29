export const metadata = {
  title: 'CareerOS',
  description: 'Your career search, organised.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

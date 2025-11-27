export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-900">{children}</body>
    </html>
  );
}
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Admin Sekolah SMPN 9",
  description: "Aplikasi Administrasi Sekolah",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className="antialiased text-gray-800">
        <Navbar />
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, LayoutDashboard, Users, GraduationCap, FileText, Settings } from 'lucide-react';
import { supabase } from '@/utils/supabase';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const confirmLogout = confirm("Apakah Anda yakin ingin keluar?");
    if (confirmLogout) {
      await supabase.auth.signOut();
      router.push('/');
    }
  };

  const menus = [
    { name: 'Home', href: '/dashboard', icon: <LayoutDashboard size={20}/> },
    { name: 'Pegawai', href: '/dashboard/pegawai', icon: <Users size={20}/> },
    { name: 'Siswa', href: '/dashboard/siswa', icon: <GraduationCap size={20}/> },
    { name: 'Laporan', href: '/dashboard/laporan', icon: <FileText size={20}/> },
    { name: 'Setting', href: '/dashboard/setting', icon: <Settings size={20}/> },
  ];

  if (pathname === '/') return null;

  return (
    <>
      {/* --- DESKTOP HEADER --- */}
      <nav className="hidden md:block bg-blue-800 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="bg-white p-1 rounded-full text-blue-800 font-bold w-8 h-8 flex items-center justify-center">A</div>
              <span className="font-bold text-lg tracking-wide">ADMIN SMPN 9</span>
            </div>

            <div className="flex items-center space-x-2">
              {menus.map((menu) => (
                <Link 
                  key={menu.href} 
                  href={menu.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                    ${pathname === menu.href 
                      ? 'bg-blue-900 text-white shadow-inner' 
                      : 'text-blue-100 hover:bg-blue-700 hover:text-white'
                    }`}
                >
                  {menu.icon}
                  {menu.name}
                </Link>
              ))}
              {/* Perbaikan: w-[1px] menjadi w-px */}
              <div className="h-6 w-px bg-blue-700 mx-2"></div>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-md"
              >
                <LogOut size={16} /> Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* --- MOBILE BOTTOM NAV --- */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around items-center p-2 z-50 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
        {menus.map((menu) => (
          <Link 
            key={menu.href} 
            href={menu.href}
            // Perbaikan: min-w-[60px] menjadi min-w-15
            className={`flex flex-col items-center gap-1 p-2 min-w-15 transition-all rounded-xl
              ${pathname === menu.href ? 'text-blue-700 bg-blue-50' : 'text-gray-400'}`}
          >
            <div className={`${pathname === menu.href ? 'scale-110' : 'scale-100'} transition-transform`}>
              {menu.icon}
            </div>
            <span className="text-[9px] font-black uppercase tracking-tighter">{menu.name}</span>
          </Link>
        ))}
        {/* Tombol Logout Mobile */}
        <button 
          onClick={handleLogout}
          className="flex flex-col items-center gap-1 p-2 min-w-15 text-red-400"
        >
          <LogOut size={20} />
          <span className="text-[9px] font-black uppercase tracking-tighter">Keluar</span>
        </button>
      </div>

      <div className="md:hidden h-20"></div>
    </>
  );
}
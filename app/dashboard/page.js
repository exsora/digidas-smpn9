"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { Users, UserCheck, AlertCircle, Clock, TrendingUp } from "lucide-react";

export default function DashboardHome() {
  const [stats, setStats] = useState({ totalPegawai: 0, hadirHariIni: 0 });
  const [belumAbsen, setBelumAbsen] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // 1. Ambil Total Pegawai (Guru, BK, TU)
      const { count: total } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .in('role', ['guru', 'bk', 'tu']);

      // 2. Ambil Kehadiran Hari Ini
      const today = new Date().toISOString().split('T')[0];
      const { data: absenHariIni } = await supabase
        .from('absensi')
        .select('recorded_by')
        .gte('created_at', today);

      const uniqueHadir = [...new Set(absenHariIni?.map(a => a.recorded_by))];

      // 3. Cari Siapa yang Belum Absen
      const { data: allStaf } = await supabase
        .from('profiles')
        .select('full_name, role')
        .in('role', ['guru', 'bk', 'tu']);

      const listBelumAbsen = allStaf.filter(staf => 
        !absenHariIni?.some(absen => absen.recorded_by === staf.id)
      );

      setStats({
        totalPegawai: total || 0,
        hadirHariIni: uniqueHadir.length || 0
      });
      setBelumAbsen(listBelumAbsen);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-800 mb-8">Ringkasan Statistik SMPN 9 Palu</h1>

      {/* --- KARTU STATISTIK --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100 flex items-center gap-4">
          <div className="p-4 bg-blue-100 text-blue-600 rounded-xl"><Users size={30}/></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Pegawai</p>
            <h2 className="text-2xl font-bold">{stats.totalPegawai} Orang</h2>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-green-100 flex items-center gap-4">
          <div className="p-4 bg-green-100 text-green-600 rounded-xl"><UserCheck size={30}/></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Hadir Hari Ini</p>
            <h2 className="text-2xl font-bold">{stats.hadirHariIni} Staf</h2>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-orange-100 flex items-center gap-4">
          <div className="p-4 bg-orange-100 text-orange-600 rounded-xl"><TrendingUp size={30}/></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Persentase</p>
            <h2 className="text-2xl font-bold">
              {stats.totalPegawai > 0 ? ((stats.hadirHariIni / stats.totalPegawai) * 100).toFixed(1) : 0}%
            </h2>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* --- NOTIFIKASI BELUM ABSEN (BAGIAN 2) --- */}
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
          <div className="bg-red-50 p-4 border-b border-red-100 flex items-center justify-between">
            <h3 className="font-bold text-red-700 flex items-center gap-2">
              <AlertCircle size={18}/> Perlu Perhatian (Belum Absen)
            </h3>
            <span className="text-xs bg-red-200 text-red-800 px-2 py-1 rounded-full font-bold">
              {belumAbsen.length} Orang
            </span>
          </div>
          <div className="p-4 max-h-100 overflow-y-auto">
            {belumAbsen.length > 0 ? belumAbsen.map((staf, i) => (
              <div key={i} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg border-b last:border-0 text-sm">
                <div>
                  <p className="font-bold text-gray-800">{staf.full_name}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest">{staf.role}</p>
                </div>
                <div className="flex items-center gap-1 text-orange-500 font-medium italic">
                  <Clock size={14}/> Menunggu Absensi...
                </div>
              </div>
            )) : (
              <p className="text-center text-gray-400 py-10">Semua staf sudah melakukan absensi hari ini. ✅</p>
            )}
          </div>
        </div>

        {/* --- INFO TAMBAHAN / GRAFIK --- */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
             <TrendingUp size={40}/>
          </div>
          <h3 className="text-lg font-bold text-gray-800">Analisis Kehadiran</h3>
          <p className="text-gray-500 text-sm mt-2 max-w-xs">
            Gunakan menu <strong>Laporan</strong> untuk mengunduh rekapitulasi bulanan resmi bagi Guru, BK, dan TU.
          </p>
        </div>
      </div>
    </div>
  );
}
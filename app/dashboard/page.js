"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { Users, UserCheck, AlertCircle, Clock, TrendingUp, Loader2 } from "lucide-react";

export default function DashboardHome() {
  const [stats, setStats] = useState({ totalPegawai: 0, hadirHariIni: 0 });
  const [belumAbsen, setBelumAbsen] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      // 1. Ambil Semua Data Pegawai (Guru, BK, TU)
      const { data: allStaf, error: errStaf } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['guru', 'bk', 'tu']);

      if (errStaf) throw errStaf;

      // 2. Ambil Data Absensi Guru Hari Ini
      // Asumsi: kolom 'recorded_by' menyimpan ID Guru yang melakukan absen mandiri
      const { data: absenHariIni, error: errAbsen } = await supabase
        .from('absensi_guru') // Ganti ke tabel khusus absensi guru jika ada, atau tetap 'absensi'
        .select('user_id') 
        .eq('tanggal', today);

      const listIdSudahAbsen = absenHariIni?.map(a => a.user_id) || [];

      // 3. Filter Pegawai yang Belum Absen
      const listBelumAbsen = allStaf.filter(staf => 
        !listIdSudahAbsen.includes(staf.id)
      );

      setStats({
        totalPegawai: allStaf.length || 0,
        hadirHariIni: listIdSudahAbsen.length || 0
      });
      setBelumAbsen(listBelumAbsen);

    } catch (e) {
      console.error("Dashboard Error:", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Monitoring Kehadiran Pegawai</h1>
        <p className="text-gray-500 text-sm">Data kehadiran Guru dan Staf SMPN 9 Palu hari ini.</p>
      </div>

      {/* --- KARTU STATISTIK --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100 flex items-center gap-4">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-xl"><Users size={30}/></div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total Pegawai</p>
            <h2 className="text-2xl font-bold text-gray-800">{stats.totalPegawai} <span className="text-sm font-normal text-gray-400">Orang</span></h2>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-green-100 flex items-center gap-4">
          <div className="p-4 bg-green-50 text-green-600 rounded-xl"><UserCheck size={30}/></div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Hadir Hari Ini</p>
            <h2 className="text-2xl font-bold text-gray-800">{stats.hadirHariIni} <span className="text-sm font-normal text-gray-400">Staf</span></h2>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-orange-100 flex items-center gap-4">
          <div className="p-4 bg-orange-50 text-orange-600 rounded-xl"><TrendingUp size={30}/></div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Persentase</p>
            <h2 className="text-2xl font-bold text-gray-800">
              {stats.totalPegawai > 0 ? ((stats.hadirHariIni / stats.totalPegawai) * 100).toFixed(1) : 0}%
            </h2>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* --- DAFTAR GURU/STAF BELUM ABSEN --- */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 p-4 border-b flex items-center justify-between">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">
              <AlertCircle size={18} className="text-red-500"/> Belum Melakukan Absensi
            </h3>
            <span className="text-xs bg-red-100 text-red-600 px-3 py-1 rounded-full font-black">
              {belumAbsen.length} ORANG
            </span>
          </div>
          
          <div className="p-2 max-h-[400px] overflow-y-auto">
            {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-600" /></div>
            ) : belumAbsen.length > 0 ? belumAbsen.map((staf, i) => (
              <div key={i} className="flex justify-between items-center p-4 hover:bg-gray-50 rounded-xl transition-colors border-b border-gray-50 last:border-0">
                <div>
                  <p className="font-bold text-gray-800">{staf.full_name}</p>
                  <p className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-black uppercase inline-block">{staf.role}</p>
                </div>
                <div className="flex items-center gap-1 text-red-400 font-bold text-[10px] uppercase">
                  <Clock size={12}/> Alpa / Belum Absen
                </div>
              </div>
            )) : (
              <div className="py-20 text-center">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">✅</div>
                <p className="text-gray-500 font-bold">Luar Biasa!</p>
                <p className="text-gray-400 text-sm">Seluruh guru dan staf sudah absen hari ini.</p>
              </div>
            )}
          </div>
        </div>

        {/* --- PANEL INFORMASI --- */}
        <div className="bg-blue-600 p-8 rounded-3xl shadow-lg shadow-blue-100 flex flex-col justify-center text-white relative overflow-hidden">
            <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-2">Informasi Kedisplinan</h3>
                <p className="text-blue-100 text-sm leading-relaxed mb-6">
                    Data kehadiran ini diambil langsung dari input mandiri pegawai melalui sistem. Gunakan tombol di bawah untuk melihat laporan detail per bulan.
                </p>
                <button className="bg-white text-blue-600 px-6 py-3 rounded-2xl font-bold text-sm hover:bg-blue-50 transition-all shadow-md">
                    Lihat Rekap Bulanan Guru
                </button>
            </div>
            {/* Dekorasi Background */}
            <Users size={200} className="absolute -right-10 -bottom-10 text-blue-500 opacity-20 rotate-12" />
        </div>
      </div>
    </div>
  );
}

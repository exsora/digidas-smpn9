"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { Users, UserCheck, AlertCircle, Clock, TrendingUp, GraduationCap } from "lucide-react";

export default function DashboardHome() {
  const [stats, setStats] = useState({ totalSiswa: 0, hadirHariIni: 0 });
  const [belumAbsen, setBelumAbsen] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // 1. Ambil Total Siswa dari tabel students
      const { count: total, error: errorSiswa } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true });

      // 2. Ambil Kehadiran Siswa Hari Ini
      const today = new Date().toISOString().split('T')[0];
      const { data: absenHariIni, error: errorAbsen } = await supabase
        .from('absensi')
        .select('student_user_id, status')
        .eq('tanggal', today) // Mencocokkan kolom tanggal hari ini
        .eq('status', 'hadir'); // Hanya menghitung yang statusnya 'hadir'

      // Mengambil ID siswa unik yang sudah absen (hadir/sakit/izin/alpa) hari ini 
      // untuk mendeteksi siapa yang sama sekali belum ada datanya di tabel absensi
      const { data: semuaAbsenInput } = await supabase
        .from('absensi')
        .select('student_user_id')
        .eq('tanggal', today);

      const listIdSudahInput = semuaAbsenInput?.map(a => a.student_user_id) || [];

      // 3. Cari Siswa yang Belum Di-input Absensinya sama sekali hari ini
      const { data: allSiswa } = await supabase
        .from('students')
        .select(`
          user_id, 
          full_name, 
          kelas ( name )
        `);

      const listBelumAbsen = allSiswa?.filter(s => 
        !listIdSudahInput.includes(s.user_id)
      ) || [];

      setStats({
        totalSiswa: total || 0,
        hadirHariIni: absenHariIni?.length || 0
      });
      setBelumAbsen(listBelumAbsen);

    } catch (e) {
      console.error("Gagal memuat data dashboard:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Ringkasan Statistik Siswa</h1>
        <p className="text-gray-500 text-sm">Update kehadiran real-time SMPN 9 Palu</p>
      </div>

      {/* --- KARTU STATISTIK --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100 flex items-center gap-4">
          <div className="p-4 bg-blue-100 text-blue-600 rounded-xl"><GraduationCap size={30}/></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Siswa</p>
            <h2 className="text-2xl font-bold">{stats.totalSiswa} Siswa</h2>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-green-100 flex items-center gap-4">
          <div className="p-4 bg-green-100 text-green-600 rounded-xl"><UserCheck size={30}/></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Siswa Hadir</p>
            <h2 className="text-2xl font-bold">{stats.hadirHariIni} Orang</h2>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-orange-100 flex items-center gap-4">
          <div className="p-4 bg-orange-100 text-orange-600 rounded-xl"><TrendingUp size={30}/></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Persentase Kehadiran</p>
            <h2 className="text-2xl font-bold">
              {stats.totalSiswa > 0 ? ((stats.hadirHariIni / stats.totalSiswa) * 100).toFixed(1) : 0}%
            </h2>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* --- LIST SISWA BELUM ABSEN --- */}
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden flex flex-col h-[500px]">
          <div className="bg-red-50 p-4 border-b border-red-100 flex items-center justify-between shrink-0">
            <h3 className="font-bold text-red-700 flex items-center gap-2">
              <AlertCircle size={18}/> Belum Di-absen Hari Ini
            </h3>
            <span className="text-xs bg-red-200 text-red-800 px-2 py-1 rounded-full font-bold">
              {belumAbsen.length} Siswa
            </span>
          </div>
          
          <div className="p-2 overflow-y-auto grow">
            {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" /></div>
            ) : belumAbsen.length > 0 ? belumAbsen.map((s, i) => (
              <div key={i} className="flex justify-between items-center p-3 hover:bg-red-50/50 rounded-lg border-b border-gray-50 last:border-0 text-sm">
                <div>
                  <p className="font-bold text-gray-800">{s.full_name}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Kelas: {s.kelas?.name || '??'}</p>
                </div>
                <div className="text-[10px] bg-orange-100 text-orange-600 px-2 py-1 rounded-md font-bold flex items-center gap-1">
                  <Clock size={12}/> BELUM INPUT
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">✅</div>
                <p className="text-gray-500 font-medium">Semua siswa telah di-absen hari ini.</p>
              </div>
            )}
          </div>
        </div>

        {/* --- KARTU INFORMASI --- */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
          <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
             <UserCheck size={40}/>
          </div>
          <h3 className="text-xl font-bold text-gray-800">Manajemen Presensi</h3>
          <p className="text-gray-500 text-sm mt-3 max-w-xs leading-relaxed">
            Data ini sinkron dengan input absensi harian kelas. Pastikan seluruh siswa sudah terdata sebelum pukul 14.00 WITA.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 px-6 py-2 bg-gray-800 text-white text-xs font-bold rounded-xl hover:bg-black transition-all"
          >
            Refresh Data
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper icon loader jika diperlukan
function Loader2({ className }) {
    return <Clock className={`animate-spin ${className}`} />
}

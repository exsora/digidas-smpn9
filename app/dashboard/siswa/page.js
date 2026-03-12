"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { 
  GraduationCap, Search, Printer, Loader2, 
  Eye, X, User, Download, Calendar, FileCheck 
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function SiswaPage() {
  const [siswa, setSiswa] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingDownload, setLoadingDownload] = useState(false);
  const [search, setSearch] = useState("");
  const [config, setConfig] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  const daftarBulan = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: conf } = await supabase.from("app_config").select("*").single();
      if (conf) setConfig(conf);

      const { data, error } = await supabase
        .from('students')
        .select(`user_id, nis, full_name, kelas ( name )`)
        .order('full_name', { ascending: true });
      
      if (error) throw error;
      setSiswa(data?.map(s => ({ ...s, kelas_name: s.kelas?.name || "Tanpa Kelas" })) || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getBase64Image = async (url) => {
    if (!url) return null;
    try {
      const response = await fetch(`${url}?t=${new Date().getTime()}`, { cache: 'no-store' });
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch (e) { return null; }
  };

  // --- FUNGSI DOWNLOAD REKAP SEMPURNA ---
  const handleDownloadRekapSempurna = async (namaKelas) => {
    if (loadingDownload) return;
    setLoadingDownload(true);
    
    try {
      const safeConfig = config || {};
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.width;
      const currentYear = new Date().getFullYear();
      
      const siswaDiKelas = siswa.filter(s => s.kelas_name === namaKelas);
      const studentIds = siswaDiKelas.map(s => s.user_id);

      const { data: allAbsen, error } = await supabase
        .from('absensi')
        .select('student_user_id, status, tanggal')
        .in('student_user_id', studentIds);

      if (error) throw error;

      // Filter khusus bulan yang dipilih
      const dataBulanIni = allAbsen.filter(a => {
        const d = new Date(a.tanggal);
        return d.getMonth() === parseInt(selectedMonth) && d.getFullYear() === currentYear;
      });

      // 1. HEADER (Logo Kanan & Kiri)
      const logoKiri = await getBase64Image(safeConfig.logo_kiri_url);
      const logoKanan = await getBase64Image(safeConfig.logo_kanan_url);

      if (logoKiri) doc.addImage(logoKiri, "PNG", 15, 10, 22, 22);
      if (logoKanan) doc.addImage(logoKanan, "PNG", pageWidth - 37, 10, 22, 22);

      doc.setFont("times", "bold");
      doc.setFontSize(14);
      doc.text((safeConfig.nama_sekolah || "PEMERINTAH KOTA PALU").toUpperCase(), pageWidth / 2, 18, { align: "center" });
      doc.setFontSize(10);
      doc.text("DINAS PENDIDIKAN DAN KEBUDAYAAN", pageWidth / 2, 23, { align: "center" });
      doc.setFontSize(12);
      doc.text("LAPORAN REKAPITULASI ABSENSI SISWA", pageWidth / 2, 30, { align: "center" });
      
      doc.setLineWidth(0.8);
      doc.line(15, 35, pageWidth - 15, 35);

      // 2. INFO LAPORAN
      doc.setFontSize(10);
      doc.setFont("times", "normal");
      doc.text(`Kelas : ${namaKelas}`, 15, 42);
      doc.text(`Bulan : ${daftarBulan[selectedMonth]} ${currentYear}`, 15, 47);
      doc.text(`Tahun Ajaran : ${currentYear}/${currentYear + 1}`, pageWidth - 15, 42, { align: "right" });

      // 3. TABEL DATA
      const tableBody = siswaDiKelas.map((std, index) => {
        const d = dataBulanIni.filter(a => a.student_user_id === std.user_id);
        const h = d.filter(a => a.status === 'hadir').length;
        const s = d.filter(a => a.status === 'sakit').length;
        const i = d.filter(a => a.status === 'izin').length;
        const a = d.filter(x => ['alpa', 'alpha'].includes(x.status)).length;
        const b = d.filter(x => x.status === 'bolos').length;
        const total = h + s + i + a + b;

        return [index + 1, std.full_name, std.nis || '-', h, s, i, b, a, total];
      });

      autoTable(doc, {
        startY: 52,
        head: [['No', 'Nama Siswa', 'NIS', 'H', 'S', 'I', 'B', 'A', 'Total']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [20, 83, 45], halign: 'center', fontStyle: 'bold' },
        styles: { font: "times", fontSize: 9, halign: 'center' },
        columnStyles: { 
          1: { halign: 'left', cellWidth: 'auto' },
          8: { fontStyle: 'bold', fillColor: [240, 240, 240] } 
        }
      });

      // 4. FOOTER & TTD WALI KELAS
      let finalY = doc.lastAutoTable.finalY + 15;
      
      // Cek sisa halaman agar TTD tidak terpotong
      if (finalY > 260) { doc.addPage(); finalY = 20; }

      const tglSekarang = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      
      doc.setFont("times", "normal");
      doc.text(`${safeConfig.kota_cetak || "Palu"}, ${tglSekarang}`, pageWidth - 65, finalY);
      doc.text("Mengetahui,", pageWidth - 65, finalY + 6);
      doc.text("Wali Kelas,", pageWidth - 65, finalY + 11);
      
      doc.setFont("times", "bold");
      doc.text("( ____________________ )", pageWidth - 65, finalY + 35);
      doc.setFont("times", "normal");
      doc.text("NIP. .................................", pageWidth - 65, finalY + 40);

      doc.save(`REKAP_${namaKelas}_${daftarBulan[selectedMonth]}.pdf`);
    } catch (err) {
      alert("Terjadi kesalahan: " + err.message);
    } finally {
      setLoadingDownload(false);
    }
  };

  const daftarKelas = Array.from(new Set(siswa.map(s => s.kelas_name))).filter(k => k !== "Tanpa Kelas");

  return (
    <div className="p-8 bg-white min-h-screen rounded-3xl shadow-sm border border-gray-100">
      {/* HEADER SECTION */}
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
          <FileCheck className="text-green-600" size={32}/> Dashboard Laporan
        </h1>
        <p className="text-gray-500 mt-1">Sistem Rekapitulasi Kehadiran Siswa Otomatis.</p>
      </div>

      {/* PANEL CONTROL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        {/* Pilih Bulan */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <label className="flex items-center gap-2 text-sm font-bold text-gray-600 mb-4">
            <Calendar size={18} className="text-green-600"/> 1. Tentukan Bulan Laporan
          </label>
          <select 
            className="w-full p-3 rounded-xl border-gray-200 bg-gray-50 font-semibold focus:ring-2 focus:ring-green-500 outline-none transition-all"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {daftarBulan.map((bln, idx) => (
              <option key={idx} value={idx}>{bln}</option>
            ))}
          </select>
        </div>

        {/* Pilih Kelas & Download */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <label className="flex items-center gap-2 text-sm font-bold text-gray-600 mb-4">
            <Download size={18} className="text-blue-600"/> 2. Download Rekap Keseluruhan (PDF)
          </label>
          <div className="flex flex-wrap gap-3">
            {daftarKelas.length > 0 ? daftarKelas.map((kls, i) => (
              <button
                key={i}
                onClick={() => handleDownloadRekapSempurna(kls)}
                disabled={loadingDownload}
                className="group flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-xl hover:bg-green-700 transition-all font-bold text-sm shadow-md shadow-green-100 disabled:opacity-50"
              >
                {loadingDownload ? <Loader2 className="animate-spin" size={16}/> : <Printer size={16} className="group-hover:scale-110 transition-transform"/>}
                Kelas {kls}
              </button>
            )) : <p className="text-gray-400 italic text-sm">Tidak ada data kelas tersedia.</p>}
          </div>
        </div>
      </div>

      {/* TABLE DATA SISWA */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-gray-700">Daftar Siswa Terdaftar</h3>
            <div className="relative w-64">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                <input 
                    type="text" 
                    placeholder="Cari siswa..." 
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50/50 text-gray-400 uppercase text-[10px] tracking-widest font-black">
                    <tr>
                        <th className="px-6 py-4">Nama Lengkap</th>
                        <th className="px-6 py-4">NIS</th>
                        <th className="px-6 py-4 text-center">Kelas</th>
                        <th className="px-6 py-4 text-center">Aksi</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {loading ? (
                        <tr><td colSpan="4" className="text-center py-10"><Loader2 className="animate-spin mx-auto text-green-600"/></td></tr>
                    ) : (
                        siswa.filter(s => s.full_name.toLowerCase().includes(search.toLowerCase())).map((s, i) => (
                            <tr key={i} className="hover:bg-green-50/20 transition-colors group">
                                <td className="px-6 py-4 font-bold text-gray-700 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-green-100 group-hover:text-green-600 transition-colors">
                                        <User size={14}/>
                                    </div>
                                    {s.full_name}
                                </td>
                                <td className="px-6 py-4 text-gray-500 font-mono text-xs">{s.nis || '-'}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-[10px] font-black">{s.kelas_name}</span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <button className="bg-gray-50 text-gray-600 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-100 transition-all border border-gray-100">
                                        Lihat Detail
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}

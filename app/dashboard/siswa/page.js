"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { 
  GraduationCap, Search, Printer, Loader2, 
  Eye, X, User, Download, FileText 
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function SiswaPage() {
  const [siswa, setSiswa] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingDownload, setLoadingDownload] = useState(false);
  const [search, setSearch] = useState("");
  const [config, setConfig] = useState(null);

  // State Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [reportData, setReportData] = useState([]); 
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [summary, setSummary] = useState({ H: 0, S: 0, I: 0, A: 0, B: 0 }); 

  const TARGET_SESI = 100;

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
      const safeData = data?.map(s => ({
        ...s,
        kelas_name: s.kelas?.name || "Belum Masuk Kelas"
      })) || [];
      setSiswa(safeData);
    } catch (error) {
      console.error("Error:", error.message);
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

  // --- FUNGSI DOWNLOAD REKAP KESELURUHAN KELAS (SATU TABEL) ---
  const handleDownloadRekapKelas = async (namaKelas) => {
    if (loadingDownload) return;
    setLoadingDownload(true);
    
    try {
      const safeConfig = config || {};
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.width;
      const today = new Date();
      
      // 1. Data Siswa & Absen
      const siswaDiKelas = siswa.filter(s => s.kelas_name === namaKelas);
      const studentIds = siswaDiKelas.map(s => s.user_id);
      const { data: allAbsen, error } = await supabase
        .from('absensi')
        .select('student_user_id, status')
        .in('student_user_id', studentIds);

      if (error) throw error;

      // Header Gambar
      const logoKiri = await getBase64Image(safeConfig.logo_kiri_url);
      if (logoKiri) doc.addImage(logoKiri, "PNG", 12, 10, 20, 20);

      // Header Teks
      doc.setFont("times", "bold");
      doc.setFontSize(14);
      doc.text((safeConfig.nama_sekolah || "LAPORAN SEKOLAH").toUpperCase(), pageWidth / 2, 18, { align: "center" });
      doc.setFontSize(11);
      doc.text("REKAPITULASI KEHADIRAN SISWA KESELURUHAN", pageWidth / 2, 24, { align: "center" });
      doc.setFont("times", "normal");
      doc.text(`Kelas: ${namaKelas} | Tanggal Cetak: ${today.toLocaleDateString('id-ID')}`, pageWidth / 2, 29, { align: "center" });
      doc.line(10, 32, pageWidth - 10, 32);

      // 2. Olah Data Siswa ke Tabel
      const tableBody = siswaDiKelas.map((std, index) => {
        const d = allAbsen.filter(a => a.student_user_id === std.user_id);
        const h = d.filter(a => a.status === 'hadir').length;
        const s = d.filter(a => a.status === 'sakit').length;
        const i = d.filter(a => a.status === 'izin').length;
        const a = d.filter(x => ['alpa', 'alpha'].includes(x.status)).length;
        const b = d.filter(x => x.status === 'bolos').length;
        const total = h + s + i + a + b;
        const persen = total > 0 ? ((h / total) * 100).toFixed(0) : 0;

        return [index + 1, std.full_name, std.nis || '-', h, s, i, a, b, `${persen}%`];
      });

      // 3. Render Tabel
      autoTable(doc, {
        startY: 38,
        head: [['No', 'Nama Siswa', 'NIS', 'H', 'S', 'I', 'A', 'B', '%']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [22, 163, 74], halign: 'center' },
        styles: { font: "times", fontSize: 9 },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          2: { halign: 'center' },
          3: { halign: 'center' },
          4: { halign: 'center' },
          5: { halign: 'center' },
          6: { halign: 'center' },
          7: { halign: 'center' },
          8: { halign: 'center', fontStyle: 'bold' },
        }
      });

      // TTD
      let finalY = doc.lastAutoTable.finalY + 15;
      if (finalY > 250) { doc.addPage(); finalY = 20; }
      doc.text(`${safeConfig.kota_cetak || "Palu"}, ${today.toLocaleDateString('id-ID')}`, pageWidth - 70, finalY);
      doc.text("Wali Kelas,", pageWidth - 70, finalY + 7);
      doc.text("( ____________________ )", pageWidth - 70, finalY + 30);

      doc.save(`REKAP_KESELURUHAN_${namaKelas.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      alert("Gagal: " + err.message);
    } finally {
      setLoadingDownload(false);
    }
  };

  const handleOpenDetail = async (student) => {
    // ... (Logika detail sama seperti kode sebelumnya)
    setSelectedStudent(student);
    setIsModalOpen(true);
    // (Tambahkan fetch detail di sini jika perlu)
  };

  const filteredSiswa = siswa.filter(s => 
    s.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const daftarKelas = Array.from(new Set(siswa.map(s => s.kelas_name))).filter(k => k !== "Belum Masuk Kelas");

  return (
    <div className="p-8 bg-white min-h-screen rounded-3xl shadow-sm border border-gray-100">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <GraduationCap className="text-green-600"/> Laporan Kehadiran
          </h1>
          <p className="text-gray-500 text-sm">Download rekapitulasi per kelas atau lihat detail siswa.</p>
        </div>
        <div className="relative flex-1 md:w-64 w-full">
          <Search className="absolute left-3 top-3 text-gray-400" size={18}/>
          <input 
            type="text" 
            placeholder="Cari nama..." 
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-green-500"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* SEKSI DOWNLOAD PER KELAS */}
      <div className="mb-8 p-6 bg-green-50 rounded-2xl border border-green-100">
        <h3 className="text-sm font-bold text-green-700 mb-4 flex items-center gap-2">
          <FileText size={18}/> Cetak Rekap Keseluruhan Siswa Per Kelas
        </h3>
        <div className="flex flex-wrap gap-3">
          {daftarKelas.map((kls, i) => (
            <button
              key={i}
              onClick={() => handleDownloadRekapKelas(kls)}
              disabled={loadingDownload}
              className="flex items-center gap-2 bg-white text-green-700 border border-green-200 px-5 py-2.5 rounded-xl hover:bg-green-600 hover:text-white transition-all text-sm font-bold shadow-sm disabled:opacity-50"
            >
              {loadingDownload ? <Loader2 className="animate-spin" size={16}/> : <Download size={16}/>}
              Download Kelas {kls}
            </button>
          ))}
        </div>
      </div>

      {/* TABEL DAFTAR SISWA */}
      <div className="overflow-x-auto border rounded-xl">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              <th className="px-6 py-4">Nama</th>
              <th className="px-6 py-4 text-center">Kelas</th>
              <th className="px-6 py-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan="3" className="text-center p-10"><Loader2 className="animate-spin mx-auto text-green-600"/></td></tr>
            ) : filteredSiswa.map((s, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-bold text-gray-800">{s.full_name}</td>
                <td className="px-6 py-4 text-center font-bold text-blue-600">{s.kelas_name}</td>
                <td className="px-6 py-4 text-center">
                  <button onClick={() => handleOpenDetail(s)} className="text-blue-600 font-bold hover:underline">Detail</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Modal Detail tetap bisa Anda gunakan di sini (kode modal Anda sebelumnya) */}
    </div>
  );
}

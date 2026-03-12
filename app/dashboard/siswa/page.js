"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { 
  GraduationCap, Search, Printer, Loader2, 
  Eye, X, User, Download, Calendar 
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function SiswaPage() {
  const [siswa, setSiswa] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingDownload, setLoadingDownload] = useState(false);
  const [search, setSearch] = useState("");
  const [config, setConfig] = useState(null);
  
  // State baru untuk filter bulan download
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

  // --- FUNGSI DOWNLOAD REKAP PER BULAN ---
  const handleDownloadBulanan = async (namaKelas) => {
    if (loadingDownload) return;
    setLoadingDownload(true);
    
    try {
      const safeConfig = config || {};
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.width;
      const currentYear = new Date().getFullYear();
      
      const siswaDiKelas = siswa.filter(s => s.kelas_name === namaKelas);
      const studentIds = siswaDiKelas.map(s => s.user_id);

      // Ambil data absen dengan filter bulan
      const { data: allAbsen, error } = await supabase
        .from('absensi')
        .select('student_user_id, status, tanggal')
        .in('student_user_id', studentIds);

      if (error) throw error;

      // Filter data berdasarkan bulan yang dipilih di state
      const dataTerfilter = allAbsen.filter(a => {
        const d = new Date(a.tanggal);
        return d.getMonth() === parseInt(selectedMonth) && d.getFullYear() === currentYear;
      });

      // Header
      const logoKiri = await getBase64Image(safeConfig.logo_kiri_url);
      if (logoKiri) doc.addImage(logoKiri, "PNG", 12, 10, 18, 18);

      doc.setFont("times", "bold");
      doc.setFontSize(14);
      doc.text((safeConfig.nama_sekolah || "LAPORAN SEKOLAH").toUpperCase(), pageWidth / 2, 18, { align: "center" });
      doc.setFontSize(11);
      doc.text(`REKAPITULASI KEHADIRAN BULAN ${daftarBulan[selectedMonth].toUpperCase()} ${currentYear}`, pageWidth / 2, 24, { align: "center" });
      doc.setFont("times", "normal");
      doc.text(`Kelas: ${namaKelas}`, pageWidth / 2, 29, { align: "center" });
      doc.line(10, 32, pageWidth - 10, 32);

      // Isi Tabel
      const tableBody = siswaDiKelas.map((std, index) => {
        const d = dataTerfilter.filter(a => a.student_user_id === std.user_id);
        const h = d.filter(a => a.status === 'hadir').length;
        const s = d.filter(a => a.status === 'sakit').length;
        const i = d.filter(a => a.status === 'izin').length;
        const a = d.filter(x => ['alpa', 'alpha'].includes(x.status)).length;
        const b = d.filter(x => x.status === 'bolos').length;

        return [index + 1, std.full_name, std.nis || '-', h, s, i, a, b];
      });

      autoTable(doc, {
        startY: 38,
        head: [['No', 'Nama Siswa', 'NIS', 'H', 'S', 'I', 'A', 'B']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [22, 163, 74], halign: 'center' },
        styles: { font: "times", fontSize: 9, halign: 'center' },
        columnStyles: { 1: { halign: 'left' } }
      });

      // TTD
      let finalY = doc.lastAutoTable.finalY + 15;
      doc.text(`${safeConfig.kota_cetak || "Palu"}, ${new Date().toLocaleDateString('id-ID')}`, pageWidth - 70, finalY);
      doc.text("Wali Kelas,", pageWidth - 70, finalY + 7);
      doc.text("( ____________________ )", pageWidth - 70, finalY + 30);

      doc.save(`REKAP_${namaKelas}_${daftarBulan[selectedMonth]}_${currentYear}.pdf`);
    } catch (err) {
      alert("Gagal: " + err.message);
    } finally {
      setLoadingDownload(false);
    }
  };

  const daftarKelas = Array.from(new Set(siswa.map(s => s.kelas_name))).filter(k => k !== "Tanpa Kelas");

  return (
    <div className="p-8 bg-white min-h-screen rounded-3xl shadow-sm border border-gray-100">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <GraduationCap className="text-green-600"/> Laporan Kehadiran
          </h1>
          <p className="text-gray-500 text-sm">Download rekap absen bulanan per kelas.</p>
        </div>
      </div>

      {/* FILTER & DOWNLOAD SECTION */}
      <div className="mb-8 p-6 bg-blue-50 rounded-2xl border border-blue-100">
        <div className="flex flex-col md:flex-row md:items-end gap-6">
          {/* Pilih Bulan */}
          <div className="w-full md:w-64">
            <label className="text-xs font-bold text-blue-700 uppercase mb-2 flex items-center gap-2">
              <Calendar size={14}/> 1. Pilih Bulan Rekap:
            </label>
            <select 
              className="w-full p-2.5 rounded-xl border-blue-200 text-sm focus:ring-blue-500 font-medium"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {daftarBulan.map((bln, idx) => (
                <option key={idx} value={idx}>{bln}</option>
              ))}
            </select>
          </div>

          {/* Download Buttons */}
          <div className="flex-1">
            <label className="text-xs font-bold text-blue-700 uppercase mb-2 block">
              2. Pilih Kelas untuk Download PDF:
            </label>
            <div className="flex flex-wrap gap-2">
              {daftarKelas.map((kls, i) => (
                <button
                  key={i}
                  onClick={() => handleDownloadBulanan(kls)}
                  disabled={loadingDownload}
                  className="flex items-center gap-2 bg-white text-blue-600 border border-blue-200 px-4 py-2 rounded-xl hover:bg-blue-600 hover:text-white transition-all text-xs font-bold shadow-sm"
                >
                  {loadingDownload ? <Loader2 className="animate-spin" size={14}/> : <Download size={14}/>}
                  Kelas {kls}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SEARCH & TABLE SISWA */}
      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-3 text-gray-400" size={18}/>
        <input 
          type="text" 
          placeholder="Cari nama siswa..." 
          className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm"
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto border rounded-xl">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold">
            <tr>
              <th className="px-6 py-4">Nama Lengkap</th>
              <th className="px-6 py-4 text-center">Kelas</th>
              <th className="px-6 py-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan="3" className="text-center p-10"><Loader2 className="animate-spin mx-auto text-green-600"/></td></tr>
            ) : siswa.filter(s => s.full_name.toLowerCase().includes(search.toLowerCase())).map((s, i) => (
              <tr key={i} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-800">{s.full_name}</td>
                <td className="px-6 py-4 text-center"><span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-bold">{s.kelas_name}</span></td>
                <td className="px-6 py-4 text-center">
                  <button className="text-green-600 hover:text-green-700 font-bold text-xs flex items-center gap-1 justify-center w-full">
                    <Eye size={14}/> Detail
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

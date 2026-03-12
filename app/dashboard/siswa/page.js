"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { 
  GraduationCap, Search, Printer, Loader2, 
  Download, Calendar, FileCheck, Layers
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function SiswaPage() {
  const [siswa, setSiswa] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingDownload, setLoadingDownload] = useState(false);
  const [search, setSearch] = useState("");
  const [config, setConfig] = useState(null);
  
  // State Filter
  const [downloadMode, setDownloadMode] = useState("bulanan"); // "bulanan" atau "semester"
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedSemester, setSelectedSemester] = useState(new Date().getMonth() >= 6 ? "Ganjil" : "Genap");

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

  const handleDownloadRekap = async (namaKelas) => {
    if (loadingDownload) return;
    setLoadingDownload(true);
    
    try {
      const safeConfig = config || {};
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.width;
      const currentYear = new Date().getFullYear();
      
      const siswaDiKelas = siswa.filter(s => s.kelas_name === namaKelas);
      const studentIds = siswaDiKelas.map(s => s.user_id);

      const { data: allAbsen } = await supabase
        .from('absensi')
        .select('student_user_id, status, tanggal')
        .in('student_user_id', studentIds);

      // --- LOGIKA FILTER WAKTU ---
      let dataTerfilter = [];
      let labelPeriode = "";

      if (downloadMode === "bulanan") {
        dataTerfilter = allAbsen?.filter(a => {
          const d = new Date(a.tanggal);
          return d.getMonth() === parseInt(selectedMonth) && d.getFullYear() === currentYear;
        }) || [];
        labelPeriode = `BULAN ${daftarBulan[selectedMonth].toUpperCase()} ${currentYear}`;
      } else {
        // Semester Ganjil (Juli-Des) : Genap (Jan-Juni)
        const rangeBulan = selectedSemester === "Ganjil" ? [6, 7, 8, 9, 10, 11] : [0, 1, 2, 3, 4, 5];
        dataTerfilter = allAbsen?.filter(a => {
          const d = new Date(a.tanggal);
          return rangeBulan.includes(d.getMonth()) && d.getFullYear() === currentYear;
        }) || [];
        labelPeriode = `SEMESTER ${selectedSemester.toUpperCase()} T.A ${currentYear}/${currentYear + 1}`;
      }

      const logoKiri = await getBase64Image(safeConfig.logo_kiri_url);
      const logoKanan = await getBase64Image(safeConfig.logo_kanan_url);

      const drawKop = () => {
        if (logoKiri) doc.addImage(logoKiri, "PNG", 15, 10, 22, 22);
        if (logoKanan) doc.addImage(logoKanan, "PNG", pageWidth - 37, 10, 22, 22);
        doc.setFont("times", "bold");
        doc.setFontSize(14);
        doc.text((safeConfig.nama_sekolah || "PEMERINTAH KOTA PALU").toUpperCase(), pageWidth / 2, 16, { align: "center" });
        doc.setFontSize(11);
        doc.text("DINAS PENDIDIKAN DAN KEBUDAYAAN", pageWidth / 2, 21, { align: "center" });
        doc.setFontSize(9);
        doc.setFont("times", "normal");
        doc.text(safeConfig.alamat_sekolah || "Alamat sekolah belum diatur", pageWidth / 2, 26, { align: "center" });
        doc.setLineWidth(0.8);
        doc.line(15, 32, pageWidth - 15, 32);
        
        doc.setFont("times", "bold");
        doc.setFontSize(11);
        doc.text(`REKAPITULASI ABSENSI SISWA - ${labelPeriode}`, pageWidth / 2, 40, { align: "center" });
        
        doc.setFontSize(10);
        doc.setFont("times", "normal");
        doc.text(`Kelas : ${namaKelas}`, 15, 48);
        doc.text(`Waktu Cetak : ${new Date().toLocaleDateString('id-ID')}`, pageWidth - 15, 48, { align: "right" });
      };

      const tableData = siswaDiKelas.map((std, index) => {
        const d = dataTerfilter.filter(a => a.student_user_id === std.user_id);
        const h = d.filter(a => a.status === 'hadir').length;
        const s = d.filter(a => a.status === 'sakit').length;
        const i = d.filter(a => a.status === 'izin').length;
        const b = d.filter(a => a.status === 'bolos').length;
        const a = d.filter(x => ['alpa', 'alpha'].includes(x.status)).length;
        const total = h + s + i + b + a;
        const persen = total > 0 ? ((h / total) * 100).toFixed(0) : 0;

        return [index + 1, std.full_name, std.nis || '-', h, s, i, b, a, `${persen}%`];
      });

      autoTable(doc, {
        startY: 55,
        head: [['No', 'Nama Siswa', 'NIS', 'H', 'S', 'I', 'B', 'A', '%']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [20, 83, 45], halign: 'center' },
        styles: { font: "times", fontSize: 9, halign: 'center' },
        columnStyles: { 1: { halign: 'left', cellWidth: 60 }, 8: { fontStyle: 'bold' } },
        margin: { bottom: 65 },
        didDrawPage: (data) => { if (data.pageNumber === 1) drawKop(); }
      });

      let finalY = doc.lastAutoTable.finalY + 15;
      doc.setFont("times", "normal");
      doc.text(`${safeConfig.kota_cetak || "Palu"}, ${new Date().toLocaleDateString('id-ID')}`, pageWidth - 75, finalY);
      doc.text("Wali Kelas,", pageWidth - 75, finalY + 7);
      doc.setFont("times", "bold");
      doc.text("( ____________________ )", pageWidth - 75, finalY + 30);

      doc.save(`REKAP_${downloadMode.toUpperCase()}_${namaKelas}.pdf`);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoadingDownload(false);
    }
  };

  const daftarKelas = Array.from(new Set(siswa.map(s => s.kelas_name))).filter(k => k !== "Tanpa Kelas");

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
            <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2 uppercase">
                <FileCheck className="text-green-600" size={28}/> 
                Laporan Presensi Terpadu
            </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
            {/* Konfigurasi Waktu */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <label className="text-[10px] font-black text-gray-400 uppercase block mb-3">Tipe Rekap</label>
                <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
                    <button 
                        onClick={() => setDownloadMode("bulanan")}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${downloadMode === "bulanan" ? "bg-white text-green-600 shadow-sm" : "text-gray-500"}`}
                    >Bulanan</button>
                    <button 
                        onClick={() => setDownloadMode("semester")}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${downloadMode === "semester" ? "bg-white text-green-600 shadow-sm" : "text-gray-500"}`}
                    >Semester</button>
                </div>

                {downloadMode === "bulanan" ? (
                    <select 
                        className="w-full p-2.5 bg-gray-50 border-none rounded-xl font-bold text-gray-700 text-sm focus:ring-2 focus:ring-green-500"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                    >
                        {daftarBulan.map((bln, idx) => <option key={idx} value={idx}>{bln}</option>)}
                    </select>
                ) : (
                    <select 
                        className="w-full p-2.5 bg-gray-50 border-none rounded-xl font-bold text-gray-700 text-sm focus:ring-2 focus:ring-green-500"
                        value={selectedSemester}
                        onChange={(e) => setSelectedSemester(e.target.value)}
                    >
                        <option value="Ganjil">Semester Ganjil (Juli - Des)</option>
                        <option value="Genap">Semester Genap (Jan - Juni)</option>
                    </select>
                )}
            </div>

            {/* Tombol Aksi */}
            <div className="lg:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <label className="text-[10px] font-black text-gray-400 uppercase block mb-4">Pilih Kelas Untuk Cetak PDF</label>
                <div className="flex flex-wrap gap-3">
                    {daftarKelas.map((kls, i) => (
                        <button
                            key={i}
                            onClick={() => handleDownloadRekap(kls)}
                            disabled={loadingDownload}
                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-3 transition-all shadow-lg shadow-green-100 disabled:opacity-50"
                        >
                            {loadingDownload ? <Loader2 className="animate-spin" size={18}/> : <Printer size={18}/>}
                            Cetak Kelas {kls}
                        </button>
                    ))}
                </div>
                <p className="mt-4 text-[10px] text-gray-400 italic font-medium">
                    * Laporan mencakup data {downloadMode} yang sedang dipilih. Persentase dihitung berdasarkan total kehadiran dibanding total hari efektif.
                </p>
            </div>
        </div>

        {/* Tabel Preview Ringkas */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Layers size={18} className="text-gray-400"/>
                    <h3 className="font-bold text-gray-700">Daftar Siswa</h3>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={14}/>
                    <input 
                        type="text" 
                        placeholder="Cari..." 
                        className="pl-9 pr-4 py-1.5 bg-gray-50 border-none rounded-lg text-xs w-48 focus:ring-1 focus:ring-green-500"
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-400 text-[10px] font-black uppercase tracking-widest">
                      <tr>
                          <th className="px-6 py-4">Nama Lengkap</th>
                          <th className="px-6 py-4 text-center">Kelas</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                      {siswa.filter(s => s.full_name.toLowerCase().includes(search.toLowerCase())).map((s, i) => (
                          <tr key={i} className="hover:bg-green-50/10">
                              <td className="px-6 py-4 font-bold text-gray-600 text-xs">{s.full_name}</td>
                              <td className="px-6 py-4 text-center"><span className="text-green-600 font-bold text-[10px] bg-green-50 px-2 py-1 rounded">{s.kelas_name}</span></td>
                          </tr>
                      ))}
                  </tbody>
              </table>
            </div>
        </div>
      </div>
    </div>
  );
}

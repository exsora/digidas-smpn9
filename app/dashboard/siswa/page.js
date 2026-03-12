"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { 
  GraduationCap, Search, Printer, Loader2, 
  Download, Calendar, FileCheck 
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

  const handleDownloadRekapSempurna = async (namaKelas) => {
    if (loadingDownload) return;
    setLoadingDownload(true);
    
    try {
      const safeConfig = config || {};
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.width;
      const currentYear = new Date().getFullYear();
      const tahunAjaran = `${currentYear}/${currentYear + 1}`;
      
      const siswaDiKelas = siswa.filter(s => s.kelas_name === namaKelas);
      const studentIds = siswaDiKelas.map(s => s.user_id);

      const { data: allAbsen } = await supabase
        .from('absensi')
        .select('student_user_id, status, tanggal')
        .in('student_user_id', studentIds);

      const dataBulanIni = allAbsen?.filter(a => {
        const d = new Date(a.tanggal);
        return d.getMonth() === parseInt(selectedMonth) && d.getFullYear() === currentYear;
      }) || [];

      // 1. AMBIL LOGO (Kiri & Kanan)
      const logoKiri = await getBase64Image(safeConfig.logo_kiri_url);
      const logoKanan = await getBase64Image(safeConfig.logo_kanan_url);

      // 2. DATA TABEL
      const tableData = siswaDiKelas.map((std, index) => {
        const d = dataBulanIni.filter(a => a.student_user_id === std.user_id);
        const h = d.filter(a => a.status === 'hadir').length;
        const s = d.filter(a => a.status === 'sakit').length;
        const i = d.filter(a => a.status === 'izin').length;
        const b = d.filter(a => a.status === 'bolos').length;
        const a = d.filter(x => ['alpa', 'alpha'].includes(x.status)).length;
        
        const totalInput = h + s + i + b + a;
        const persen = totalInput > 0 ? ((h / totalInput) * 100).toFixed(0) : 0;

        return [index + 1, std.full_name, std.nis || '-', h, s, i, b, a, `${persen}%`];
      });

      // 3. FUNGSI HEADER & KOP SURAT
      const drawKop = () => {
        if (logoKiri) doc.addImage(logoKiri, "PNG", 15, 10, 22, 22);
        if (logoKanan) doc.addImage(logoKanan, "PNG", pageWidth - 37, 10, 22, 22);

        doc.setFont("times", "bold");
        doc.setFontSize(14);
        doc.text((safeConfig.nama_sekolah || "PEMERINTAH KOTA PALU").toUpperCase(), pageWidth / 2, 16, { align: "center" });
        doc.setFontSize(11);
        doc.text("DINAS PENDIDIKAN DAN KEBUDAYAAN", pageWidth / 2, 21, { align: "center" });
        doc.setFontSize(10);
        doc.setFont("times", "normal");
        doc.text(safeConfig.alamat_sekolah || "Alamat lengkap sekolah belum diatur di app_config", pageWidth / 2, 26, { align: "center" });
        
        doc.setLineWidth(0.8);
        doc.line(15, 33, pageWidth - 15, 33);
        doc.setLineWidth(0.2);
        doc.line(15, 34, pageWidth - 15, 34);

        doc.setFont("times", "bold");
        doc.setFontSize(12);
        doc.text("LAPORAN REKAPITULASI ABSENSI SISWA", pageWidth / 2, 42, { align: "center" });
        
        // Data Kelas & Tahun Ajar
        doc.setFontSize(10);
        doc.setFont("times", "normal");
        doc.text(`Kelas : ${namaKelas}`, 15, 50);
        doc.text(`Bulan : ${daftarBulan[selectedMonth]} ${currentYear}`, 15, 55);
        doc.text(`Tahun Ajaran : ${tahunAjaran}`, pageWidth - 15, 50, { align: "right" });
      };

      // 4. GENERATE TABEL
      autoTable(doc, {
        startY: 60,
        head: [['No', 'Nama Siswa', 'NIS', 'H', 'S', 'I', 'B', 'A', '%']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [20, 83, 45], halign: 'center', fontStyle: 'bold' },
        styles: { font: "times", fontSize: 9, halign: 'center' },
        columnStyles: { 
          1: { halign: 'left', cellWidth: 65 }, 
          8: { fontStyle: 'bold', fillColor: [245, 245, 245] } 
        },
        margin: { bottom: 65 }, // Ruang untuk TTD agar tidak terpotong
        didDrawPage: (data) => {
          if (data.pageNumber === 1) drawKop();
        }
      });

      // 5. TANDA TANGAN WALI KELAS
      let finalY = doc.lastAutoTable.finalY + 15;
      const tglSekarang = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      
      doc.setFont("times", "normal");
      doc.setFontSize(11);
      doc.text(`${safeConfig.kota_cetak || "Palu"}, ${tglSekarang}`, pageWidth - 75, finalY);
      doc.text("Wali Kelas,", pageWidth - 75, finalY + 7);
      
      doc.setFont("times", "bold");
      doc.text("( ____________________ )", pageWidth - 75, finalY + 35);
      doc.setFont("times", "normal");
      doc.setFontSize(10);
      doc.text("NIP. .................................", pageWidth - 75, finalY + 41);

      doc.save(`REKAP_${namaKelas}_${daftarBulan[selectedMonth]}.pdf`);
    } catch (err) {
      alert("Error generating PDF: " + err.message);
    } finally {
      setLoadingDownload(false);
    }
  };

  const daftarKelas = Array.from(new Set(siswa.map(s => s.kelas_name))).filter(k => k !== "Tanpa Kelas");

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
            <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2 uppercase tracking-tight">
                <FileCheck className="text-green-600" size={28}/> 
                Rekapitulasi Absensi
            </h1>
            <p className="text-gray-500 text-sm">Download laporan bulanan dengan format resmi (PDF).</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {/* Pemilih Bulan */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <label className="text-[10px] font-black text-gray-400 uppercase block mb-3 tracking-widest">Pilih Periode</label>
                <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl">
                  <Calendar size={18} className="ml-2 text-gray-400"/>
                  <select 
                      className="w-full p-2 bg-transparent border-none font-bold text-gray-700 focus:ring-0 outline-none"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                  >
                      {daftarBulan.map((bln, idx) => <option key={idx} value={idx}>{bln}</option>)}
                  </select>
                </div>
            </div>

            {/* Tombol Download */}
            <div className="md:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <label className="text-[10px] font-black text-gray-400 uppercase block mb-3 tracking-widest">Cetak Berdasarkan Kelas</label>
                <div className="flex flex-wrap gap-2">
                    {daftarKelas.map((kls, i) => (
                        <button
                            key={i}
                            onClick={() => handleDownloadRekapSempurna(kls)}
                            disabled={loadingDownload}
                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-green-100 disabled:opacity-50 active:scale-95"
                        >
                            {loadingDownload ? <Loader2 className="animate-spin" size={16}/> : <Printer size={16}/>}
                            Kelas {kls}
                        </button>
                    ))}
                </div>
            </div>
        </div>

        {/* List Siswa di Web */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row justify-between items-center gap-4">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <GraduationCap className="text-gray-400" size={20}/> Database Siswa Aktif
                </h3>
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                    <input 
                        type="text" 
                        placeholder="Cari nama siswa..." 
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50/50 text-gray-400 text-[10px] font-black uppercase tracking-widest">
                      <tr>
                          <th className="px-6 py-4">Nama Lengkap</th>
                          <th className="px-6 py-4">NIS</th>
                          <th className="px-6 py-4 text-center">Kelas</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                      {loading ? (
                          <tr><td colSpan="3" className="text-center py-10"><Loader2 className="animate-spin mx-auto text-green-600"/></td></tr>
                      ) : (
                          siswa.filter(s => s.full_name.toLowerCase().includes(search.toLowerCase())).map((s, i) => (
                              <tr key={i} className="hover:bg-green-50/20 transition-all">
                                  <td className="px-6 py-4 font-bold text-gray-700">{s.full_name}</td>
                                  <td className="px-6 py-4 text-gray-500 font-mono text-xs tracking-tighter">{s.nis || '-'}</td>
                                  <td className="px-6 py-4 text-center">
                                      <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-md text-[10px] font-black">{s.kelas_name}</span>
                                  </td>
                              </tr>
                          ))
                      )}
                  </tbody>
              </table>
            </div>
        </div>
      </div>
    </div>
  );
}

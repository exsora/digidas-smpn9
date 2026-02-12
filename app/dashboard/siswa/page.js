"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { GraduationCap, Search, Printer, Loader2, Eye, X, User, AlertTriangle } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function SiswaPage() {
  // --- STATE ---
  const [siswa, setSiswa] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [config, setConfig] = useState(null);

  // State Modal & Data Laporan
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [reportData, setReportData] = useState([]); 
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [summary, setSummary] = useState({ H: 0, S: 0, I: 0, A: 0, B: 0 }); 

  // Konstanta
  const HARI_EFEKTIF = 25; 
  const TARGET_SESI = 100; // Asumsi: 25 hari x 4 mapel

  // --- INIT DATA ---
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // 1. Ambil Config Sekolah
      const { data: conf } = await supabase.from("app_config").select("*").single();
      if (conf) setConfig(conf);

      // 2. Ambil Data Siswa + Nama Kelas
      const { data, error } = await supabase
        .from('students')
        .select(`
          user_id,
          nis,
          full_name,
          kelas ( name )
        `)
        .order('full_name', { ascending: true });
      
      if (error) throw error;
      
      // Sanitasi data agar aman jika kelas kosong
      const safeData = data?.map(s => ({
        ...s,
        kelas_name: s.kelas?.name || "Belum Masuk Kelas"
      })) || [];

      setSiswa(safeData);

    } catch (error) {
      console.error("Error init:", error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- HELPER GAMBAR (ANTI ERROR) ---
  const getBase64Image = async (url) => {
    if (!url) return null;
    try {
      // Tambah timestamp agar cache di HP tidak nyangkut
      const response = await fetch(`${url}?t=${new Date().getTime()}`, { cache: 'no-store' });
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch (e) { 
      console.warn("Gagal load gambar PDF:", e);
      return null; 
    }
  };

  // --- LOGIKA BUKA MODAL & HITUNG ---
  const handleOpenDetail = async (student) => {
    if (!student?.user_id) {
      alert("ID Siswa tidak valid. Cek database.");
      return;
    }

    setSelectedStudent(student);
    setLoadingDetail(true);
    setIsModalOpen(true); 

    try {
      const today = new Date();
      const currentYear = today.getFullYear();

      // Query Database Absensi
      const { data: absenRaw, error } = await supabase
        .from('absensi') 
        .select('tanggal, status') 
        .eq('student_user_id', student.user_id);

      if (error) {
        throw new Error(error.message);
      }

      // Tentukan Semester (Juli-Des = Ganjil, Jan-Jun = Genap)
      const currentMonth = today.getMonth(); 
      let bulanAwal = 0; let bulanAkhir = 5;
      if (currentMonth >= 6) { bulanAwal = 6; bulanAkhir = 11; }

      const namaBulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      
      const processedData = [];
      let total = { H: 0, S: 0, I: 0, A: 0, B: 0 };

      for (let i = bulanAwal; i <= bulanAkhir; i++) {
        // Filter Data Bulan Ini & Tahun Ini
        const dataBulanIni = absenRaw ? absenRaw.filter(a => {
            const d = new Date(a.tanggal);
            return d.getMonth() === i && d.getFullYear() === currentYear;
        }) : [];
        
        // Hitung Per Status
        const h = dataBulanIni.filter(a => a.status === 'hadir').length;
        const s = dataBulanIni.filter(a => a.status === 'sakit').length;
        const i_zin = dataBulanIni.filter(a => a.status === 'izin').length;
        const a = dataBulanIni.filter(x => ['alpa', 'alpha'].includes(x.status)).length;
        const b = dataBulanIni.filter(x => x.status === 'bolos').length;

        // Akumulasi Total Semester
        total.H += h; total.S += s; total.I += i_zin; total.A += a; total.B += b;

        // Persentase & Predikat
        const persen = TARGET_SESI > 0 ? ((h / TARGET_SESI) * 100).toFixed(0) : 0;
        let predikat = "Kurang";
        if (persen >= 90) predikat = "Sangat Baik";
        else if (persen >= 75) predikat = "Baik";
        else if (persen >= 50) predikat = "Cukup";

        processedData.push({
          bulan: namaBulan[i],
          hadir: h, sakit: s, izin: i_zin, alpa: a, bolos: b,
          persen: persen,
          predikat: predikat
        });
      }

      setReportData(processedData);
      setSummary(total);

    } catch (err) {
      console.error(err);
      alert("Gagal memuat data: " + err.message);
      setIsModalOpen(false); // Tutup modal jika error fatal
    } finally {
      setLoadingDetail(false);
    }
  };

  // --- LOGIKA CETAK PDF ---
  const handlePrintFromModal = async () => {
    const safeConfig = config || {}; 
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const today = new Date();
      const currentYear = today.getFullYear();
      const semesterLabel = today.getMonth() >= 6 ? "GANJIL" : "GENAP";

      // Gambar
      const logoKiri = await getBase64Image(safeConfig.logo_kiri_url);
      const logoKanan = await getBase64Image(safeConfig.logo_kanan_url);

      if (logoKiri) doc.addImage(logoKiri, "PNG", 12, 10, 22, 22);
      if (logoKanan) doc.addImage(logoKanan, "PNG", pageWidth - 34, 10, 22, 22);

      // Header Text
      doc.setFont("times", "bold");
      doc.setFontSize(14);
      doc.text((safeConfig.nama_sekolah || "SMP NEGERI 9 PALU").toUpperCase(), pageWidth / 2, 28, { align: "center" });
      doc.setFontSize(10);
      doc.text("DINAS PENDIDIKAN DAN KEBUDAYAAN KOTA PALU", pageWidth / 2, 20, { align: "center" });
      doc.setLineWidth(0.8);
      doc.line(10, 35, pageWidth - 10, 35);

      // Info Laporan
      doc.setFontSize(11);
      doc.text(`REKAPITULASI KEHADIRAN SISWA`, pageWidth / 2, 45, { align: "center" });
      doc.text(`SEMESTER ${semesterLabel} TAHUN ${currentYear}`, pageWidth / 2, 51, { align: "center" });

      // Info Siswa
      doc.setFont("times", "normal");
      doc.setFontSize(10);
      doc.text(`Nama Siswa   : ${selectedStudent.full_name}`, 15, 65);
      doc.text(`NIS            : ${selectedStudent.nis || "-"}`, 15, 71);
      doc.text(`Kelas          : ${selectedStudent.kelas_name}`, 15, 77);

      // Ringkasan Pojok Kanan
      doc.setFont("times", "bold");
      doc.text(`Total Hadir : ${summary.H}`, pageWidth - 50, 65);
      doc.text(`Total Bolos : ${summary.B}`, pageWidth - 50, 71);
      doc.text(`Total Alpa  : ${summary.A}`, pageWidth - 50, 77);

      // Tabel
      const tableBody = reportData.map(d => [
        d.bulan, d.hadir || '-', d.sakit || '-', d.izin || '-', d.alpa || '-', d.bolos || '-', `${d.persen}%`, d.predikat
      ]);

      autoTable(doc, {
        startY: 85,
        head: [['Bulan', 'Hadir', 'Sakit', 'Izin', 'Alpa', 'Bolos', '%', 'Ket']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [22, 163, 74], halign: 'center' },
        styles: { font: "times", halign: "center", fontSize: 9 },
        columnStyles: { 0: { halign: "left", fontStyle: "bold" } }
      });

      // TTD
      let finalY = doc.lastAutoTable.finalY + 20;
      const kota = safeConfig.kota_cetak || "Palu";
      const tgl = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

      doc.setFont("times", "normal");
      doc.text(`${kota}, ${tgl}`, pageWidth - 70, finalY);
      doc.text("Wali Kelas,", pageWidth - 70, finalY + 6);
      doc.setFont("times", "bold");
      doc.text("( ..................................... )", pageWidth - 70, finalY + 30);
      doc.setFont("times", "normal");
      doc.text(`NIP. -`, pageWidth - 70, finalY + 35);

      doc.save(`Rapor_${selectedStudent.full_name}.pdf`);

    } catch (err) {
      alert("Gagal membuat PDF: " + err.message);
    }
  };

  // Filter Search
  const filteredSiswa = siswa.filter(s => 
    s.full_name?.toLowerCase().includes(search.toLowerCase()) || 
    (s.nis && s.nis.includes(search))
  );

  return (
    <div className="p-8 bg-white min-h-screen rounded-3xl shadow-sm border border-gray-100">
      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <GraduationCap className="text-green-600"/> Laporan Siswa
          </h1>
          <p className="text-gray-500 text-sm">Lihat detail dan cetak rapor kehadiran.</p>
        </div>
        
        <div className="relative flex-1 md:w-64 w-full">
          <Search className="absolute left-3 top-3 text-gray-400" size={18}/>
          <input 
            type="text" 
            placeholder="Cari Nama / NIS..." 
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-green-500"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tabel Data Siswa */}
      <div className="overflow-x-auto border rounded-xl">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-500 uppercase bg-green-50">
            <tr>
              <th className="px-6 py-4">Nama Lengkap</th>
              <th className="px-6 py-4">NIS</th>
              <th className="px-6 py-4 text-center">Kelas</th>
              <th className="px-6 py-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan="4" className="text-center p-8"><Loader2 className="animate-spin mx-auto text-green-600"/></td></tr>
            ) : filteredSiswa.length > 0 ? (
              filteredSiswa.map((s, i) => (
                <tr key={i} className="hover:bg-green-50/30 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-800 flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500"><User size={14}/></div>
                    {s.full_name}
                  </td>
                  <td className="px-6 py-4 text-gray-500 font-mono">{s.nis || '-'}</td>
                  <td className="px-6 py-4 text-center font-bold text-blue-600">{s.kelas_name}</td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => handleOpenDetail(s)}
                      className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-100 transition-all text-xs font-bold mx-auto shadow-sm"
                    >
                      <Eye size={16}/> Lihat Detail
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="4" className="text-center p-8 text-gray-400 italic">Data siswa tidak ditemukan.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- MODAL / POP-UP (FIXED MOBILE & Z-INDEX) --- */}
      {isModalOpen && selectedStudent && (
        // FIX 1: z-[100] agar di atas navbar hp
        <div className="fixed inset-0 z-100 flex items-center justify-center ...">
          
          {/* FIX 2: max-h-[85vh] agar tidak kepotong di layar hp */}
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh]">
            
            {/* Header Modal */}
            <div className="bg-green-600 text-white p-6 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-bold">{selectedStudent.full_name}</h2>
                <p className="text-green-100 text-sm">
                  {selectedStudent.nis || 'NIS Kosong'} • Kelas {selectedStudent.kelas_name}
                </p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition"
              >
                <X size={20}/>
              </button>
            </div>

            {/* Body Modal (Scrollable) */}
            <div className="p-6 overflow-y-auto grow">
              {loadingDetail ? (
                <div className="text-center py-10">
                  <Loader2 className="animate-spin mx-auto text-green-600 mb-2" size={30}/> 
                  Memuat Data...
                </div>
              ) : (
                <>
                  {/* Grid Ringkasan (Responsif: 2 kolom di HP, 5 di PC) */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 text-center">
                    <div className="bg-green-50 p-3 rounded-xl border border-green-100">
                      <div className="text-2xl font-bold text-green-700">{summary.H}</div>
                      <div className="text-[10px] uppercase font-bold text-green-500">Hadir</div>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                      <div className="text-2xl font-bold text-blue-700">{summary.S}</div>
                      <div className="text-[10px] uppercase font-bold text-blue-500">Sakit</div>
                    </div>
                    <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-100">
                      <div className="text-2xl font-bold text-yellow-700">{summary.I}</div>
                      <div className="text-[10px] uppercase font-bold text-yellow-500">Izin</div>
                    </div>
                    <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                      <div className="text-2xl font-bold text-red-700">{summary.A}</div>
                      <div className="text-[10px] uppercase font-bold text-red-500">Alpa</div>
                    </div>
                    <div className="bg-gray-100 p-3 rounded-xl border border-gray-200 col-span-2 md:col-span-1">
                      <div className="text-2xl font-bold text-gray-700">{summary.B}</div>
                      <div className="text-[10px] uppercase font-bold text-gray-500">Bolos</div>
                    </div>
                  </div>

                  {/* Tabel Preview (Horizontal Scroll di HP) */}
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                        <tr>
                          <th className="px-4 py-3">Bulan</th>
                          <th className="px-2 py-3 text-center">H</th>
                          <th className="px-2 py-3 text-center">S</th>
                          <th className="px-2 py-3 text-center">I</th>
                          <th className="px-2 py-3 text-center">A</th>
                          <th className="px-2 py-3 text-center">B</th>
                          <th className="px-4 py-3 text-center">Ket</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {reportData.map((d, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">{d.bulan}</td>
                            <td className="px-2 py-3 text-center text-green-600 font-bold">{d.hadir || '-'}</td>
                            <td className="px-2 py-3 text-center">{d.sakit || '-'}</td>
                            <td className="px-2 py-3 text-center">{d.izin || '-'}</td>
                            <td className="px-2 py-3 text-center text-red-500 font-bold">{d.alpa || '-'}</td>
                            <td className="px-2 py-3 text-center text-gray-500 font-bold">{d.bolos || '-'}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-1 rounded text-[10px] font-bold ${d.predikat === 'Sangat Baik' ? 'bg-green-100 text-green-700' : d.predikat === 'Baik' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                {d.predikat}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Footer Modal */}
            <div className="bg-gray-50 p-4 flex justify-end gap-3 border-t shrink-0">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2 rounded-xl text-gray-600 font-bold hover:bg-gray-200 transition text-sm"
              >
                Tutup
              </button>
              <button 
                onClick={handlePrintFromModal}
                disabled={loadingDetail}
                className="px-6 py-2 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 transition flex items-center gap-2 shadow-lg shadow-green-200 text-sm"
              >
                <Printer size={16}/> Cetak PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
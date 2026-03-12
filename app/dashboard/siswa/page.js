"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { 
  GraduationCap, Search, Printer, Loader2, 
  User, Download, Calendar, FileCheck 
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
      const pageHeight = doc.internal.pageSize.height;
      const currentYear = new Date().getFullYear();
      
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

      // Konversi data untuk tabel
      const tableData = siswaDiKelas.map((std, index) => {
        const d = dataBulanIni.filter(a => a.student_user_id === std.user_id);
        const h = d.filter(a => a.status === 'hadir').length;
        const s = d.filter(a => a.status === 'sakit').length;
        const i = d.filter(a => a.status === 'izin').length;
        const b = d.filter(a => a.status === 'bolos').length;
        const a = d.filter(x => ['alpa', 'alpha'].includes(x.status)).length;
        
        // Hitung Persentase (Hadir / Total Hari Input)
        const totalInput = h + s + i + b + a;
        const persen = totalInput > 0 ? ((h / totalInput) * 100).toFixed(0) : 0;

        return [index + 1, std.full_name, std.nis || '-', h, s, i, b, a, `${persen}%`];
      });

      // Fungsi Header (untuk dipanggil jika ganti halaman)
      const drawHeader = (d) => {
        const logoKiri = config?.logo_kiri_url; // Simulasi base64 jika sudah di-cache
        doc.setFont("times", "bold");
        doc.setFontSize(14);
        doc.text((safeConfig.nama_sekolah || "PEMERINTAH KOTA PALU").toUpperCase(), pageWidth / 2, 18, { align: "center" });
        doc.setFontSize(10);
        doc.text("LAPORAN REKAPITULASI ABSENSI SISWA", pageWidth / 2, 25, { align: "center" });
        doc.setLineWidth(0.5);
        doc.line(15, 30, pageWidth - 15, 30);
      };

      autoTable(doc, {
        startY: 40,
        head: [['No', 'Nama Siswa', 'NIS', 'H', 'S', 'I', 'B', 'A', '%']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [20, 83, 45], halign: 'center' },
        styles: { font: "times", fontSize: 9, halign: 'center' },
        columnStyles: { 1: { halign: 'left', cellWidth: 60 }, 8: { fontStyle: 'bold' } },
        didDrawPage: (data) => {
            // Gambar logo hanya di halaman pertama
            if (data.pageNumber === 1) drawHeader();
        },
        // LOGIKA PENTING: Mencegah TTD Sendirian (Orphan)
        rowPageBreak: 'auto',
        margin: { bottom: 60 }, // Beri ruang 60mm untuk TTD
      });

      let finalY = doc.lastAutoTable.finalY + 15;

      // Jika baris terakhir terlalu mepet ke bawah, autoTable sudah otomatis pindah halaman 
      // karena kita beri margin bottom 60. Jika finalY kecil, berarti dia ada di halaman baru.
      
      const tglSekarang = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      
      doc.setFont("times", "normal");
      doc.setFontSize(10);
      doc.text(`${safeConfig.kota_cetak || "Palu"}, ${tglSekarang}`, pageWidth - 75, finalY);
      doc.text("Wali Kelas,", pageWidth - 75, finalY + 6);
      
      doc.setFont("times", "bold");
      doc.text("( ____________________ )", pageWidth - 75, finalY + 30);
      doc.setFont("times", "normal");
      doc.text("NIP. .................................", pageWidth - 75, finalY + 35);

      doc.save(`REKAP_${namaKelas}_${daftarBulan[selectedMonth]}.pdf`);
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
            <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                <FileCheck className="text-green-600"/> Laporan Absensi Bulanan
            </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <label className="text-xs font-black text-gray-400 uppercase block mb-3">Pilih Bulan</label>
                <select 
                    className="w-full p-3 bg-gray-50 border-none rounded-xl font-bold text-gray-700 focus:ring-2 focus:ring-green-500"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                >
                    {daftarBulan.map((bln, idx) => <option key={idx} value={idx}>{bln}</option>)}
                </select>
            </div>

            <div className="md:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <label className="text-xs font-black text-gray-400 uppercase block mb-3">Cetak Laporan Per Kelas</label>
                <div className="flex flex-wrap gap-2">
                    {daftarKelas.map((kls, i) => (
                        <button
                            key={i}
                            onClick={() => handleDownloadRekapSempurna(kls)}
                            disabled={loadingDownload}
                            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all disabled:opacity-50"
                        >
                            {loadingDownload ? <Loader2 className="animate-spin" size={16}/> : <Printer size={16}/>}
                            Kelas {kls}
                        </button>
                    ))}
                </div>
            </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-gray-700">Database Siswa</h3>
                <input 
                    type="text" 
                    placeholder="Cari nama..." 
                    className="bg-gray-50 border-none rounded-lg text-sm px-4 py-2 w-64"
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-400 text-[10px] font-black uppercase">
                    <tr>
                        <th className="px-6 py-4">Nama Siswa</th>
                        <th className="px-6 py-4 text-center">Kelas</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {siswa.filter(s => s.full_name.toLowerCase().includes(search.toLowerCase())).map((s, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                            <td className="px-6 py-4 font-bold text-gray-700">{s.full_name}</td>
                            <td className="px-6 py-4 text-center"><span className="text-blue-600 font-bold">{s.kelas_name}</span></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}

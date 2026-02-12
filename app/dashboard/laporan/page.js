"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FileText, Printer, Filter, Loader2, User, CheckCircle2, XCircle, Users, Search } from "lucide-react";

export default function LaporanPage() {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(null);
  const [allData, setAllData] = useState([]);
  const [selectedRole, setSelectedRole] = useState("all");
  const [selectedGuru, setSelectedGuru] = useState("all");
  const [bulan, setBulan] = useState("Februari");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // 1. Ambil Konfigurasi
      const { data: conf } = await supabase.from("app_config").select("*").single();
      if (conf) setConfig(conf);

      // 2. Ambil Laporan & Harian
      const { data: laporan } = await supabase.from("view_laporan_guru_final").select("*");
      const { data: dataHarian } = await supabase.from("view_laporan_absensi_harian").select("*");

      if (laporan && dataHarian) {
        const combined = laporan.map(l => {
          const targetNum = parseInt(l.target) || 0;
          const hadirNum = parseInt(l.total_hadir) || 0;
          const hitungPersen = targetNum > 0 ? ((hadirNum / targetNum) * 100).toFixed(1) : 0;

          return {
            ...l,
            target: targetNum,
            total_hadir: hadirNum,
            persentase: hitungPersen,
            harian: dataHarian.find(h => h.nama_pegawai === l.nama_guru) || {}
          };
        });
        setAllData(combined);
      }
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = allData.filter(item => {
    const matchRole = selectedRole === "all" || item.role === selectedRole;
    const matchGuru = selectedGuru === "all" || item.nama_guru === selectedGuru;
    return matchRole && matchGuru;
  });

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

  const handlePrint = async () => {
    if (!config) return alert("Silakan lengkapi pengaturan di menu Setting!");
    setLoading(true);

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    try {
      const logoKiri = await getBase64Image(config.logo_kiri_url);
      const logoKanan = await getBase64Image(config.logo_kanan_url);

      if (logoKiri) doc.addImage(logoKiri, "PNG", 12, 10, 22, 22);
      if (logoKanan) doc.addImage(logoKanan, "PNG", pageWidth - 34, 10, 22, 22);

      doc.setFont("times", "bold");
      doc.setFontSize(12);
      doc.text("PEMERINTAH KOTA PALU", pageWidth / 2, 15, { align: "center" });
      doc.text("DINAS PENDIDIKAN KOTA PALU", pageWidth / 2, 21, { align: "center" });
      doc.setFontSize(14);
      doc.text((config.nama_sekolah || "SMP NEGERI 9 PALU").toUpperCase(), pageWidth / 2, 28, { align: "center" });
      doc.setLineWidth(0.8);
      doc.line(10, 35, pageWidth - 10, 35);

      if (selectedGuru !== "all" && filteredData.length > 0) {
        // --- INDIVIDU ---
        const data = filteredData[0];
        doc.setFontSize(11);
        doc.text(`LAPORAN KEHADIRAN INDIVIDU - ${bulan.toUpperCase()} ${new Date().getFullYear()}`, pageWidth / 2, 45, { align: "center" });
        doc.text(`Nama Pegawai : ${data.nama_guru}`, 15, 55);
        doc.text(`Jabatan      : ${data.role.toUpperCase()}`, 15, 62);

        autoTable(doc, {
          startY: 70,
          head: [['Keterangan', 'Informasi Kehadiran']],
          body: [
            ['Senin', data.harian?.senin ? 'HADIR (OK)' : 'TIDAK HADIR / ABSEN'],
            ['Selasa', data.harian?.selasa ? 'HADIR (OK)' : 'TIDAK HADIR / ABSEN'],
            ['Rabu', data.harian?.rabu ? 'HADIR (OK)' : 'TIDAK HADIR / ABSEN'],
            ['Kamis', data.harian?.kamis ? 'HADIR (OK)' : 'TIDAK HADIR / ABSEN'],
            ['Jumat', data.harian?.jumat ? 'HADIR (OK)' : 'TIDAK HADIR / ABSEN'],
            ['Total Realisasi', `${data.total_hadir} Sesi`],
            ['Target Wajib', `${data.target} Sesi`],
            ['Persentase Capaian', `${data.persentase}%`],
          ],
          theme: 'striped',
          headStyles: { fillColor: [30, 64, 175] },
        });
      } else {
        // --- KOLEKTIF ---
        doc.setFontSize(11);
        doc.text(`LAPORAN REKAPITULASI PEGAWAI - ${bulan.toUpperCase()} ${new Date().getFullYear()}`, pageWidth / 2, 45, { align: "center" });
        
        autoTable(doc, {
          startY: 52,
          head: [['No', 'Nama Pegawai', 'Jabatan', 'Hadir', 'Target', '%']],
          body: filteredData.map((g, i) => [i + 1, g.nama_guru, g.role.toUpperCase(), g.total_hadir, g.target, `${g.persentase}%`]),
          theme: 'grid',
          headStyles: { fillColor: [30, 64, 175] },
        });
      }

      const finalY = doc.lastAutoTable.finalY + 20;
      doc.setFont("times", "normal");
      doc.text(`${config.kota_cetak || "Palu"}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageWidth - 75, finalY);
      doc.text("Kepala Sekolah,", pageWidth - 75, finalY + 7);
      doc.setFont("times", "bold");
      doc.text(config.nama_kepsek || "....................", pageWidth - 75, finalY + 30);
      doc.setFont("times", "normal");
      doc.text(`NIP. ${config.nip_kepsek || "-"}`, pageWidth - 75, finalY + 36);

      doc.save(`Laporan_${selectedGuru}_${bulan}.pdf`);
    } catch (err) {
      alert("Gagal mencetak PDF.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen p-6 md:p-8">
      {/* Container diperlebar ke max-w-7xl untuk Laptop */}
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-3">
              <FileText className="text-blue-600" size={32}/> Laporan Pegawai
            </h1>
            <p className="text-gray-500 text-sm mt-1">Rekapitulasi absensi Guru & Staf SMPN 9 Palu</p>
          </div>
          <button 
            onClick={handlePrint} 
            disabled={loading}
            className="w-full md:w-auto bg-blue-700 hover:bg-blue-800 text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20}/> : <Printer size={20}/>}
            <span>CETAK PDF</span>
          </button>
        </div>

        {/* Filter Panel (Desain Lebih Bersih) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Periode Bulan</label>
              <div className="relative">
                <select 
                  className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium appearance-none"
                  value={bulan} 
                  onChange={(e) => setBulan(e.target.value)}
                >
                  {["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-3.5 pointer-events-none text-gray-400">▼</div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Filter Jabatan</label>
              <div className="relative">
                <select 
                  className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium appearance-none"
                  value={selectedRole} 
                  onChange={(e) => {setSelectedRole(e.target.value); setSelectedGuru("all");}}
                >
                  <option value="all">Semua Jabatan</option>
                  <option value="guru">Guru</option>
                  <option value="bk">BK (Konseling)</option>
                  <option value="tu">TU (Tata Usaha)</option>
                </select>
                <div className="absolute right-3 top-3.5 pointer-events-none text-gray-400">▼</div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Cari Nama</label>
              <div className="relative">
                <select 
                  className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium appearance-none"
                  value={selectedGuru} 
                  onChange={(e) => setSelectedGuru(e.target.value)}
                >
                  <option value="all">Semua Pegawai</option>
                  {allData.filter(i => selectedRole === "all" || i.role === selectedRole).map((g, idx) => (
                    <option key={idx} value={g.nama_guru}>{g.nama_guru}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-3.5 pointer-events-none text-gray-400">
                  <Search size={16}/>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabel Data (Fitur Scroll & Sticky Header) */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden flex flex-col">
          {/* Wrapper Tabel dengan Scroll Y Terbatas */}
          <div className="overflow-x-auto overflow-y-auto max-h-150">
            <table className="w-full text-sm text-left">
              {/* Sticky Header: Judul tetap di atas saat discroll */}
              <thead className="bg-blue-900 text-white sticky top-0 z-10 shadow-md">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold">Nama Lengkap</th>
                  <th className="px-2 py-4 text-center">Senin</th>
                  <th className="px-2 py-4 text-center">Selasa</th>
                  <th className="px-2 py-4 text-center">Rabu</th>
                  <th className="px-2 py-4 text-center">Kamis</th>
                  <th className="px-2 py-4 text-center">Jumat</th>
                  <th className="px-4 py-4 text-center">Target</th>
                  <th className="px-6 py-4 text-center">Capaian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.length > 0 ? (
                  filteredData.map((item, i) => (
                    <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-6 py-4 text-left border-r border-gray-100">
                        <div className="font-bold text-gray-900">{item.nama_guru}</div>
                        <div className="text-[10px] text-blue-600 font-bold uppercase tracking-wide bg-blue-50 inline-block px-2 py-0.5 rounded mt-1">
                          {item.role}
                        </div>
                      </td>
                      <td className="p-3 text-center">{item.harian?.senin ? <CheckCircle2 className="text-green-500 mx-auto fill-green-100" size={24}/> : <XCircle className="text-gray-300 mx-auto" size={24}/>}</td>
                      <td className="p-3 text-center">{item.harian?.selasa ? <CheckCircle2 className="text-green-500 mx-auto fill-green-100" size={24}/> : <XCircle className="text-gray-300 mx-auto" size={24}/>}</td>
                      <td className="p-3 text-center">{item.harian?.rabu ? <CheckCircle2 className="text-green-500 mx-auto fill-green-100" size={24}/> : <XCircle className="text-gray-300 mx-auto" size={24}/>}</td>
                      <td className="p-3 text-center">{item.harian?.kamis ? <CheckCircle2 className="text-green-500 mx-auto fill-green-100" size={24}/> : <XCircle className="text-gray-300 mx-auto" size={24}/>}</td>
                      <td className="p-3 text-center border-r border-gray-100">{item.harian?.jumat ? <CheckCircle2 className="text-green-500 mx-auto fill-green-100" size={24}/> : <XCircle className="text-gray-300 mx-auto" size={24}/>}</td>
                      <td className="px-4 py-4 font-bold text-gray-400 text-center">{item.target}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-sm font-bold px-3 py-1 rounded-full ${parseFloat(item.persentase) >= 90 ? 'bg-green-100 text-green-700' : parseFloat(item.persentase) >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                          {item.persentase}%
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="text-center py-10 text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <Users size={40} className="text-gray-300"/>
                        <p>Tidak ada data pegawai yang ditemukan untuk filter ini.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-gray-50 px-6 py-3 border-t text-xs text-gray-500 flex justify-between items-center">
             <span>Menampilkan {filteredData.length} Data Pegawai</span>
             <span>DIGIDAS SMPN 9 Palu v1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { Save, Loader2, Image as ImageIcon } from "lucide-react";

export default function SettingPage() {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  // Data Form (Sekarang sudah ada watermark_url)
  const [formData, setFormData] = useState({
    nama_sekolah: "",
    alamat_sekolah: "",
    nama_kepsek: "",
    nip_kepsek: "",
    kota_cetak: "",
    logo_kiri_url: "",
    logo_kanan_url: "",
    watermark_url: "" // <--- Tambahan baru
  });

  // 1. Ambil Data Saat Halaman Dibuka
  useEffect(() => {
    const loadData = async () => {
      const { data, error } = await supabase
        .from('app_config')
        .select('*')
        .single();

      if (data) {
        setFormData(data);
      }
      setFetching(false);
    };
    loadData();
  }, []);

  // 2. Simpan Perubahan (Menggunakan UPSERT agar data baru otomatis dibuat)
  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Upsert: Jika ID 1 belum ada, dia buat baru. Jika ada, dia update.
    const { error } = await supabase
      .from('app_config')
      .upsert({ 
        id: 1, 
        ...formData 
      }); 

    if (error) {
      alert("Gagal menyimpan: " + error.message);
    } else {
      alert("Pengaturan Berhasil Disimpan!");
      // Reload agar data benar-benar terlihat terupdate
      window.location.reload();
    }
    setLoading(false);
  };

  if (fetching) return <div className="p-10 text-center flex justify-center"><Loader2 className="animate-spin mr-2"/> Memuat Pengaturan...</div>;

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-4 flex items-center gap-2">
        <ImageIcon className="text-blue-600"/> Pengaturan Atribut Laporan
      </h1>

      <div className="bg-white shadow-lg rounded-xl overflow-hidden">
        <form onSubmit={handleSave} className="p-8 grid grid-cols-1 gap-8">
          
          {/* BAGIAN A: Identitas Sekolah */}
          <section className="space-y-4">
            <h3 className="font-bold text-lg text-gray-800 border-l-4 border-blue-500 pl-3">A. Identitas Sekolah (Kop Surat)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-5 rounded-lg">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-600 mb-1">Nama Sekolah (Judul Kop)</label>
                <input 
                  type="text" required
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition"
                  placeholder="Contoh: SMP NEGERI 9 PALU"
                  value={formData.nama_sekolah || ""}
                  onChange={(e) => setFormData({...formData, nama_sekolah: e.target.value})}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-600 mb-1">Alamat Lengkap (Sub-judul Kop)</label>
                <textarea 
                  rows="2"
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition"
                  placeholder="Jl. Contoh No. 1, Kota Palu..."
                  value={formData.alamat_sekolah || ""}
                  onChange={(e) => setFormData({...formData, alamat_sekolah: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Kota (Tempat Tanda Tangan)</label>
                <input 
                  type="text" 
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition"
                  placeholder="Palu"
                  value={formData.kota_cetak || ""}
                  onChange={(e) => setFormData({...formData, kota_cetak: e.target.value})}
                />
              </div>
            </div>
          </section>

          {/* BAGIAN B: Kepala Sekolah */}
          <section className="space-y-4">
            <h3 className="font-bold text-lg text-gray-800 border-l-4 border-green-500 pl-3">B. Data Kepala Sekolah</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-5 rounded-lg">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Nama Lengkap & Gelar</label>
                <input 
                  type="text" 
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 outline-none transition"
                  placeholder="Drs. H. Nama Kepsek, M.Pd"
                  value={formData.nama_kepsek || ""}
                  onChange={(e) => setFormData({...formData, nama_kepsek: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">NIP</label>
                <input 
                  type="text" 
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 outline-none transition"
                  placeholder="19800101 200001 1 001"
                  value={formData.nip_kepsek || ""}
                  onChange={(e) => setFormData({...formData, nip_kepsek: e.target.value})}
                />
              </div>
            </div>
          </section>

          {/* BAGIAN C: Logo & Watermark */}
          <section className="space-y-4">
            <h3 className="font-bold text-lg text-gray-800 border-l-4 border-yellow-500 pl-3">C. Logo & Watermark</h3>
            <div className="bg-yellow-50 p-5 rounded-lg border border-yellow-100">
              <p className="text-sm text-yellow-800 mb-4 bg-yellow-100 p-2 rounded inline-block">
                ℹ️ Masukkan <strong>URL Gambar</strong> (Link) yang valid. Bisa format .png atau .jpg.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">URL Logo Kiri (Pemda)</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-yellow-500"
                    placeholder="https://..."
                    value={formData.logo_kiri_url || ""}
                    onChange={(e) => setFormData({...formData, logo_kiri_url: e.target.value})}
                  />
                  {formData.logo_kiri_url && <img src={formData.logo_kiri_url} alt="Preview" className="h-12 mt-2 object-contain"/>}
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">URL Logo Kanan (Sekolah)</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-yellow-500"
                    placeholder="https://..."
                    value={formData.logo_kanan_url || ""}
                    onChange={(e) => setFormData({...formData, logo_kanan_url: e.target.value})}
                  />
                   {formData.logo_kanan_url && <img src={formData.logo_kanan_url} alt="Preview" className="h-12 mt-2 object-contain"/>}
                </div>

                {/* INPUT BARU: WATERMARK */}
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">URL Watermark (Tengah)</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-yellow-500"
                    placeholder="https://..."
                    value={formData.watermark_url || ""}
                    onChange={(e) => setFormData({...formData, watermark_url: e.target.value})}
                  />
                   {formData.watermark_url && <img src={formData.watermark_url} alt="Preview" className="h-12 mt-2 object-contain opacity-50"/>}
                </div>
              </div>
            </div>
          </section>

          {/* TOMBOL SIMPAN */}
          <div className="flex justify-end pt-6 border-t mt-4">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-700 hover:bg-blue-800 text-white font-bold py-3 px-8 rounded-lg flex items-center gap-2 shadow-lg transition-all transform hover:scale-105"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
              Simpan Semua Pengaturan
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
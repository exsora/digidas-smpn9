"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { Users, UserPlus, Trash2, ShieldCheck, Mail } from "lucide-react";

export default function PegawaiPage() {
  const [pegawai, setPegawai] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPegawai();
  }, []);

  const fetchPegawai = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['guru', 'bk', 'tu', 'admin'])
        .order('full_name', { ascending: true });
      if (data) setPegawai(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 bg-white min-h-screen rounded-3xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="text-blue-600"/> Data Staf & Pengajar
          </h1>
          <p className="text-gray-500 text-sm">Kelola akun Guru, BK, dan Tata Usaha SMPN 9 Palu.</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all">
          <UserPlus size={20}/> Tambah Pegawai
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pegawai.map((p, i) => (
          <div key={i} className="border border-gray-100 rounded-2xl p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className={`absolute top-0 right-0 px-4 py-1 rounded-bl-xl text-[10px] font-black uppercase ${p.role === 'admin' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
              {p.role}
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-400">
                {p.full_name?.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-gray-800">{p.full_name}</h3>
                <p className="text-xs text-gray-400 flex items-center gap-1"><Mail size={12}/> {p.email || 'Email belum diatur'}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-between items-center pt-4 border-t border-gray-50">
               <span className="text-[10px] text-gray-400">NIP: {p.nip || '-'}</span>
               <button className="text-red-300 hover:text-red-600 transition-colors"><Trash2 size={18}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
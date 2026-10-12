import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BELUM_DIKATEGORIKAN, tebakSubkategori } from '../lib/subkategori'

const JEDA_MS = 700

async function accessToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ''
}

// Tebak subkategori otomatis dari judul & uraian item (dipakai Form dan Ubah pengajuan).
// status: 'kosong' | 'mendeteksi' | 'terdeteksi' | 'tidak_yakin' | 'gagal'
// pastikan(): dipanggil saat Kirim — menunggu/ulang tebakan, selalu mengembalikan nama subkategori.
// awal (opsional, halaman Ubah): { judul, items, subkategori } tersimpan. Selama judul & item tidak
// diubah, subkategori tersimpan dipakai (koreksi CFO/Finance tidak tertimpa tebakan baru).
const buatKunci = (judul, items) => JSON.stringify([String(judul || '').trim(), (items || []).map((u) => String(u || '').trim()).filter(Boolean)])

export function useSubkategoriOtomatis(judul, uraianItems, awal = null) {
  const [hasil, setHasil] = useState({ status: 'kosong', subkategori: null, kunci: '' })
  const kunci = buatKunci(judul, uraianItems)
  const kunciAwal = awal ? buatKunci(awal.judul, awal.items) : null
  const pakaiAwal = !!awal?.subkategori && kunci === kunciAwal
  const terakhir = useRef(null)

  useEffect(() => {
    const [j, items] = JSON.parse(kunci)
    if (j.length < 4 || pakaiAwal) return
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      setHasil({ status: 'mendeteksi', subkategori: null, kunci })
      try {
        const r = await tebakSubkategori({ judul: j, items }, await accessToken(), { signal: ctrl.signal })
        const next = { status: r.subkategori ? 'terdeteksi' : 'tidak_yakin', subkategori: r.subkategori, kunci }
        terakhir.current = next
        setHasil(next)
      } catch (e) {
        if (e.name !== 'AbortError') setHasil({ status: 'gagal', subkategori: null, kunci })
      }
    }, JEDA_MS)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [kunci, pakaiAwal])

  async function pastikan() {
    if (pakaiAwal) return awal.subkategori
    if (terakhir.current?.kunci === kunci && terakhir.current.subkategori) return terakhir.current.subkategori
    const [j, items] = JSON.parse(kunci)
    try {
      const r = await tebakSubkategori({ judul: j, items }, await accessToken())
      return r.subkategori || BELUM_DIKATEGORIKAN
    } catch {
      return BELUM_DIKATEGORIKAN
    }
  }

  if (pakaiAwal) return { status: 'terdeteksi', subkategori: awal.subkategori, pastikan }
  const aktif = judul.trim().length >= 4 && hasil.kunci === kunci
  return { status: aktif ? hasil.status : 'kosong', subkategori: aktif ? hasil.subkategori : null, pastikan }
}

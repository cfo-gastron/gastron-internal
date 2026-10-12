import { test } from 'node:test'
import assert from 'node:assert/strict'
import { REKENING_FIELDS, rapikanRekening, labelRekening } from '../src/lib/rekening.js'

test('Urutan isian rekening', () => {
  assert.deepEqual(REKENING_FIELDS.map((f) => f.key), ['atas_nama', 'bank', 'no_rekening', 'nama_penerima'])
  assert.ok(!REKENING_FIELDS.some((f) => /Nama Penerima/.test(f.label)))
})

test('rapikanRekening: buang baris kosong, pihak kosong = atas nama, baris tanpa pihak tidak terbuang', () => {
  const r = rapikanRekening([
    { atas_nama: ' Yusronudin ', bank: 'BCA', no_rekening: '123', nama_penerima: '' },
    { atas_nama: '', bank: '', no_rekening: '', nama_penerima: '' },
    { atas_nama: 'Hartono', bank: 'BRI', no_rekening: '9', nama_penerima: 'Toko Sumber Teknik' },
  ])
  assert.equal(r.length, 2)
  assert.equal(r[0].nama_penerima, 'Yusronudin')
  assert.equal(r[0].atas_nama, 'Yusronudin')
  assert.equal(r[1].nama_penerima, 'Toko Sumber Teknik')
})

test('labelRekening untuk kalimat konfirmasi', () => {
  assert.equal(labelRekening({ atas_nama: 'Yusronudin', bank: 'BCA', no_rekening: '123' }), 'Yusronudin (BCA 123)')
  assert.equal(labelRekening({ nama_penerima: 'Pak Yusron' }), 'Pak Yusron')
  assert.equal(labelRekening(null), '-')
})

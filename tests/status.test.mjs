// Kartu angka Dashboard & filter memakai kelompok yang sama
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { STATUS_GROUPS, STATUS_LABEL, matchStatusFilter } from '../src/lib/status.js'

test('Setiap status punya label, dan tiap status (kecuali draft) masuk tepat satu kelompok', () => {
  for (const s of Object.keys(STATUS_LABEL)) {
    const n = Object.values(STATUS_GROUPS).filter((g) => g.includes(s)).length
    assert.equal(n, s === 'draft' ? 0 : 1, s)
  }
})

test('Filter kelompok = isi kelompok; filter status tunggal tetap jalan', () => {
  for (const [g, list] of Object.entries(STATUS_GROUPS))
    for (const s of Object.keys(STATUS_LABEL)) assert.equal(matchStatusFilter(s, 'grup:' + g), list.includes(s))
  assert.ok(matchStatusFilter('hold', 'hold'))
  assert.ok(!matchStatusFilter('hold', 'rejected'))
  assert.ok(matchStatusFilter('apa saja', ''))
})

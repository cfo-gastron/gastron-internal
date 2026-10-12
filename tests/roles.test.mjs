// Role & admin (Pengaturan → Pengguna)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ROLE_VALUES, labelRole, bolehCabutAdmin, BELUM_ADA_ROLE } from '../src/lib/roles.js'

test('8 role sama persis dengan constraint database', () => {
  assert.deepEqual(ROLE_VALUES, ['operational', 'procurement', 'corporate_secretary', 'finance', 'coo', 'cao', 'cfo', 'ceo'])
})
test('labelRole: kosong -> Belum ada role, tak dikenal -> apa adanya', () => {
  assert.equal(labelRole(null), BELUM_ADA_ROLE)
  assert.equal(labelRole('procurement'), 'Procurement')
  assert.equal(labelRole('xyz'), 'xyz')
})
test('bolehCabutAdmin: admin terakhir tidak boleh dicabut', () => {
  const a = { id: 1, is_admin: true }, b = { id: 2, is_admin: false }
  assert.equal(bolehCabutAdmin(a, [a, b]), false)
  assert.equal(bolehCabutAdmin(a, [a, { ...b, is_admin: true }]), true)
  assert.equal(bolehCabutAdmin(b, [a, b]), false)
})

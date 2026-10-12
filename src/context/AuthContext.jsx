import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle()
    if (data || error) { setProfile(data || null); setLoading(false); return }
    // Baris profil belum ada (biasanya dibuat otomatis oleh database saat login pertama).
    // Dibuat tanpa role: role hanya bisa diatur admin di Pengaturan → Pengguna.
    const u = (await supabase.auth.getUser()).data.user
    const { data: baru } = await supabase.from('users')
      .insert({ id: userId, email: u?.email, full_name: u?.user_metadata?.full_name, avatar_url: u?.user_metadata?.avatar_url })
      .select().maybeSingle()
    setProfile(baru || { id: userId, email: u?.email, full_name: u?.user_metadata?.full_name, role: null })
    setLoading(false)
  }

  // Ambil ulang profil (misalnya setelah Telegram terhubung)
  async function refreshProfile() {
    const currentUser = (await supabase.auth.getUser()).data.user
    if (currentUser) await fetchProfile(currentUser.id)
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin: profile?.is_admin === true, loading, signInWithGoogle, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}
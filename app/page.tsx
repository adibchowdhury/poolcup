import LandingPage from "@/components/pages/landing-page"
import { supabase } from "@/src/lib/supabase"

export default async function Home() {
  const { data, error } = await supabase.from('matches').select('*').limit(1)
  console.log('SUPABASE TEST — data:', data, 'error:', error)
  
  return <LandingPage />
}
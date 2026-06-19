import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'behniab@gmail.com'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (toSet) => {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user?.email === ADMIN_EMAIL) {
      // Store Google refresh token for Calendar API use
      if (data.session?.provider_refresh_token) {
        const admin = createAdminClient()
        await admin
          .from('settings')
          .update({ google_refresh_token: data.session.provider_refresh_token })
          .eq('id', 1)
      }
      return NextResponse.redirect(`${origin}/admin/dashboard`)
    }

    if (!error && data.user?.email !== ADMIN_EMAIL) {
      await supabase.auth.signOut()
      return NextResponse.redirect(`${origin}/auth/signin?error=unauthorized`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/signin?error=callback_failed`)
}

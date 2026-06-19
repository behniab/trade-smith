import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'behniab@gmail.com'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/signin?error=callback_failed`)
  }

  // Create the redirect response first so we can set cookies directly on it
  const successRedirect = NextResponse.redirect(`${origin}/admin/dashboard`)
  const failRedirect = (msg: string) =>
    NextResponse.redirect(`${origin}/auth/signin?error=${msg}`)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        // Write cookies onto the redirect response, not a separate cookie store
        setAll: (toSet) => {
          toSet.forEach(({ name, value, options }) =>
            successRedirect.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) return failRedirect('callback_failed')

  if (data.user?.email !== ADMIN_EMAIL) {
    await supabase.auth.signOut()
    return failRedirect('unauthorized')
  }

  // Store Google refresh token for Calendar API
  if (data.session?.provider_refresh_token) {
    const admin = createAdminClient()
    await admin
      .from('settings')
      .update({ google_refresh_token: data.session.provider_refresh_token })
      .eq('id', 1)
  }

  return successRedirect
}

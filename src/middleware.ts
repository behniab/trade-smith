import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const ADMIN_EMAILS = new Set(['behniab@gmail.com', 'dannymgabe@gmail.com'])

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith('/admin')) return NextResponse.next()

  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !ADMIN_EMAILS.has(user.email ?? '')) {
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const QB_TOKEN = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const realmId = searchParams.get('realmId')

  if (!code || !realmId) {
    return NextResponse.redirect(new URL('/admin/settings/integrations?qb=error&reason=missing_code', req.url))
  }

  const supabase = createAdminClient()
  const { data: settings } = await supabase
    .from('settings')
    .select('qb_client_id, qb_client_secret')
    .single()

  if (!settings?.qb_client_id) {
    return NextResponse.redirect(new URL('/admin/settings/integrations?qb=error&reason=not_configured', req.url))
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/integrations/quickbooks/callback`
  const creds = Buffer.from(`${settings.qb_client_id}:${settings.qb_client_secret}`).toString('base64')

  const res = await fetch(QB_TOKEN, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
  })

  if (!res.ok) {
    return NextResponse.redirect(new URL('/admin/settings/integrations?qb=error&reason=token_exchange', req.url))
  }

  const tokens = await res.json()
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  await supabase.from('settings').update({
    qb_realm_id: realmId,
    qb_access_token: tokens.access_token,
    qb_refresh_token: tokens.refresh_token,
    qb_token_expires_at: expiresAt,
  }).eq('id', 1)

  return NextResponse.redirect(new URL('/admin/settings/integrations?qb=connected', req.url))
}

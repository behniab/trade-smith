import { NextRequest, NextResponse } from 'next/server'
import { VendorInfo } from '@/types'

interface OverpassElement {
  type: string
  tags?: Record<string, string>
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
}

function formatAddress(tags: Record<string, string>): string {
  const parts = [
    tags['addr:housenumber'] && tags['addr:street']
      ? `${tags['addr:housenumber']} ${tags['addr:street']}`
      : tags['addr:street'],
    tags['addr:city'],
    tags['addr:state'] && tags['addr:postcode']
      ? `${tags['addr:state']} ${tags['addr:postcode']}`
      : tags['addr:state'] || tags['addr:postcode'],
  ].filter(Boolean)
  return parts.join(', ')
}

function formatPhone(raw?: string): string {
  if (!raw) return ''
  return raw.replace(/[^\d+\-() ]/g, '').trim()
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || 'plumbing supply'
  const area = searchParams.get('area') || ''

  if (!area) return NextResponse.json({ vendors: [] })

  try {
    // Step 1: Geocode the service area
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(area)}&format=json&limit=1&countrycodes=us`,
      { headers: { 'User-Agent': 'TradeSmith-Plumbing/1.0 (trade-smith.vercel.app)' } }
    )
    const geoData = await geoRes.json()
    if (!geoData.length) return NextResponse.json({ vendors: [], error: 'Area not found' })

    const { lat, lon } = geoData[0]
    const radiusMeters = 30000 // 30km / ~19 miles

    // Step 2: Overpass query — plumbing supply shops + hardware stores + name-matched vendors
    const namePattern = q.split(' ').join('|')
    const overpassQuery = `
[out:json][timeout:12];
(
  nwr["shop"="plumbing"](around:${radiusMeters},${lat},${lon});
  nwr["shop"="hardware"](around:${radiusMeters},${lat},${lon});
  nwr["shop"="doityourself"](around:${radiusMeters},${lat},${lon});
  nwr["name"~"${namePattern}",i]["name"](around:${radiusMeters},${lat},${lon});
  nwr["name"~"Ferguson|Hajoca|Winsupply|Grainger|HD Supply|Lowe|Home Depot|Plumbing Supply|Building Supply",i](around:${radiusMeters},${lat},${lon});
);
out body center;`

    const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: overpassQuery,
      headers: { 'Content-Type': 'text/plain' },
    })
    const overpassData = await overpassRes.json()

    const seen = new Set<string>()
    const vendors: VendorInfo[] = (overpassData.elements as OverpassElement[])
      .filter(el => el.tags?.name)
      .map(el => {
        const address = formatAddress(el.tags!)
        return {
          name: el.tags!.name!,
          address: address || area,
          phone: formatPhone(
            el.tags!['phone'] ||
            el.tags!['contact:phone'] ||
            el.tags!['contact:mobile']
          ),
        }
      })
      .filter(v => {
        const key = v.name.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .sort((a, b) => {
        // Prefer results that match the search query
        const al = a.name.toLowerCase(), bl = b.name.toLowerCase()
        const ql = q.toLowerCase()
        return (bl.includes(ql) ? 1 : 0) - (al.includes(ql) ? 1 : 0)
      })
      .slice(0, 15)

    return NextResponse.json({ vendors })
  } catch (err) {
    console.error('Vendor search error:', err)
    return NextResponse.json({ vendors: [], error: 'Search failed' })
  }
}

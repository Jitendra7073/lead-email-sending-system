import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const field = searchParams.get('field');

        if (!field) {
            return NextResponse.json({ success: false, error: 'Field parameter required' }, { status: 400 });
        }

        let data: any[] = [];

        if (field === 'country') {
            // Get unique countries from both contacts.country_code and sites.country
            const result = await executeQuery(`
        SELECT DISTINCT country_code as value
        FROM contacts
        WHERE country_code IS NOT NULL AND country_code != ''
        UNION
        SELECT DISTINCT country as value
        FROM sites
        WHERE country IS NOT NULL AND country != ''
        ORDER BY value
      `);
            data = result.map(r => r.value);
        } else if (field === 'site_url') {
            // Get unique site URLs with contact counts
            const result = await executeQuery(`
        SELECT 
          COALESCE(s.url, c.source_page) as url,
          COUNT(c.id) as count
        FROM contacts c
        LEFT JOIN sites s ON c.site_id = s.id
        WHERE COALESCE(s.url, c.source_page) IS NOT NULL
        GROUP BY COALESCE(s.url, c.source_page)
        ORDER BY count DESC, url
        LIMIT 100
      `);
            data = result.map(r => ({ url: r.url, count: parseInt(r.count) }));
        } else {
            return NextResponse.json({ success: false, error: 'Invalid field' }, { status: 400 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

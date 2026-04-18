import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

// Lookup or create a site by URL
export async function POST(request: Request) {
    try {
        const { url, country } = await request.json();

        if (!url?.trim()) {
            return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 });
        }

        const normalised = url.trim().replace(/\/$/, ''); // strip trailing slash

        // Try to find existing site
        const existing = await executeQuery(
            'SELECT id, url, country FROM sites WHERE url = $1 LIMIT 1',
            [normalised]
        );

        if (existing.length > 0) {
            return NextResponse.json({ success: true, data: existing[0], created: false });
        }

        // Create new site row with minimal required fields
        const result = await executeQuery(
            `INSERT INTO sites (url, country) VALUES ($1, $2) RETURNING id, url, country`,
            [normalised, (country || 'unknown').toLowerCase()]
        );

        return NextResponse.json({ success: true, data: result[0], created: true }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

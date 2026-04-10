import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';

export async function GET() {
  try {
    const data = await executeQuery('SELECT * FROM email_senders ORDER BY created_at DESC');
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, app_password, service = 'gmail', smtp_host = 'smtp.gmail.com', smtp_port = 587, smtp_user, daily_limit = 500, alias_email } = body;

    if (!name || !email || !app_password) {
      return NextResponse.json({ success: false, error: 'Name, email, and app_password are required' }, { status: 400 });
    }

    const query = `
      INSERT INTO email_senders (name, email, app_password, service, smtp_host, smtp_port, smtp_user, daily_limit, alias_email)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const params = [name, email, app_password, service, smtp_host, smtp_port, smtp_user || email, daily_limit, alias_email || null];

    const result = await executeQuery(query, params);
    return NextResponse.json({ success: true, data: result[0] }, { status: 201 });
  } catch (error: any) {
    if (error.code === '23505') { // unique violation
      return NextResponse.json({ success: false, error: 'Email sender with this exact address already exists' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

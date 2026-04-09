import 'dotenv/config';
import { dbPool } from './src/lib/db/postgres';

async function checkSchema() {
  const client = await dbPool.connect();
  try {
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'template_groups'
    `);
    console.log('Columns in template_groups:', res.rows.map(r => r.column_name).join(', '));

    const res2 = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'templates'
    `);
    console.log('Columns in templates:', res2.rows.map(r => r.column_name).join(', '));

    const res3 = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sites'
    `);
    console.log('Columns in sites:', res3.rows.map(r => r.column_name).join(', '));

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    process.exit();
  }
}

checkSchema();

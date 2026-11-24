import { seedPostgres } from '@/lib/seed-postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  await seedPostgres();
  return NextResponse.json({ seeded: true });
}

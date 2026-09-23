import 'server-only';
import data from '@/lib/demo/report.json';
import { comparisonSchema } from '@/lib/schema';
import { verifyFindings } from '@/lib/evidence';
import type { Report } from '@/lib/schema';
export const runtime='nodejs';
export async function GET() {
 const report=data as Report;
 verifyFindings(comparisonSchema.parse(report).findings,report.sources);
 return Response.json(report,{headers:{'Cache-Control':'no-store'}});
}

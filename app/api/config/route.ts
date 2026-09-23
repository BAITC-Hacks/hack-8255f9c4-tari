import 'server-only';
import { createHash } from 'node:crypto';
import { requiresAccessCode } from '@/lib/access';
export const dynamic='force-dynamic';
export async function GET(){return Response.json({accessRequired:requiresAccessCode(),cacheRevision:createHash('sha256').update('grounded-v3:'+process.env.AI_BASE_URL+':'+process.env.AI_MODEL).digest('hex').slice(0,16),demoMode:process.env.DEMO_MODE==='true',configured:!!(process.env.AI_API_KEY&&process.env.AI_BASE_URL&&process.env.AI_MODEL)},{headers:{'Cache-Control':'no-store'}});}

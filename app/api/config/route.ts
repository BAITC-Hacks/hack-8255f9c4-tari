import 'server-only';
export const dynamic='force-dynamic';
export async function GET(){return Response.json({demoMode:process.env.DEMO_MODE==='true',configured:!!(process.env.AI_API_KEY&&process.env.AI_BASE_URL&&process.env.AI_MODEL)},{headers:{'Cache-Control':'no-store'}});}

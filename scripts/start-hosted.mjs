import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','--hostname','0.0.0.0','--port',process.env.PORT||'3000'],{stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code??1));

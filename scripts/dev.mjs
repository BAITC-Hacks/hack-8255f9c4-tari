import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
// Polling avoids filesystem watcher limits on laptops and synchronized folders.
const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1',...process.argv.slice(2)],{stdio:'inherit',env:{...process.env,WATCHPACK_POLLING:'1000'}});
child.on('exit',code=>{process.exitCode=code??0;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));

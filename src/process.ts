import {spawn} from 'node:child_process';
export async function runProcess(command:string,args:string[],options:{cwd?:string;signal?:AbortSignal;shell?:boolean;timeoutMs?:number;input?:string}={}):Promise<{stdout:string;stderr:string;exitCode:number}>{
 return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{cwd:options.cwd,shell:options.shell??false,windowsHide:true,stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='',failure:Error|undefined;const max=1024*1024;
  const kill=()=>{if(process.platform==='win32'&&child.pid){spawn('taskkill',['/pid',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});}else child.kill('SIGKILL');};
  const abort=()=>{failure=new Error('Cancelled');kill();};
  const timer=setTimeout(()=>{failure=new Error('Process timed out');kill();},options.timeoutMs??120000);
  options.signal?.addEventListener('abort',abort,{once:true});if(options.signal?.aborted)abort();
  const cleanup=()=>{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);};
  child.stdout.on('data',b=>{stdout+=b.toString();if(Buffer.byteLength(stdout)>max){failure=new Error('Process output exceeded 1 MiB');kill();}});
  child.stderr.on('data',b=>{stderr+=b.toString();if(Buffer.byteLength(stderr)>max){failure=new Error('Process error output exceeded 1 MiB');kill();}});
  child.on('error',e=>{cleanup();reject(e);});child.on('close',code=>{cleanup();if(failure)reject(failure);else resolve({stdout,stderr,exitCode:code??1});});
  child.stdin.on('error',()=>{});child.stdin.end(options.input);
 });
}

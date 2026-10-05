import {randomUUID} from 'node:crypto';import {z} from 'zod';import {Store} from './storage.js';
export interface PermissionRequest {operation:string;resource:string;description:string}
export type Decision='allow'|'deny'|'always';
const rules=z.array(z.object({id:z.string(),operation:z.string(),resource:z.string()}));
export class Permissions {
 constructor(private store:Store,private prompt:(request:PermissionRequest)=>Promise<Decision>){}
 async list(){const parsed=rules.safeParse(await this.store.read('permissions',[]));if(!parsed.success)throw new Error('Invalid permission data');return parsed.data;}
 async authorize(request:PermissionRequest):Promise<boolean>{const all=await this.list();if(all.some(r=>r.operation===request.operation&&r.resource===request.resource))return true;const choice=await this.prompt(request);if(choice==='always'){all.push({id:randomUUID(),operation:request.operation,resource:request.resource});await this.store.write('permissions',all);}return choice==='allow'||choice==='always';}
 async revoke(id:string){const all=await this.list();if(!all.some(r=>r.id===id))throw new Error('Unknown permission ID');await this.store.write('permissions',all.filter(r=>r.id!==id));}
 async reset(){await this.store.write('permissions',[]);}
}

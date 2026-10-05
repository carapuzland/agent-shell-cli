import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {Store} from './storage.js';
import type {Chat,Message} from './types.js';
const usage=z.object({input:z.number().nonnegative(),output:z.number().nonnegative(),estimated:z.boolean(),elapsedMs:z.number().nonnegative(),generationMs:z.number().nonnegative(),tokensPerSecond:z.number().nonnegative()});
const schema=z.array(z.object({id:z.string().uuid(),title:z.string(),createdAt:z.string(),updatedAt:z.string(),skills:z.array(z.string()),messages:z.array(z.object({role:z.enum(['user','assistant']),content:z.string(),timestamp:z.string(),metrics:usage.optional()}))}));
export class Chats {
 constructor(private store:Store){}
 async list():Promise<Chat[]>{const result=schema.safeParse(await this.store.read('chats',[]));if(!result.success)throw new Error('Invalid chat data; original file preserved');return result.data;}
 async create(title='New chat'):Promise<Chat>{const all=await this.list(),now=new Date().toISOString();const chat:Chat={id:randomUUID(),title:title.trim()||'New chat',createdAt:now,updatedAt:now,messages:[],skills:[]};all.push(chat);await this.store.write('chats',all);return chat;}
 async select(id:string):Promise<Chat>{const all=await this.list(),matches=all.filter(c=>c.id===id||c.id.startsWith(id));if(matches.length!==1)throw new Error('Unknown chat or ambiguous ID');return matches[0];}
 async update(id:string,edit:(chat:Chat)=>void):Promise<Chat>{const all=await this.list(),chat=all.find(c=>c.id===id);if(!chat)throw new Error('Unknown chat');edit(chat);chat.updatedAt=new Date().toISOString();await this.store.write('chats',all);return chat;}
 async append(id:string,message:Message){await this.update(id,c=>c.messages.push(message));}
}

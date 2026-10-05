export interface TokenUsage {input:number; output:number; estimated:boolean}
export interface ResponseMetrics extends TokenUsage {elapsedMs:number; generationMs:number; tokensPerSecond:number}
export interface Message {role:'user'|'assistant'; content:string; timestamp:string; metrics?:ResponseMetrics}
export interface Chat {id:string; title:string; createdAt:string; updatedAt:string; messages:Message[]; skills:string[]}
export interface ProviderConfig {kind:'disabled'|'openai'|'anthropic'|'codex'|'claude'; model?:string; baseUrl?:string; keyEnv?:string; budget?:number; maxOutputTokens:number}
export interface McpConfig {transport:'stdio'|'http'; command?:string; args?:string[]; url?:string; env?:Record<string,string>; headerEnv?:Record<string,string>}
export interface Config {provider:ProviderConfig; mcp:Record<string,McpConfig>; skillPaths:string[]}
export const defaultConfig=():Config=>({provider:{kind:'disabled',maxOutputTokens:4096},mcp:{},skillPaths:[]});

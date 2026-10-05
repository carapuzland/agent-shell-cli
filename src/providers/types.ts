import type {TokenUsage} from '../types.js';
export interface ToolDefinition {name:string;description:string;parameters:Record<string,unknown>}
export interface ToolCall {id:string;name:string;arguments:Record<string,unknown>}
export interface WireMessage {role:'system'|'user'|'assistant'|'tool';content:string;toolCalls?:ToolCall[];toolCallId?:string}
export interface GenerateRequest {messages:WireMessage[];tools:ToolDefinition[];signal:AbortSignal}
export type ProviderEvent={type:'text';text:string}|{type:'usage';usage:TokenUsage}|{type:'tool';call:ToolCall}|{type:'done'};
export interface Provider {generate(request:GenerateRequest):AsyncIterable<ProviderEvent>}

import type {ProviderConfig} from '../types.js';import type {Provider} from './types.js';import {ApiProvider} from './api.js';import {CliProvider} from './cli.js';
export function createProvider(config:ProviderConfig):Provider {if(config.kind==='disabled')throw new Error('AI is disabled. Use /provider set to connect a provider explicitly.');return config.kind==='codex'||config.kind==='claude'?new CliProvider(config):new ApiProvider(config);}
export function providerId(c:ProviderConfig){return JSON.stringify([c.kind,c.baseUrl??'',c.model??'default',c.keyEnv??'']);}

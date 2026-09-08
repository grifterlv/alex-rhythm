import { env } from 'cloudflare:workers';
export function database(){if(!env.DB)throw new Error('Planner database is unavailable');return env.DB;}

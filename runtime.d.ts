interface D1Result { results: Record<string, unknown>[]; success: boolean; }
interface D1PreparedStatement { bind(...values: unknown[]): D1PreparedStatement; run(): Promise<D1Result>; all(): Promise<D1Result>; }
interface D1Database { prepare(query: string): D1PreparedStatement; batch(statements: D1PreparedStatement[]): Promise<D1Result[]>; }
interface Fetcher { fetch(request: Request): Promise<Response>; }
declare module 'cloudflare:workers' { export const env: { DB: D1Database; }; }

import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
const sqlite=new DatabaseSync(':memory:');
for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+f,'utf8'));
class Statement{
 args:unknown[]=[];
 constructor(public sql:string){}
 bind(...args:unknown[]){this.args=args;return this}
 async all(){return {success:true,results:sqlite.prepare(this.sql).all(...this.args as [])}}
 async run(){return this.all()}
}
export const env={DB:{prepare:(sql:string)=>new Statement(sql),async batch(statements:Statement[]){sqlite.exec('BEGIN IMMEDIATE');try{const result=[];for(const s of statements)result.push(await s.all());sqlite.exec('COMMIT');return result}catch(e){sqlite.exec('ROLLBACK');throw e}}}};

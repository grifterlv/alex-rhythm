import {database} from './index';
import {shiftDate,type Snapshot} from '@/lib/planner';
import {settingsOf} from '@/lib/planning';
export async function snapshot(id:string,date:string):Promise<Snapshot>{
 const db=database();await db.prepare('INSERT OR IGNORE INTO planner_accounts (user_id, revision) VALUES (?, 0)').bind(id).run();
 const r=await db.batch([
 db.prepare('SELECT revision, active FROM planner_accounts WHERE user_id = ?').bind(id),
 db.prepare("SELECT date, data FROM planner_days WHERE user_id = ? AND ((date >= ? AND date <= ?) OR date = (SELECT json_extract(active, '$.day') FROM planner_accounts WHERE user_id = ?))").bind(id,shiftDate(date,-6),date,id),
 db.prepare('SELECT data FROM planner_profiles WHERE user_id = ?').bind(id),
 db.prepare('SELECT data FROM planner_tasks WHERE user_id = ?').bind(id),
 db.prepare('SELECT data FROM planner_drafts WHERE user_id = ? AND date = ?').bind(id,date),
 ]);const account=r[0].results[0];
 return {revision:Number(account.revision),active:account.active?JSON.parse(account.active as string):null,days:Object.fromEntries(r[1].results.map(row=>[row.date,JSON.parse(row.data as string)])),settings:settingsOf(r[2].results[0]?.data?JSON.parse(r[2].results[0].data as string):{}),tasks:r[3].results.map(row=>JSON.parse(row.data as string)),draft:r[4].results[0]?.data?JSON.parse(r[4].results[0].data as string):null};
}
export function conditionalUpsert(table:'planner_profiles'|'planner_tasks'|'planner_drafts'|'planner_days',id:string,revision:number,key:string|undefined,data:unknown){const column=table==='planner_tasks'?'id':'date';const db=database();if(table==='planner_profiles')return db.prepare('INSERT INTO planner_profiles (user_id, data) SELECT ?, ? FROM planner_accounts WHERE user_id = ? AND revision = ? ON CONFLICT(user_id) DO UPDATE SET data = excluded.data').bind(id,JSON.stringify(data),id,revision);return db.prepare(`INSERT INTO ${table} (user_id, ${column}, data) SELECT ?, ?, ? FROM planner_accounts WHERE user_id = ? AND revision = ? ON CONFLICT(user_id, ${column}) DO UPDATE SET data = excluded.data`).bind(id,key,JSON.stringify(data),id,revision)}

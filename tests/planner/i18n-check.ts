import assert from 'node:assert/strict';
import {messages} from '../../lib/locales';
import {detectLocale,formatDuration,localizedHelpers,translate,locales} from '../../lib/i18n';
import {template,type Snapshot,localEpoch} from '../../lib/planner';
import {defaults,extractMinutes,extractStart,freshDraft,parseBrainDump,propose,routine} from '../../lib/planning';
import {dayOverview} from '../../lib/day-overview';
import {focusRecord,focusElapsed,sceneForActivity} from '../../lib/focus';

const placeholders=(s:string)=>[...s.matchAll(/\{\d+\}/g)].map(x=>x[0]).sort();
for(const [key,translations] of Object.entries(messages))for(const text of translations){
 assert.ok(text.trim(),`Empty translation: ${key}`);
 assert.equal(/\p{Script=Han}/u.test(text),false,`Untranslated text: ${key}`);
 assert.deepEqual(placeholders(text),placeholders(key),`Missing interpolation: ${key}`);
}
assert.equal(detectLocale('es-PE'),'es');assert.equal(detectLocale('en-CA'),'en');assert.equal(detectLocale('zh-TW'),'zh-CN');assert.equal(detectLocale('fr-CA'),'zh-CN');
assert.equal(formatDuration('en',150),'2 h 30 min');assert.equal(formatDuration('es',30),'30 min');assert.equal(formatDuration('zh-CN',90),'1 小时 30 分');
const day=template(),date='2026-09-08',startedAt=localEpoch(date,510),block=day.blocks[3];
const state:Snapshot={revision:12,days:{[date]:day},active:{id:'active-1',day:date,blockId:block.id,title:block.title,category:block.category,startedAt}};
day.logs.push({id:'log-1',blockId:block.id,title:block.title,category:block.category,start:startedAt-15*60000,end:startedAt});
const before=JSON.stringify(state),draft={...freshDraft(),input:'修改 UI — revisar después',selectedIds:['my-task']},draftBefore=JSON.stringify(draft);
for(const locale of ['en','es','zh-CN','es','en'] as const){
 const view=localizedHelpers(locale);
 for(const plan of [template(),template('shopping'),template('slow'),routine()])for(const b of plan.blocks){
  if(locale!=='zh-CN')assert.equal(/\p{Script=Han}/u.test(view.blockTitle(b)+view.blockNote(b)),false,`Untranslated routine ${b.id}`);
 }
 for(const period of dayOverview(day,defaults))for(const group of period.groups)if(locale!=='zh-CN')assert.equal(/\p{Script=Han}/u.test(view.groupTitle(group)),false);
 const custom={...block,id:'user-block',title:'午餐',note:day.blocks[0].note};
 assert.equal(view.blockTitle(custom),'午餐');assert.equal(view.blockNote(custom),custom.note);
 assert.equal(view.blockTitle({...block,taskId:'custom-task',title:'午餐'}),'午餐');
 assert.equal(view.blockTitle({...block,title:'我的自定义工作'}),'我的自定义工作');
 assert.equal(view.blockNote({...block,note:'Mi nota — 我的提示'}),'Mi nota — 我的提示');
 const focus=focusRecord(state,{date,id:block.id});
 assert.equal(focusElapsed(focus.savedMs,startedAt,startedAt+20*60000),35*60000);
 assert.equal(JSON.stringify(state),before);assert.equal(JSON.stringify(draft),draftBefore);
 assert.equal(state.active?.startedAt,startedAt);
 assert.ok(view.recordTitle(state.active!));
}
assert.equal(translate('es','已排工作 2 小时 30 分，你的目标是 6 小时。可补充任务，也可以保留空档。'),'Trabajo programado: 2 h 30 min. Tu objetivo es 6 h. Añade tareas o conserva el tiempo libre.');
assert.equal(translate('en','「修复自己的任务」准备投入多久？请先选一个时长。'),'How long will you spend on “修复自己的任务”? Choose a duration first.');
assert.equal(translate('es','结束时间需晚于开始时间'),'El final debe ser posterior al inicio.');
assert.equal(translate('es','有 {0} 项安排需要你确认',[3]),'3 cambios de horario por revisar');

for(const [text,expected] of [['2 hours',120],['2 horas',120],['1,5 horas',90],['1 hora y media',90],['media hora',30],['1 hour 30 minutes',90],['30 minutos',30],['2 小时',120],['1–2 horas',null]] as const)assert.equal(extractMinutes(text),expected,text);
assert.equal(extractStart('Meeting at 3:30 pm'),930);assert.equal(extractStart('a las 15:00'),900);assert.equal(extractStart('a las 3 de la tarde'),900);assert.equal(extractStart('下午 3 点'),900);
for(const input of ['Finish the website prototype, 2 hours. Meeting at 15:00, 30 minutes. Buy groceries, about 1 hour.','Terminar el prototipo web, 2 horas. Reunión a las 15:00, 30 minutos. Comprar alimentos, 1 hora.']){
 const tasks=parseBrainDump(input,'2026-09-09');
 assert.equal(tasks.length,3,JSON.stringify(tasks));assert.deepEqual(tasks.map(t=>t.minutes),[120,30,60]);assert.deepEqual(tasks.map(t=>t.category),['work','work','meal']);assert.equal(tasks[1].fixedStart,900);
 const proposal=propose('2026-09-09',routine(),defaults,tasks,{...freshDraft(),selectedIds:tasks.map(t=>t.id)},localEpoch(date,600));
 assert.equal(proposal.conflicts.length,0);assert.ok(proposal.day.blocks.some(b=>b.taskId===tasks[1].id&&b.start===900));
 for(const locale of ['en','es'] as const)for(const warning of proposal.warnings)assert.equal(/\p{Script=Han}/u.test(translate(locale,warning)),false);
}
assert.equal(sceneForActivity({title:'Leer un libro',category:'rest'}),'reading');
console.log('PASS: English/Spanish catalog coverage, interpolation, preserved user content and timer state, localized routines, multilingual planning input');

assert.equal(parseBrainDump('Escribir código, 1,5 horas.',date)[0].minutes,90);
assert.equal(parseBrainDump('Write code, 1.5 hours.',date)[0].minutes,90);
assert.equal(parseBrainDump('Meeting at 15:00, 30 min.',date)[0].minutes,30);

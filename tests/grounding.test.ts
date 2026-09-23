import test from 'node:test';
import assert from 'node:assert/strict';
import { evidenceUnits,selectionSchema,groundEntities,groundedComparisonSchema,groundFindings } from '../lib/ai/grounding';
import { verifyReference } from '../lib/evidence';
import { structure } from '../lib/documents/structure';

test('long fragments become bounded exact excerpts, never model-written quotes',()=>{
 const doc=structure([{page:2,text:'Отдел проводит аудит документов. '.repeat(110)}],'test.pdf','before');
 const units=evidenceUnits(doc.sources);assert.ok(units.length>1);
 for(const unit of units){assert.ok(unit.text.length<=1400);const chosen=selectionSchema(units).parse({entities:[{type:'function',name:'Аудит документов',owner:'Отдел',sourceId:unit.id,quote:'INVENTED MODEL QUOTE'}]});const [entity]=groundEntities(chosen.entities,units);assert.equal(entity.quote,unit.text);verifyReference(entity,doc.sources);}
 assert.equal(selectionSchema(units).safeParse({entities:[{type:'function',name:'Аудит',owner:'Отдел',sourceId:'invented-id'}]}).success,false);
});
test('comparison schemas enforce category and side; citations resolve from existing evidence',()=>{
 const base={type:'function' as const,name:'Проверка качества',owner:'Отдел',quote:'Отдел проверяет качество документов.'};
 const before=[{...base,evidenceId:'E1',sourceId:'before-1'}],after=[{...base,evidenceId:'E2',sourceId:'after-1'}];
 const schema=groundedComparisonSchema('functions',before,after);
 const finding={kind:'preserved',title:'Проверка сохранена',description:'Проверка качества указана в обеих редакциях.',status:'confirmed',confidence:0.8,beforeIds:['E1'],afterIds:['E2']};
 assert.equal(schema.safeParse({findings:[{...finding,kind:'org_created'}]}).success,false);
 assert.equal(schema.safeParse({findings:[{...finding,afterIds:['E1']}]}).success,false);
 const [resolved]=groundFindings(schema.parse({findings:[finding]}),before,after);
 assert.deepEqual(resolved.afterEvidence,[{sourceId:'after-1',quote:base.quote}]);
});

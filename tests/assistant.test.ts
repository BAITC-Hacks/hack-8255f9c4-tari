import test from 'node:test';
import assert from 'node:assert/strict';
import { assistantInput,answerQuestion,offlineHelp } from '../lib/assistant';
import { translate } from '../lib/i18n';
import type { AIProvider } from '../lib/ai/provider';

test('assistant requires bounded questions and valid language',()=>{
 assert.equal(assistantInput.safeParse({language:'en',question:'x'.repeat(1501),history:[],report:null}).success,false);
 assert.equal(assistantInput.safeParse({language:'xx',question:'Help',history:[],report:null}).success,false);
 assert.equal(assistantInput.safeParse({language:'kk',question:'Help',history:[],report:null}).success,true);
});
test('assistant uses selected language and rejects invented evidence IDs',async()=>{
 const input=assistantInput.parse({language:'kk',question:'Түсіндір',history:[],report:null});
 let prompt='';
 const provider:AIProvider={async json(instruction,_data,schema){prompt=instruction;return schema.parse({answer:'Құжаттарды таңдаңыз.',findingIds:[]});}};
 const result=await answerQuestion(input,provider,new AbortController().signal);
 assert.match(prompt,/казахском/);assert.equal(result.answer,'Құжаттарды таңдаңыз.');
 const bad:AIProvider={async json(_instruction,_data,schema){return schema.parse({answer:'A claim',findingIds:['F999']});}};
 await assert.rejects(answerQuestion(input,bad,new AbortController().signal),/неизвестный вывод/);
});
test('offline help is explicit and localized',()=>{
 for(const lang of ['ru','kk','en'] as const){assert.equal(offlineHelp(lang).mode,'guide');assert.deepEqual(offlineHelp(lang).findingIds,[]);}
 assert.equal(translate('en','Начать анализ'),'Start analysis');
 assert.equal(translate('kk','Начать анализ'),'Талдауды бастау');
 assert.equal(translate('ru','Начать анализ'),'Начать анализ');
});

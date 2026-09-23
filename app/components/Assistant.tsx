'use client';
import { useEffect,useRef,useState } from 'react';
import { MessageCircle, X, Send, LoaderCircle, ArrowUpRight } from 'lucide-react';
import { translate, type Language } from '@/lib/i18n';
import type { Report } from '@/lib/schema';
type Message={role:'user'|'assistant';text:string;findingIds?:string[];mode?:string};
export default function Assistant({language,report,onFinding,accessCode=''}:{accessCode?:string;language:Language;report:Report|null;onFinding:(id:string)=>void}){
 const t=(text:string)=>translate(language,text);
 const [open,setOpen]=useState(false),[question,setQuestion]=useState(''),[messages,setMessages]=useState<Message[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const controller=useRef<AbortController|null>(null),panel=useRef<HTMLElement>(null),input=useRef<HTMLTextAreaElement>(null),launcher=useRef<HTMLButtonElement>(null),bottom=useRef<HTMLDivElement>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 useEffect(()=>{if(open)input.current?.focus();},[open]);
 useEffect(()=>{if(open)bottom.current?.scrollIntoView({block:'nearest'});},[messages,busy,open]);
 function close(){setOpen(false);launcher.current?.focus();}
 async function ask(text=question){
  if(busy||!text.trim())return;
  const next:Message={role:'user',text:text.trim()};
  const history=messages.slice(-8).map(({role,text})=>({role,text}));
  setMessages(prev=>[...prev,next]);setQuestion('');setError('');setBusy(true);controller.current=new AbortController();
  try{
   const response=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json','x-orglens-access':accessCode},signal:controller.current.signal,body:JSON.stringify({language,question:next.text,history,report:report?{findings:report.findings,warnings:report.warnings}:null})});
   const body=await response.json();if(!response.ok)throw Error(body.error?.message||t('Помощник недоступен. Повторите позже.'));
   setMessages(prev=>[...prev,{role:'assistant',text:body.answer,findingIds:body.findingIds,mode:body.mode}]);
  }catch(e){if(!(e instanceof Error&&e.name==='AbortError'))setError(e instanceof Error?t(e.message):t('Помощник недоступен. Повторите позже.'));}
  finally{setBusy(false);}
 }
 return <><button ref={launcher} className="assistant-launcher" onClick={()=>setOpen(!open)} aria-expanded={open} aria-controls="assistant-panel"><MessageCircle size={21}/>{t('AI-помощник')}</button>
 {open&&<section ref={panel} className="assistant-panel" id="assistant-panel" role="dialog" aria-label={t('AI-помощник')} onKeyDown={e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const items=panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),textarea');const first=items?.[0],last=items?.[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}>
  <div className="assistant-header"><div><strong>{t('AI-помощник')}</strong><small>{t('Объясню отчёт простыми словами')}</small></div><button onClick={close} aria-label={t('Закрыть помощника')}><X size={22}/></button></div>
  <div className="assistant-messages" role="log" aria-live="polite" aria-relevant="additions text">
   {!messages.length&&<p className="assistant-welcome">{t('Задайте вопрос об отчёте или работе сайта')}</p>}
   {messages.map((m,i)=><div key={i} className={`chat-message ${m.role}`}><p>{m.text}</p>{m.mode==='guide'&&<small>{t('Справка без AI')}</small>}{!!m.findingIds?.length&&<div className="chat-sources">{m.findingIds.map(id=><button key={id} onClick={()=>{close();onFinding(id);}}>{id}<ArrowUpRight size={14}/></button>)}</div>}</div>)}
   {busy&&<p className="chat-thinking"><LoaderCircle className="spin" size={16}/>{t('Думаю…')}</p>}
   {error&&<p role="alert" className="chat-error">{error}</p>}<div ref={bottom}/>
  </div>
  <div className="assistant-suggestions">{(report?['Что изменилось?','Какие риски проверить?']:['Как пользоваться сайтом?']).map(q=><button key={q} disabled={busy} onClick={()=>ask(t(q))}>{t(q)}</button>)}</div>
  <form className="assistant-form" onSubmit={e=>{e.preventDefault();void ask();}}><textarea ref={input} value={question} maxLength={1500} rows={2} onChange={e=>setQuestion(e.target.value)} placeholder={t('Задайте вопрос об отчёте или работе сайта')} aria-label={t('Задайте вопрос об отчёте или работе сайта')}/><button disabled={busy||!question.trim()} type="submit" aria-label={t('Отправить')}><Send size={20}/></button></form>
  <p className="assistant-disclaimer">{t('Ответ AI может содержать ошибки. Сверяйте с источниками.')}</p>
 </section>}</>;
}

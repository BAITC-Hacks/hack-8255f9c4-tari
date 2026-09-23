import type { Report } from './schema';
export type SavedReport={key:string;report:Report;savedAt:number};
const dbName='orglens-reports-v1';
async function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open(dbName,1);request.onupgradeneeded=()=>request.result.createObjectStore('reports',{keyPath:'key'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function operation<T>(mode:IDBTransactionMode,fn:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
 const db=await database();
 return new Promise((resolve,reject)=>{const transaction=db.transaction('reports',mode);const request=fn(transaction.objectStore('reports'));transaction.oncomplete=()=>{db.close();resolve(request.result);};transaction.onabort=()=>{db.close();reject(transaction.error);};transaction.onerror=()=>{db.close();reject(transaction.error);};});
}
export async function reportKey(before:File,after:File,revision:string){
 const hash=async(file:File)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),n=>n.toString(16).padStart(2,'0')).join('');
 return `${revision}:${await hash(before)}:${await hash(after)}`;
}
export async function listReports(){return (await operation<SavedReport[]>('readonly',s=>s.getAll())).sort((a,b)=>b.savedAt-a.savedAt);}
export async function findReport(key:string){return operation<SavedReport|undefined>('readonly',s=>s.get(key));}
export async function saveReport(entry:SavedReport){await operation('readwrite',s=>s.put(entry));const entries=await listReports();for(const old of entries.slice(5))await removeReport(old.key);}
export async function removeReport(key:string){await operation('readwrite',s=>s.delete(key));}

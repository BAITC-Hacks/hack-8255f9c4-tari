export type DiffPart={text:string;changed:boolean};
/** Bounded word LCS; whitespace and original punctuation remain unchanged. */
export function compareQuotes(before:string,after:string):{before:DiffPart[];after:DiffPart[]}{
 const a=before.match(/\s+|[^\s]+/g)||[],b=after.match(/\s+|[^\s]+/g)||[];
 const parts=(tokens:string[],keep:Set<number>)=>tokens.map((text,i)=>({text,changed:!keep.has(i)&&!!text.trim()}));
 if(a.length*b.length>300000)return {before:[{text:before,changed:false}],after:[{text:after,changed:false}]};
 const rows=Array.from({length:a.length+1},()=>new Uint16Array(b.length+1));
 for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)rows[i][j]=a[i]===b[j]?rows[i+1][j+1]+1:Math.max(rows[i+1][j],rows[i][j+1]);
 const ka=new Set<number>(),kb=new Set<number>();let i=0,j=0;
 while(i<a.length&&j<b.length){if(a[i]===b[j]){ka.add(i++);kb.add(j++);}else if(rows[i+1][j]>=rows[i][j+1])i++;else j++;}
 return {before:parts(a,ka),after:parts(b,kb)};
}

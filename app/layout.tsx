import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'OrgLens — Анализ организационных изменений',description:'Сравнение структуры и функций с доказательствами из исходных документов.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ru"><body>{children}</body></html>;}

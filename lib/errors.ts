export class AppError extends Error { constructor(public code:string,message:string,public status=400) { super(message); } }
export function publicError(error:unknown) { return error instanceof AppError ? {code:error.code,message:error.message} : {code:'INTERNAL',message:'Не удалось завершить анализ. Попробуйте ещё раз или откройте демопример.'}; }

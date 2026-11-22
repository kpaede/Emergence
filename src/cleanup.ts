/** Attempt every step in order, including after an earlier step fails. */
export async function settleSteps(steps:readonly (()=>unknown)[]):Promise<unknown[]>{
 const errors:unknown[]=[];
 for(const step of steps){try{await step();}catch(error){errors.push(error);}}
 return errors;
}

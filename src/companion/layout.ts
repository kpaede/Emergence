export interface CompanionLayout {outlineRatio:number;outlineWidth:number}
export const defaultCompanionLayout=():CompanionLayout=>({outlineRatio:.38,outlineWidth:240});
export function companionLayout(value:unknown):CompanionLayout{
 const data=value&&typeof value==='object'?value as Partial<CompanionLayout>:{},defaults=defaultCompanionLayout();
 return {outlineRatio:typeof data.outlineRatio==='number'&&Number.isFinite(data.outlineRatio)?Math.min(.65,Math.max(.2,data.outlineRatio)):defaults.outlineRatio,outlineWidth:typeof data.outlineWidth==='number'&&Number.isFinite(data.outlineWidth)?Math.min(400,Math.max(180,data.outlineWidth)):defaults.outlineWidth};
}

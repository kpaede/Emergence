export type CitekeyFormat = 'brackets' | 'at' | 'plain';
export const formatCitekey = (key: string, format: CitekeyFormat = 'brackets'): string => format === 'brackets' ? `[@${key}]` : format === 'at' ? `@${key}` : key;

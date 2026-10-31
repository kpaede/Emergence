import type {EmergenceController} from '../../controller';
import type {Settings} from '../../types';
export interface SettingsContext {
 host: HTMLElement; draft: Settings; controller: EmergenceController;
 changed(): void; refresh(): void; report(message: string, error?: boolean): void;
}
export const csv = (text: string): string[] => text.split(',').map(v => v.trim()).filter(Boolean);

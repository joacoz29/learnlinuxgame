import type { QuestDefinition } from '../../quests/types';
import { lockedSector } from './01-locked-sector';

/** Quests in story order. Add new quest files here. */
export const QUESTS: readonly QuestDefinition[] = [lockedSector];

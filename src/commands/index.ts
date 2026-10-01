import { clear, echo, help, hostname, pwd, whoami } from './basic';
import { cat, mkdir, touch } from './files';
import { cd, ls } from './navigation';
import type { Command } from './types';

/** Register new commands here; everything else (help, codex, quests) discovers them from this list. */
export const ALL_COMMANDS: readonly Command[] = [pwd, ls, cd, mkdir, touch, cat, echo, clear, whoami, hostname, help];

export class CommandRegistry {
  private byName = new Map<string, Command>();

  constructor(commands: readonly Command[] = ALL_COMMANDS) {
    for (const command of commands) {
      this.byName.set(command.name, command);
      command.aliases?.forEach((alias) => this.byName.set(alias, command));
    }
  }

  get(name: string): Command | undefined {
    return this.byName.get(name);
  }

  list(): Command[] {
    return [...new Set(this.byName.values())];
  }
}

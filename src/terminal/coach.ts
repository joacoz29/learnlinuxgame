import type { ErrorCode } from '../commands/types';

export type CoachLevel = 'full' | 'brief' | 'none';

export interface CoachInfo {
  command: string;
  cwd: string;
}

interface Explanation {
  summary: string;
  tip: string;
}

const EXPLANATIONS: Record<ErrorCode, (i: CoachInfo) => Explanation> = {
  ENOENT: (i) => ({
    summary: 'Ese archivo o directorio no existe en el lugar donde lo buscaste.',
    tip: `Un path relativo se lee desde tu directorio actual (${i.cwd}). Usá ls para ver qué hay y revisá mayúsculas y ortografía.`,
  }),
  EISDIR: () => ({
    summary: 'Eso es un directorio, no un archivo.',
    tip: 'Para ver lo que contiene usá ls; para entrar usá cd. Con cat se leen archivos.',
  }),
  ENOTDIR: () => ({
    summary: 'Eso no es un directorio, es un archivo.',
    tip: 'cd solo puede entrar a directorios. Para leer un archivo usá cat.',
  }),
  EEXIST: () => ({
    summary: 'Ya existe algo con ese nombre.',
    tip: 'Mirá qué hay con ls. Para crear una carpeta ya existente sin error se puede usar mkdir -p.',
  }),
  ENOTEMPTY: () => ({
    summary: 'El directorio no está vacío.',
    tip: 'Hay que vaciarlo primero (o usar la opción recursiva).',
  }),
  EINVAL: () => ({ summary: 'Argumento inválido.', tip: 'Revisá el comando con --help.' }),
  EUSAGE: (i) => ({
    summary: `Al comando le faltan argumentos (o le sobran).`,
    tip: `Escribí "${i.command} --help" para ver cómo se usa.`,
  }),
  EOPT: (i) => ({
    summary: 'Ese comando no conoce esa opción.',
    tip: `Las opciones válidas aparecen con "${i.command} --help".`,
  }),
  ENOCMD: () => ({
    summary: 'El shell no encontró ese comando: puede estar mal escrito o todavía no lo tenés disponible.',
    tip: 'Escribí help para ver las herramientas que tenés ahora. Los comandos son sensibles a mayúsculas.',
  }),
  ELOCKED: () => ({
    summary: 'Ese comando existe, pero todavía no es parte de tu kit en esta misión.',
    tip: 'Escribí help para ver las herramientas disponibles. Se desbloquean a medida que avanzás.',
  }),
  EPARSE: () => ({
    summary: 'El shell no pudo interpretar la línea.',
    tip: 'Revisá que las comillas estén cerradas y que no sobre ningún operador (| ; && > <).',
  }),
};

/** Turns an error code into a short explanation, depending on how much help the difficulty allows. */
export function coachMessage(code: ErrorCode, info: CoachInfo, level: CoachLevel): string | null {
  if (level === 'none') return null;
  const { summary, tip } = EXPLANATIONS[code](info);
  return level === 'full' ? `${summary} ${tip}` : summary;
}

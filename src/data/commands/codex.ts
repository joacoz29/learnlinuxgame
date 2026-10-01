export interface CodexEntry {
  command: string;
  description: string;
  examples: string[];
  unlockedBy: string;
}

const S01 = 'Sector 01 // Boot Bay';

export const CODEX: readonly CodexEntry[] = [
  { command: 'pwd', description: 'Muestra el directorio en el que estás parado (print working directory).', examples: ['pwd'], unlockedBy: S01 },
  { command: 'ls', description: 'Lista el contenido de un directorio. -a incluye archivos ocultos, -l muestra detalles.', examples: ['ls', 'ls -a /var/lock', 'ls -l'], unlockedBy: S01 },
  { command: 'cd', description: 'Cambia de directorio. Sin argumentos vuelve a tu home; cd .. sube un nivel.', examples: ['cd /var/log', 'cd ..', 'cd ~'], unlockedBy: S01 },
  { command: 'cat', description: 'Muestra el contenido de uno o más archivos.', examples: ['cat readme.txt', 'cat /etc/hostname'], unlockedBy: S01 },
  { command: 'mkdir', description: 'Crea directorios. -p crea también los directorios padres que falten.', examples: ['mkdir logs', 'mkdir -p a/b/c'], unlockedBy: S01 },
  { command: 'touch', description: 'Crea un archivo vacío si no existe.', examples: ['touch notes.txt'], unlockedBy: S01 },
  { command: 'echo', description: 'Imprime texto. Combinado con > escribe ese texto en un archivo.', examples: ['echo hola', 'echo hola > saludo.txt'], unlockedBy: S01 },
  { command: 'clear', description: 'Limpia la pantalla de la terminal.', examples: ['clear'], unlockedBy: S01 },
  { command: 'whoami', description: 'Muestra con qué usuario estás trabajando.', examples: ['whoami'], unlockedBy: S01 },
  { command: 'hostname', description: 'Muestra el nombre de la máquina.', examples: ['hostname'], unlockedBy: S01 },
  { command: 'help', description: 'Lista los comandos disponibles en este momento.', examples: ['help', 'ls --help'], unlockedBy: S01 },
];

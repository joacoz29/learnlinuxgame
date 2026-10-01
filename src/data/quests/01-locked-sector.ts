import type { QuestDefinition } from '../../quests/types';

const PASSPHRASE = 'CYAN-OWL-42';

export const lockedSector: QuestDefinition = {
  id: 'locked-sector',
  title: 'The Locked Sector',
  sector: 'Sector 01 // Boot Bay',
  description: 'La puerta del Sector 02 está sellada. Aprendé a moverte por el sistema de archivos para conseguir acceso.',
  difficulty: 'tutorial',
  allowedCommands: ['pwd', 'ls', 'cd', 'cat', 'mkdir', 'touch', 'echo', 'clear', 'whoami', 'hostname', 'help'],
  world: {
    cwd: '/home/player',
    dirs: ['/var/lock/sector02'],
    files: {
      '/home/player/readme.txt': [
        'Hola, Operador.',
        '',
        'Soy ARIA, la IA de mantenimiento. Dejé este archivo para ayudarte a empezar.',
        '',
        'Estás dentro de una terminal: un lugar donde le hablás al sistema escribiendo comandos.',
        'Tu directorio personal es /home/player (en el prompt aparece abreviado como ~).',
        '',
        'El Sector 02 está sellado. El cerrojo explica cómo desbloquearlo en este aviso:',
        '',
        '    /var/lock/sector02/NOTICE.txt',
        '',
        'Una pista: no todos los archivos se ven a simple vista.',
        '',
        '-- ARIA',
        '',
      ].join('\n'),
      '/var/lock/sector02/NOTICE.txt': [
        'SECTOR 02 LOCK CONTROLLER // PROTOCOL NOTICE',
        '--------------------------------------------',
        "Clearance profile not found for operator 'player'.",
        '',
        'To request access:',
        "  1. Create a directory named 'clearance' in your home directory.",
        "  2. Inside it, create a file named 'access.conf'.",
        '  3. Write the sector passphrase into access.conf.',
        '',
        'The passphrase is stored in this directory, in a hidden file.',
        '',
      ].join('\n'),
      '/var/lock/sector02/.passphrase': `${PASSPHRASE}\n`,
    },
  },
  terminal: {
    banner: [
      'SYSTEM ACCESS TERMINAL',
      'Sector 02 locked.',
      'Required configuration file not found.',
      '',
      "Type 'help' to list available commands, or 'hint' if you get stuck.",
    ],
    completedBanner: [
      'SYSTEM ACCESS TERMINAL',
      'Sector 02 unlocked.',
      'Clearance profile accepted for operator player.',
      'Sector 03 key acquired.',
    ],
  },
  objectives: [
    {
      id: 'pwd',
      text: 'Averiguá en qué directorio estás',
      condition: { type: 'commandRan', command: 'pwd' },
      hints: ['Hay un comando de tres letras que imprime el directorio de trabajo: p… w… d.', 'Escribí pwd y apretá Enter.'],
      lesson:
        'pwd (print working directory) te dice dónde estás. El sistema de archivos es un árbol que empieza en / (la raíz); vos estás en /home/player, tu directorio personal.',
    },
    {
      id: 'ls',
      text: 'Listá los archivos de este directorio',
      condition: { type: 'commandRan', command: 'ls' },
      hints: ['ls viene de "list": lista lo que hay en un directorio.', 'Escribí ls sin nada más.'],
      lesson:
        'ls muestra el contenido del directorio actual. Los nombres en azul son directorios; los demás son archivos.',
    },
    {
      id: 'cat-readme',
      text: 'Leé el archivo readme.txt',
      condition: { type: 'commandRan', command: 'cat', argIncludes: 'readme.txt' },
      hints: ['cat muestra el contenido de un archivo en pantalla.', 'Escribí cat readme.txt'],
      lesson:
        'cat imprime el contenido de un archivo. "readme.txt" es un path relativo: se interpreta desde el directorio donde estás.',
    },
    {
      id: 'cat-notice',
      text: 'Leé el aviso del cerrojo (la ruta está en el readme)',
      condition: { type: 'commandRan', command: 'cat', argIncludes: 'NOTICE.txt' },
      hints: [
        'El readme da la ruta completa del aviso. Una ruta que empieza con / se llama absoluta y funciona desde cualquier lugar.',
        'Podés usar cat /var/lock/sector02/NOTICE.txt, o ir primero con cd /var/lock/sector02 y después cat NOTICE.txt.',
      ],
      lesson:
        'Un path absoluto (/var/lock/...) siempre apunta al mismo lugar; uno relativo depende del directorio actual. cd cambia ese directorio.',
    },
    {
      id: 'cat-passphrase',
      text: 'Encontrá y leé el archivo oculto con la contraseña',
      condition: { type: 'commandRan', command: 'cat', argIncludes: '.passphrase' },
      hints: [
        'Los archivos cuyo nombre empieza con un punto están ocultos: ls no los muestra por defecto.',
        'ls -a muestra también los ocultos. Probá ls -a /var/lock/sector02 y después cat sobre el archivo oculto.',
      ],
      lesson: 'Los archivos ocultos empiezan con "." y se ven con ls -a. Muchas configuraciones viven ahí.',
    },
    {
      id: 'mkdir-clearance',
      text: 'Creá el directorio "clearance" dentro de tu home (/home/player)',
      condition: { type: 'dirExists', path: '/home/player/clearance' },
      hints: [
        'mkdir (make directory) crea directorios. ¿Seguís en /home/player? Chequealo con pwd, o volvé con cd ~.',
        'Estando en tu home: mkdir clearance',
      ],
      lesson: 'mkdir crea directorios nuevos. Sin ruta absoluta, los crea dentro del directorio actual.',
    },
    {
      id: 'cd-clearance',
      text: 'Entrá al directorio clearance',
      condition: { type: 'cwdIs', path: '/home/player/clearance' },
      hints: ['cd cambia de directorio.', 'cd clearance (o cd ~/clearance desde cualquier lugar). Notá cómo cambia el prompt.'],
      lesson: 'Fijate que el prompt cambió: ahora muestra ~/clearance. El prompt siempre te dice dónde estás.',
    },
    {
      id: 'touch-access',
      text: 'Creá el archivo vacío access.conf',
      condition: { type: 'fileExists', path: '/home/player/clearance/access.conf' },
      hints: ['touch crea un archivo vacío (si no existe).', 'touch access.conf'],
      lesson: 'touch crea archivos vacíos. Verificá con ls que apareció.',
    },
    {
      id: 'write-passphrase',
      text: `Escribí la contraseña dentro de access.conf`,
      condition: { type: 'fileContains', path: '/home/player/clearance/access.conf', text: PASSPHRASE },
      hints: [
        'echo imprime texto. Con el operador > podés mandar esa salida a un archivo en lugar de la pantalla.',
        `echo ${PASSPHRASE} > access.conf (y comprobalo con cat access.conf)`,
      ],
      lesson:
        '> redirige la salida de un comando a un archivo (lo crea o lo sobrescribe). Es la base para combinar comandos más adelante.',
    },
  ],
  solution: [
    'pwd',
    'ls',
    'cat readme.txt',
    'cat /var/lock/sector02/NOTICE.txt',
    'ls -a /var/lock/sector02',
    'cat /var/lock/sector02/.passphrase',
    'mkdir clearance',
    'cd clearance',
    'touch access.conf',
    `echo ${PASSPHRASE} > access.conf`,
  ],
  reward: { xp: 120 },
  concepts: ['terminal', 'cwd', 'absolute-relative-paths', 'hidden-files', 'create-files', 'redirect-output'],
  introduces: ['pwd', 'ls', 'cat', 'cd', 'mkdir', 'touch', 'echo'],
  completionMessage: [
    'ACCESS GRANTED. El cerrojo aceptó tu perfil de autorización.',
    'Aprendiste a ubicarte (pwd), mirar (ls), moverte (cd), leer (cat) y crear (mkdir, touch, echo >).',
    'El Sector 02 está abierto y se detectó una llave para el Sector 03.',
  ],
  onComplete: [
    { type: 'setFlag', flag: 'sector02.unlocked' },
    { type: 'setFlag', flag: 'sector03.available' },
    { type: 'sound', id: 'door-unlocked', delayMs: 900 },
    { type: 'notify', text: 'SECTOR 02 UNLOCKED' },
  ],
};

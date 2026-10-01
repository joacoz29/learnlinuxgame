import type { ZoneDef } from './types';

/**
 * Sector 01 (Boot Bay) and the sealed Sector 02 (Data Core).
 * Legend: # wall . floor @ spawn R/r rack (r = powered by its region) C crate
 *         T terminal  D door to sector 02  E door to sector 03  N ARIA  H/h hologram
 */
export const SECTOR_01: ZoneDef = {
  id: 'station',
  name: 'AEGIS-01 Station',
  tileSize: 3,
  spawnFacing: 'e',
  layout: [
    '########################',
    '#RRRRRR....#r.r.r.r.r.r#',
    '#..........#...........#',
    '#....H.....#...h.......#',
    '#..........#...........#',
    '#.........T#...........#',
    '#..@.......D...........E',
    '#..........#...........#',
    '#.C........#...C.......#',
    '#..........#...........#',
    '#....N.....#...........#',
    '#..C.......#..r.r.r.r..#',
    '########################',
  ],
  tiles: {
    '#': { kind: 'wall' },
    '.': { kind: 'floor' },
    '@': { kind: 'floor' },
    R: { kind: 'rack' },
    r: { kind: 'rack' },
    C: { kind: 'crate' },
  },
  objects: {
    T: {
      kind: 'terminal',
      id: 'terminal-door-02',
      title: 'SYSTEM ACCESS TERMINAL',
      facing: 'w',
      flag: 'sector02.unlocked',
      screen: {
        locked: ['SYSTEM ACCESS', 'TERMINAL', '', 'SECTOR 02 LOCKED'],
        unlocked: ['SYSTEM ACCESS', 'TERMINAL', '', 'SECTOR 02 ONLINE'],
      },
    },
    D: {
      kind: 'door',
      id: 'door-sector02',
      unlockFlag: 'sector02.unlocked',
      signs: {
        locked: ['SECTOR 02', 'ACCESS DENIED'],
        open: ['SECTOR 02', 'ACCESS GRANTED'],
      },
      deniedMessage: 'ACCESS DENIED — the lock needs a clearance file. Use the terminal beside the door.',
    },
    E: {
      kind: 'door',
      id: 'door-sector03',
      unlockFlag: 'sector03.unlocked',
      teaserFlag: 'sector03.available',
      signs: {
        locked: ['SECTOR 03', 'OFFLINE'],
        teaser: ['SECTOR 03', 'KEY ACQUIRED', 'COMING SOON'],
        open: ['SECTOR 03', 'ACCESS GRANTED'],
      },
      deniedMessage: 'Sector 03 is offline. It arrives in the next milestone.',
    },
    N: {
      kind: 'npc',
      id: 'aria',
      name: 'ARIA',
      facing: 'e',
      dialogue: [
        'Operador. Soy ARIA, la IA de mantenimiento de la estación.',
        'Esta es la Sala de Arranque (Sector 01). El Sector 02 está sellado y el cerrojo no me hace caso: solo responde a archivos de configuración.',
        'Para hablar con el sistema usá la terminal que está en la pared, junto a la puerta. Acercate y apretá E.',
        'Empezá con "pwd" para saber dónde estás y "ls" para ver qué hay. Si te trabás, escribí "hint".',
      ],
    },
    H: {
      kind: 'holo',
      id: 'holo-boot-bay',
      facing: 's',
      lines: ['SECTOR 01', 'BOOT BAY', '', 'WASD move  ·  E interact'],
    },
    h: {
      kind: 'holo',
      id: 'holo-data-core',
      facing: 's',
      lines: ['SECTOR 02', 'DATA CORE', '', 'ARCHIVE ONLINE'],
    },
  },
  regions: [
    { id: 'sector-01', name: 'SECTOR 01 // BOOT BAY', bounds: [1, 1, 10, 11] },
    { id: 'sector-02', name: 'SECTOR 02 // DATA CORE', bounds: [12, 1, 22, 11], poweredByFlag: 'sector02.unlocked' },
  ],
  lights: [
    { at: [4, 6], color: 0xff3355, intensity: 130, distance: 34, flag: 'sector02.unlocked', colorOn: 0x35e0ff, intensityOn: 100 },
    { at: [9, 6], color: 0xff3355, intensity: 90, distance: 24, flag: 'sector02.unlocked', colorOn: 0x3dff9a, intensityOn: 70 },
    { at: [14, 4], color: 0x35e0ff, intensity: 0, distance: 30, flag: 'sector02.unlocked', colorOn: 0x35e0ff, intensityOn: 110 },
    { at: [20, 8], color: 0x35e0ff, intensity: 0, distance: 30, flag: 'sector02.unlocked', colorOn: 0xff3df2, intensityOn: 90 },
  ],
  dataLines: [
    { points: [[3, 6], [10, 6]], color: 0xff3355, flag: 'sector02.unlocked', colorOn: 0x3dff9a },
    { points: [[12, 6], [22, 6]], color: 0x20283a, flag: 'sector02.unlocked', colorOn: 0x35e0ff },
    { points: [[17, 6], [17, 2]], color: 0x20283a, flag: 'sector02.unlocked', colorOn: 0x35e0ff },
  ],
};

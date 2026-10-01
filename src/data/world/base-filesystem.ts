import type { FsSpec } from '../../filesystem/spec';

/** The player's machine at the start of a new game; quests overlay extra content on top. */
export const BASE_FILESYSTEM: FsSpec = {
  dirs: ['/home/player', '/tmp', '/etc', '/var/log', '/srv', '/usr/bin'],
  files: {
    '/etc/hostname': 'aegis-01\n',
    '/etc/motd': 'AEGIS-01 // Station operating system\n',
    '/var/log/boot.log':
      '[ OK ] Reached target Basic System\n[ OK ] Started Station Core\n[WARN] Sector 02 lock controller: clearance profile missing\n[ OK ] Reached target Multi-User System\n',
    '/home/player/.bashrc': '# ~/.bashrc: executed by the shell on every new session\nexport PS1="\\u@\\h:\\w\\$ "\n',
  },
};

export const INITIAL_SHELL = {
  user: 'player',
  hostname: 'aegis-01',
  home: '/home/player',
};

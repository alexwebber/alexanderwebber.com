// Small wording helpers shared by the CV's components: counts in words and the anchors of the drill
// (contracts/routes.md *Anchors*). Pure.

/** "1 change", "12 changes". */
export const count = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** The drill's anchors: the same ids without scripts and with them. */
export const anchor = {
  overview: 'cv',
  theme: (id: string) => `theme-${id}`,
  roles: 'roles',
  threads: 'threads',
  thread: (id: string) => `thread-${id}`,
  next: 'next',
  change: (id: string) => `change-${id}`,
  /** A change reached through a thread: routed by the script only, never written as an href. */
  changeIn: (id: string, thread: string) => `change-${id}-in-${thread}`,
  role: (id: string) => `role-${id}`,
  nextItem: (id: string) => `next-${id}`,
  value: (story: string) => `value-${story}`,
} as const;

/** The style that gives an element its theme's lane colour (styles/cv.css --cv-lane-1 to -8). */
export const laneStyle = (colour: string): string => `--cv-lane: var(--cv-${colour})`;

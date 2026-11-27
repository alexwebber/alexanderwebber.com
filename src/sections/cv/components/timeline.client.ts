// The phone drill (contracts/timeline-ui.md *The drill*; data-model.md *State*; T054). No library;
// the whole script's budget is 10 KB gzip by the end of slice 4. Without it the page reads as linked
// sections in order; with it, one level of the timeline shows at a time, routed on the hash:
//
//   #cv                          the overview
//   #theme-<id>, #roles, #threads, #thread-<id>, #next          a list
//   #change-<id>, #role-<id>, #next-<id>                        a card
//   #change-<id>-in-<thread>     a change reached through its thread (never written as an href)
//
// The back control, the browser's back button and Escape each go up one level: a change's theme
// list (or its thread, inside one), #roles for a role, #next for a next item, #cv for a list.
// Going in, focus moves to the new level's heading; coming back out, it returns to the tile or row
// that led in. Back and Escape use history.back() only when this script pushed the current entry
// from that parent; otherwise they replace the entry, so a card opened from a shared link never
// leaves the page. Previous and next replace the entry, so back still goes up a level. A hash that
// isn't the timeline's (#main, #value-<id>) is left to the browser. A timeline-shaped hash with an
// unknown id shows the overview.
//
// Also: the contact block's email in words becomes a mailto: link (owner decision 4, provisional).
// Nothing is stored and nothing is sent.

interface Route {
  /** The hash, with '#'. */
  hash: string;
  /** The level's element (.cv-level). */
  level: HTMLElement;
  /** The level's heading (the anchor's element). */
  heading: HTMLElement;
  /** A card shown inside its thread: the thread list's anchor id. */
  thread?: string;
}

const OVERVIEW = '#cv';
const SHAPE = /^#(cv|roles|threads|next|(theme|thread|change|role|next)-.+)$/;

const section = document.querySelector<HTMLElement>('[data-cv-timeline]');
if (section) start(section);
enhanceEmail();

function enhanceEmail(): void {
  const email = document.querySelector<HTMLElement>('[data-cv-field="email"]');
  const { user, domain } = email?.dataset ?? {};
  if (!email || !user || !domain) return;
  const link = document.createElement('a');
  link.href = `mailto:${user}@${domain}`;
  link.textContent = `${user}@${domain}`;
  email.replaceChildren(link);
}

function start(root: HTMLElement): void {
  const byId = (id: string) => {
    const el = document.getElementById(id);
    return el && root.contains(el) ? el : null;
  };
  const overview = root.querySelector<HTMLElement>('.cv-overview')!;
  const sectionHeading = byId('cv-heading')!;
  const crumbs = root.querySelector<HTMLElement>('[data-crumbs]')!;
  const trail = crumbs.querySelector<HTMLElement>('[data-trail]')!;
  const back = crumbs.querySelector<HTMLButtonElement>('[data-back]')!;

  // Links that read differently once the script runs: a change in a thread opens inside it.
  for (const link of root.querySelectorAll<HTMLAnchorElement>('a[data-to]')) link.setAttribute('href', link.dataset.to!);

  /** The route for a hash, undefined when it isn't the timeline's, the overview when its id is unknown. */
  function route(hash: string): Route | undefined {
    if (hash === '' || hash === OVERVIEW) return { hash: OVERVIEW, level: overview, heading: sectionHeading };
    if (!SHAPE.test(hash)) return undefined;
    const id = decodeURIComponent(hash.slice(1));
    const own = byId(id);
    if (own?.closest('.cv-level') && own.matches('h3')) return { hash, level: own.closest<HTMLElement>('.cv-level')!, heading: own };
    // #change-<id>-in-<thread>: try each "-in-" split until a card in that thread is found.
    for (let at = id.indexOf('-in-'); at !== -1; at = id.indexOf('-in-', at + 1)) {
      const card = byId(id.slice(0, at));
      const thread = `thread-${id.slice(at + 4)}`;
      const level = card?.closest<HTMLElement>('.cv-card');
      if (card && level?.dataset.thread === thread) return { hash, level, heading: card, thread };
    }
    return { hash: OVERVIEW, level: overview, heading: sectionHeading };
  }

  /** The parent level's hash. */
  function parentOf(r: Route): string | undefined {
    if (r.hash === OVERVIEW) return undefined;
    if (r.thread) return `#${r.thread}`;
    const parent = r.level.dataset.parent;
    if (parent) return `#${parent}`;
    return r.heading.id.startsWith('thread-') ? '#threads' : OVERVIEW;
  }

  const name = (r: Route) => (r.hash === OVERVIEW ? 'Themes' : (r.heading.textContent ?? '').trim());

  function fillCrumbs(r: Route): void {
    crumbs.hidden = r.hash === OVERVIEW;
    if (crumbs.hidden) return;
    const chain: Route[] = [];
    for (let at: Route | undefined = r; at; ) {
      chain.unshift(at);
      const up = parentOf(at);
      at = up ? route(up) : undefined;
    }
    trail.replaceChildren(
      ...chain.map((step, i) => {
        const li = document.createElement('li');
        if (i === chain.length - 1) {
          const here = document.createElement('span');
          here.setAttribute('aria-current', 'page');
          here.textContent = name(step);
          li.append(here);
        } else {
          const link = document.createElement('a');
          link.href = step.hash;
          link.textContent = name(step);
          li.append(link);
        }
        return li;
      }),
    );
    back.setAttribute('aria-label', `Back to ${name(chain.at(-2)!)}`);
  }

  let current: Route | undefined;

  /** Shows a level; returns where focus went, if it moved. */
  function show(r: Route, from: Route | undefined): HTMLElement | undefined {
    for (const level of root.querySelectorAll<HTMLElement>('.cv-level.is-current')) level.classList.remove('is-current');
    r.level.classList.add('is-current');
    if (r.level.classList.contains('cv-card')) {
      const inThread = Boolean(r.thread);
      for (const el of r.level.querySelectorAll<HTMLElement>('[data-thread-only]')) el.hidden = !inThread;
      for (const el of r.level.querySelectorAll<HTMLElement>('[data-home-only]')) el.hidden = inThread;
    }
    fillCrumbs(r);
    current = r;
    if (!from || from.hash === r.hash) return undefined;
    // Coming back out: focus the tile or row that leads to where we were.
    if (parentOf(from) === r.hash) {
      const into = [...r.level.querySelectorAll<HTMLAnchorElement>('a[href]')].find((a) => a.getAttribute('href') === from.hash);
      if (into) {
        into.focus({ preventScroll: true });
        into.scrollIntoView({ block: 'center' });
        return into;
      }
    }
    r.heading.focus({ preventScroll: true });
    const top = root.getBoundingClientRect().top;
    if (top < 0) root.scrollIntoView({ block: 'start' });
    else if (r.heading.getBoundingClientRect().bottom > window.innerHeight) r.heading.scrollIntoView({ block: 'nearest' });
    return r.heading;
  }

  /** Goes to a timeline hash: pushed from here, or replacing this entry (previous and next). */
  function go(hash: string, replace: boolean): void {
    const from = current;
    if (replace) history.replaceState({ cvFrom: history.state?.cvFrom ?? null }, '', hash);
    else history.pushState({ cvFrom: from?.hash ?? OVERVIEW }, '', hash);
    const r = route(hash);
    if (r) show(r, from);
  }

  function up(): void {
    if (!current) return;
    const parent = parentOf(current);
    if (!parent) return;
    if (history.state?.cvFrom === parent) {
      history.back();
      return;
    }
    const from = current;
    history.replaceState({ cvFrom: null }, '', parent);
    show(route(parent)!, from);
  }

  root.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element).closest?.('a[href^="#"]');
    if (!link || !root.contains(link)) return;
    const hash = link.getAttribute('href')!;
    if (!route(hash)) return;
    event.preventDefault();
    go(hash, link.hasAttribute('data-step'));
  });
  back.addEventListener('click', up);
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented || !current || current.hash === OVERVIEW) return;
    const active = document.activeElement;
    if (active && active !== document.body && !root.contains(active)) return;
    event.preventDefault();
    up();
  });
  // On the browser's back and forward the browser itself then focuses and scrolls to the address's
  // element (a level heading is focusable), after this handler: put focus back where show() put it.
  const onHistory = () => {
    const r = route(location.hash);
    if (!r || r.hash === current?.hash) return;
    const target = show(r, current);
    if (target) {
      setTimeout(() => {
        if (document.activeElement === target) return;
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: target === r.heading ? 'nearest' : 'center' });
      });
    }
  };
  window.addEventListener('popstate', onHistory);
  window.addEventListener('hashchange', onHistory);

  document.documentElement.classList.add('cv-ready');
  const first = route(location.hash);
  if (first) {
    show(first, undefined);
    if (first.hash !== OVERVIEW || location.hash === OVERVIEW) {
      // The section's top, so the trail and the level's label above its heading are in view too.
      first.heading.focus({ preventScroll: true });
      root.scrollIntoView({ block: 'start' });
    }
  } else {
    show(route(OVERVIEW)!, undefined);
  }
}

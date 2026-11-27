// Packing (specs/004-interactive-cv/data-model.md *Derived values* **Packing**): pure. Puts marks
// into the fewest rows where no two overlap, greedily by start (then end): each mark goes into the
// first row whose last mark ends at least `gap` before it starts. Used per theme by the phone strips, and later by
// the swimlanes (T071) and the share image (T097).
//
// A mark is never narrower than `minWidth` (a share of the axis), so dots and short bars never touch
// at 320 px, where a strip is about 260 px wide (spec edge case: several changes in one year and
// lane). A point draws as a dot at its middle, so it takes `minWidth` centred there; a period takes
// its span, widened to `minWidth` from its start.

/** The least share of the axis a mark takes: 8 px of a 260 px strip at 320 px. */
export const MIN_MARK = 0.032;

/** The least space between two marks in one row (2 px at 320 px), so back-to-back periods read as two. */
export const GAP = MIN_MARK / 4;

export interface Mark {
  id: string;
  /** 0..1 on the career scale. */
  x0: number;
  x1: number;
  point: boolean;
}

export interface Packed<T extends Mark = Mark> {
  /** Each mark with its row (0 is the top) and the extent it takes, minimum width included. */
  marks: (T & { row: number; from: number; to: number })[];
  rows: number;
}

/** The extent a mark takes on the axis: a point centred on its middle, a period from its start. */
export function extent(mark: Pick<Mark, 'x0' | 'x1' | 'point'>, minWidth = MIN_MARK): [number, number] {
  if (mark.point) {
    const middle = (mark.x0 + mark.x1) / 2;
    const half = Math.max(minWidth, 0) / 2;
    return [middle - half, middle + half];
  }
  return [mark.x0, Math.max(mark.x1, mark.x0 + minWidth)];
}

/** The marks in the fewest rows without overlap (greedy by start, then end; ties keep their order). */
export function pack<T extends Mark>(marks: readonly T[], minWidth = MIN_MARK, gap = GAP): Packed<T> {
  const placed = marks.map((mark, index) => {
    const [from, to] = extent(mark, minWidth);
    return { mark, index, from, to };
  });
  placed.sort((a, b) => a.from - b.from || a.to - b.to || a.index - b.index);
  const rowEnds: number[] = [];
  const out: Packed<T>['marks'] = new Array(marks.length);
  for (const { mark, index, from, to } of placed) {
    let row = rowEnds.findIndex((end) => end + gap <= from);
    if (row === -1) {
      row = rowEnds.length;
      rowEnds.push(to);
    } else {
      rowEnds[row] = to;
    }
    out[index] = { ...mark, row, from, to };
  }
  return { marks: out, rows: rowEnds.length };
}

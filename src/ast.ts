import type { CharRange, Expr, PredefinedClass } from './types.ts';

export const START_MARKER = '\u0000';
export const END_MARKER = '\u0001';
export const START_MARKER_CODE = 0;
export const END_MARKER_CODE = 1;
export const ALPHABET_MIN_CODE = 0;
export const ALPHABET_MAX_CODE = 255;
const MATCHABLE_CODE_RANGES: readonly CharRange[] = [{ start: 2, end: 255 }];

const DIGIT_RANGES: readonly CharRange[] = [{ start: 48, end: 57 }];
const WORD_RANGES: readonly CharRange[] = [
  { start: 48, end: 57 },
  { start: 65, end: 90 },
  { start: 95, end: 95 },
  { start: 97, end: 122 },
];
const SPACE_RANGES: readonly CharRange[] = [
  { start: 9, end: 13 },
  { start: 32, end: 32 },
];

export type ExprKind = Expr['kind'];

const EMPTY_EXPR: Expr = { kind: 'empty' };
const NULL_EXPR: Expr = { kind: 'null' };
const DOT_EXPR: Expr = { kind: 'dot' };
const START_ANCHOR_EXPR: Expr = { kind: 'startAnchor' };
const END_ANCHOR_EXPR: Expr = { kind: 'endAnchor' };
const ANY_STRING_EXPR: Expr = { kind: 'star', expr: DOT_EXPR };
const NON_EMPTY_STRING_EXPR: Expr = { kind: 'concat', left: DOT_EXPR, right: ANY_STRING_EXPR };

const exprKeyCache = new WeakMap<Expr, string>();
const normalizeCache = new WeakMap<Expr, Expr>();

export const emptyExpr = (): Expr => EMPTY_EXPR;
export const nullExpr = (): Expr => NULL_EXPR;
export const charExpr = (value: string): Expr => ({ kind: 'char', value });
export const dotExpr = (): Expr => DOT_EXPR;
export const charSetExpr = (ranges: readonly CharRange[], negated: boolean): Expr => ({
  kind: 'charset',
  ranges: mergeRanges(ranges),
  negated,
});
export const startAnchorExpr = (): Expr => START_ANCHOR_EXPR;
export const endAnchorExpr = (): Expr => END_ANCHOR_EXPR;
export const concatExpr = (left: Expr, right: Expr): Expr => ({ kind: 'concat', left, right });
export const unionExpr = (left: Expr, right: Expr): Expr => ({ kind: 'union', left, right });
export const intersectionExpr = (left: Expr, right: Expr): Expr => ({
  kind: 'intersection',
  left,
  right,
});
export const complementExpr = (expr: Expr): Expr => ({ kind: 'complement', expr });
export const starExpr = (expr: Expr): Expr => {
  if (expr === DOT_EXPR) {
    return ANY_STRING_EXPR;
  }
  return { kind: 'star', expr };
};
export const repeatExpr = (expr: Expr, min: number, max: number): Expr => ({
  kind: 'repeat',
  expr,
  min,
  max,
});
export const anyStringExpr = (): Expr => ANY_STRING_EXPR;

export function mergeRanges(ranges: readonly CharRange[]): CharRange[] {
  if (ranges.length <= 1) {
    return [...ranges];
  }

  type MutableRange = { start: number; end: number };

  const sorted = [...ranges].sort(
    (left, right) => left.start - right.start || left.end - right.end,
  );
  const merged: MutableRange[] = [];

  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (!previous || range.start > previous.end + 1) {
      merged.push({ start: range.start, end: range.end });
      continue;
    }
    if (range.end > previous.end) {
      previous.end = range.end;
    }
  }

  return merged;
}

export function complementRanges(
  ranges: readonly CharRange[],
  universe: readonly CharRange[] = MATCHABLE_CODE_RANGES,
): CharRange[] {
  const mergedRanges = mergeRanges(ranges);
  const mergedUniverse = mergeRanges(universe);
  const result: CharRange[] = [];
  let rangeIndex = 0;

  for (const universeRange of mergedUniverse) {
    let cursor = universeRange.start;

    while (rangeIndex < mergedRanges.length && mergedRanges[rangeIndex].end < universeRange.start) {
      rangeIndex += 1;
    }

    let activeIndex = rangeIndex;
    while (
      activeIndex < mergedRanges.length &&
      mergedRanges[activeIndex].start <= universeRange.end
    ) {
      const activeRange = mergedRanges[activeIndex];
      if (activeRange.start > cursor) {
        result.push({ start: cursor, end: activeRange.start - 1 });
      }
      cursor = Math.max(cursor, activeRange.end + 1);
      if (cursor > universeRange.end) {
        break;
      }
      activeIndex += 1;
    }

    if (cursor <= universeRange.end) {
      result.push({ start: cursor, end: universeRange.end });
    }
  }

  return result;
}

export function predefinedClassRanges(kind: PredefinedClass): CharRange[] {
  switch (kind) {
    case 'd':
      return [...DIGIT_RANGES];
    case 'D':
      return complementRanges(DIGIT_RANGES);
    case 'w':
      return [...WORD_RANGES];
    case 'W':
      return complementRanges(WORD_RANGES);
    case 's':
      return [...SPACE_RANGES];
    case 'S':
      return complementRanges(SPACE_RANGES);
  }
}

export function predefinedClassExpr(kind: PredefinedClass): Expr {
  return charSetExpr(predefinedClassRanges(kind), false);
}

export function containsExprKind(expr: Expr, targetKind: ExprKind): boolean {
  if (expr.kind === targetKind) {
    return true;
  }

  switch (expr.kind) {
    case 'concat':
    case 'union':
    case 'intersection':
      return containsExprKind(expr.left, targetKind) || containsExprKind(expr.right, targetKind);
    case 'complement':
    case 'star':
    case 'repeat':
      return containsExprKind(expr.expr, targetKind);
    default:
      return false;
  }
}

export function isAnyStringExpr(expr: Expr): boolean {
  return expr === ANY_STRING_EXPR || (expr.kind === 'star' && expr.expr.kind === 'dot');
}

export function exprKey(expr: Expr): string {
  const cached = exprKeyCache.get(expr);
  if (cached !== undefined) {
    return cached;
  }

  let key: string;

  switch (expr.kind) {
    case 'empty':
      key = 'ε';
      break;
    case 'null':
      key = '∅';
      break;
    case 'char':
      key = `c:${JSON.stringify(expr.value)}`;
      break;
    case 'dot':
      key = '.';
      break;
    case 'charset': {
      const serializedRanges = expr.ranges.map((range) => `${range.start}-${range.end}`).join(',');
      key = expr.negated ? `[^${serializedRanges}]` : `[${serializedRanges}]`;
      break;
    }
    case 'startAnchor':
      key = '^';
      break;
    case 'endAnchor':
      key = '$';
      break;
    case 'concat':
      key = `(${exprKey(expr.left)}·${exprKey(expr.right)})`;
      break;
    case 'union':
      key = `(${exprKey(expr.left)}|${exprKey(expr.right)})`;
      break;
    case 'intersection':
      key = `(${exprKey(expr.left)}&${exprKey(expr.right)})`;
      break;
    case 'complement':
      key = `!${exprKey(expr.expr)}`;
      break;
    case 'star':
      key = `(${exprKey(expr.expr)})*`;
      break;
    case 'repeat':
      key = `repeat(${exprKey(expr.expr)},${expr.min},${expr.max === Infinity ? '∞' : expr.max})`;
      break;
  }

  exprKeyCache.set(expr, key);
  return key;
}

export function equalExpr(left: Expr, right: Expr): boolean {
  return exprKey(left) === exprKey(right);
}

function collectTerms(
  targetKind: 'union' | 'intersection',
  expr: Expr,
  terms: Map<string, Expr>,
): void {
  if (expr.kind === targetKind) {
    collectTerms(targetKind, expr.left, terms);
    collectTerms(targetKind, expr.right, terms);
    return;
  }

  terms.set(exprKey(expr), expr);
}

function foldTerms(kind: 'union' | 'intersection', terms: readonly Expr[]): Expr {
  if (terms.length === 0) {
    return kind === 'union' ? NULL_EXPR : ANY_STRING_EXPR;
  }

  let current = terms[0];
  for (let index = 1; index < terms.length; index += 1) {
    current =
      kind === 'union' ? unionExpr(current, terms[index]) : intersectionExpr(current, terms[index]);
  }
  return current;
}

function hasComplementPair(terms: readonly Expr[]): boolean {
  const keyedTerms = new Set<string>();
  const termKeys: string[] = [];

  for (const term of terms) {
    const key = exprKey(term);
    keyedTerms.add(key);
    termKeys.push(key);
  }

  for (let index = 0; index < terms.length; index += 1) {
    const term = terms[index];
    const counterpartKey = term.kind === 'complement' ? exprKey(term.expr) : `!${termKeys[index]}`;
    if (keyedTerms.has(counterpartKey)) {
      return true;
    }
  }

  return false;
}

function sortTerms(terms: readonly Expr[]): Expr[] {
  const keyedTerms = terms.map((term) => ({ key: exprKey(term), term }));
  keyedTerms.sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
  return keyedTerms.map((entry) => entry.term);
}

export function normalize(expr: Expr): Expr {
  const cached = normalizeCache.get(expr);
  if (cached !== undefined) {
    return cached;
  }

  let result: Expr;

  switch (expr.kind) {
    case 'concat': {
      const left = normalize(expr.left);
      const right = normalize(expr.right);
      if (left.kind === 'null' || right.kind === 'null') {
        result = NULL_EXPR;
        break;
      }
      if (left.kind === 'empty') {
        result = right;
        break;
      }
      if (right.kind === 'empty') {
        result = left;
        break;
      }
      result = concatExpr(left, right);
      break;
    }

    case 'union': {
      const terms = new Map<string, Expr>();
      collectTerms('union', normalize(expr.left), terms);
      collectTerms('union', normalize(expr.right), terms);

      let containsAnyString = false;
      for (const term of terms.values()) {
        if (isAnyStringExpr(term)) {
          containsAnyString = true;
          break;
        }
      }

      if (containsAnyString) {
        result = ANY_STRING_EXPR;
        break;
      }

      const filteredTerms = [...terms.values()].filter((term) => term.kind !== 'null');
      if (filteredTerms.length === 0) {
        result = NULL_EXPR;
        break;
      }
      if (filteredTerms.length === 1) {
        result = filteredTerms[0];
        break;
      }
      if (hasComplementPair(filteredTerms)) {
        result = ANY_STRING_EXPR;
        break;
      }

      result = foldTerms('union', sortTerms(filteredTerms));
      break;
    }

    case 'intersection': {
      const terms = new Map<string, Expr>();
      collectTerms('intersection', normalize(expr.left), terms);
      collectTerms('intersection', normalize(expr.right), terms);

      let containsNull = false;
      for (const term of terms.values()) {
        if (term.kind === 'null') {
          containsNull = true;
          break;
        }
      }

      if (containsNull) {
        result = NULL_EXPR;
        break;
      }

      const filteredTerms = [...terms.values()].filter((term) => !isAnyStringExpr(term));
      if (filteredTerms.length === 0) {
        result = ANY_STRING_EXPR;
        break;
      }
      if (filteredTerms.length === 1) {
        result = filteredTerms[0];
        break;
      }
      if (hasComplementPair(filteredTerms)) {
        result = NULL_EXPR;
        break;
      }

      result = foldTerms('intersection', sortTerms(filteredTerms));
      break;
    }

    case 'complement': {
      const inner = normalize(expr.expr);
      if (inner.kind === 'union') {
        result = normalize(
          intersectionExpr(complementExpr(inner.left), complementExpr(inner.right)),
        );
        break;
      }
      if (inner.kind === 'intersection') {
        result = normalize(unionExpr(complementExpr(inner.left), complementExpr(inner.right)));
        break;
      }
      if (inner.kind === 'complement') {
        result = inner.expr;
        break;
      }
      if (inner.kind === 'null') {
        result = ANY_STRING_EXPR;
        break;
      }
      if (inner.kind === 'empty') {
        result = NON_EMPTY_STRING_EXPR;
        break;
      }
      result = complementExpr(inner);
      break;
    }

    case 'star': {
      const inner = normalize(expr.expr);
      if (inner.kind === 'null' || inner.kind === 'empty') {
        result = EMPTY_EXPR;
        break;
      }
      if (inner.kind === 'star') {
        result = inner;
        break;
      }
      result = starExpr(inner);
      break;
    }

    case 'repeat': {
      const inner = normalize(expr.expr);
      if (expr.min === 0 && expr.max === 0) {
        result = EMPTY_EXPR;
        break;
      }
      if (inner.kind === 'null') {
        result = expr.min === 0 ? EMPTY_EXPR : NULL_EXPR;
        break;
      }
      if (inner.kind === 'empty') {
        result = EMPTY_EXPR;
        break;
      }
      if (expr.min === 1 && expr.max === 1) {
        result = inner;
        break;
      }
      if (expr.min === 0 && expr.max === Infinity) {
        result = starExpr(inner);
        break;
      }
      result = repeatExpr(inner, expr.min, expr.max);
      break;
    }

    default:
      result = expr;
      break;
  }

  normalizeCache.set(expr, result);
  return result;
}

import type { Dfa, Expr } from './types.ts';

import * as AST from './ast.ts';
import { derive, isNullable } from './semantics.ts';

const ALPHABET_SIZE = AST.ALPHABET_MAX_CODE - AST.ALPHABET_MIN_CODE + 1;
const CODE_POINT_CHARS = Array.from({ length: AST.ALPHABET_MAX_CODE + 1 }, (_, codePoint) =>
  String.fromCharCode(codePoint),
);

type TransitionRange = { end: number; start: number };

export class Builder {
  public readonly hasEndAnchor: boolean;

  public readonly hasStartAnchor: boolean;

  private readonly acceptFlags: number[] = [];

  private nextStateId = 0;

  private pendingCursor = 0;

  private readonly pendingStateIds: number[] = [];

  private readonly rootExpr: Expr;

  private readonly stateExprs: Expr[] = [];

  private readonly stateIdByKey = new Map<string, number>();

  private readonly transitionTable: Int32Array[] = [];

  constructor(expr: Expr, alreadyNormalized = false) {
    this.rootExpr = alreadyNormalized ? expr : AST.normalize(expr);
    this.hasStartAnchor = AST.containsExprKind(expr, 'startAnchor');
    this.hasEndAnchor = AST.containsExprKind(expr, 'endAnchor');
  }

  public build(): Dfa {
    const initialState = this.getOrCreateStateId(this.rootExpr);

    while (this.pendingCursor < this.pendingStateIds.length) {
      const stateId = this.pendingStateIds[this.pendingCursor];
      this.pendingCursor += 1;

      const expr = this.stateExprs[stateId];
      if (!expr) {
        throw new Error(`Missing expression for DFA state ${stateId}`);
      }

      this.expandState(stateId, expr);
    }

    const acceptTable = Uint8Array.from(this.acceptFlags);
    const transitionTable = this.transitionTable;
    let acceptStatesCache: ReadonlySet<number> | undefined;
    let transitionsCache: ReadonlyMap<number, ReadonlyMap<number, number>> | undefined;

    return {
      get acceptStates(): ReadonlySet<number> {
        if (acceptStatesCache === undefined) {
          acceptStatesCache = buildAcceptStates(acceptTable);
        }
        return acceptStatesCache;
      },
      acceptTable,
      initialState,
      stateCount: this.nextStateId,
      get transitions(): ReadonlyMap<number, ReadonlyMap<number, number>> {
        if (transitionsCache === undefined) {
          transitionsCache = buildTransitionMap(transitionTable);
        }
        return transitionsCache;
      },
      transitionTable,
    };
  }

  private expandState(stateId: number, expr: Expr): void {
    const row = this.transitionTable[stateId];
    const ranges = getTransitionRanges(expr);

    for (let index = 0; index < ranges.length; index += 1) {
      const range = ranges[index];
      const nextExpr = derive(expr, CODE_POINT_CHARS[range.start]);
      const nextStateId = this.getOrCreateStateId(nextExpr);

      for (let codePoint = range.start; codePoint <= range.end; codePoint += 1) {
        row[codePoint] = nextStateId;
      }
    }
  }

  private getOrCreateStateId(expr: Expr): number {
    const normalizedExpr = AST.normalize(expr);
    const key = AST.exprKey(normalizedExpr);
    const existingStateId = this.stateIdByKey.get(key);

    if (existingStateId !== undefined) {
      return existingStateId;
    }

    const stateId = this.nextStateId;
    this.nextStateId += 1;

    this.stateIdByKey.set(key, stateId);
    this.stateExprs[stateId] = normalizedExpr;
    this.transitionTable[stateId] = createTransitionRow();
    this.acceptFlags[stateId] = isNullable(normalizedExpr) ? 1 : 0;
    this.pendingStateIds.push(stateId);

    return stateId;
  }
}

function addBoundary(boundaries: Set<number>, codePoint: number): void {
  if (codePoint >= AST.ALPHABET_MIN_CODE && codePoint <= AST.ALPHABET_MAX_CODE + 1) {
    boundaries.add(codePoint);
  }
}

function addRangeBoundary(boundaries: Set<number>, start: number, end: number): void {
  addBoundary(boundaries, start);
  addBoundary(boundaries, end + 1);
}

function buildAcceptStates(acceptTable: Uint8Array): ReadonlySet<number> {
  const acceptStates = new Set<number>();
  for (let stateId = 0; stateId < acceptTable.length; stateId += 1) {
    if (acceptTable[stateId] === 1) {
      acceptStates.add(stateId);
    }
  }
  return acceptStates;
}

function buildTransitionMap(
  transitionTable: readonly Int32Array[],
): ReadonlyMap<number, ReadonlyMap<number, number>> {
  const transitions = new Map<number, ReadonlyMap<number, number>>();

  for (let stateId = 0; stateId < transitionTable.length; stateId += 1) {
    const row = transitionTable[stateId];
    const stateTransitions = new Map<number, number>();

    for (
      let codePoint = AST.ALPHABET_MIN_CODE;
      codePoint <= AST.ALPHABET_MAX_CODE;
      codePoint += 1
    ) {
      const nextStateId = row[codePoint];
      if (nextStateId >= 0) {
        stateTransitions.set(codePoint, nextStateId);
      }
    }

    transitions.set(stateId, stateTransitions);
  }

  return transitions;
}

function collectBoundaries(expr: Expr, boundaries: Set<number>): void {
  switch (expr.kind) {
    case 'char': {
      const codePoint = expr.value.charCodeAt(0);
      addRangeBoundary(boundaries, codePoint, codePoint);
      return;
    }
    case 'charset':
      addBoundary(boundaries, AST.END_MARKER_CODE + 1);
      for (const range of expr.ranges) {
        addRangeBoundary(boundaries, range.start, range.end);
      }
      return;

    case 'complement':

    case 'repeat':

    case 'star':
      collectBoundaries(expr.expr, boundaries);
      return;

    case 'concat':

    case 'intersection':

    case 'union':
      collectBoundaries(expr.left, boundaries);
      collectBoundaries(expr.right, boundaries);
      return;
    case 'dot':
      addRangeBoundary(boundaries, AST.ALPHABET_MIN_CODE, AST.END_MARKER_CODE);
      addRangeBoundary(boundaries, AST.END_MARKER_CODE + 1, AST.ALPHABET_MAX_CODE);
      return;
    case 'empty':

    case 'null':
      return;
    case 'endAnchor':
      addRangeBoundary(boundaries, AST.END_MARKER_CODE, AST.END_MARKER_CODE);
      return;
    case 'startAnchor':
      addRangeBoundary(boundaries, AST.START_MARKER_CODE, AST.START_MARKER_CODE);
      return;
  }
}

function createTransitionRow(): Int32Array {
  const row = new Int32Array(ALPHABET_SIZE);
  row.fill(-1);
  return row;
}

function getTransitionRanges(expr: Expr): TransitionRange[] {
  const boundaries = new Set<number>([AST.ALPHABET_MAX_CODE + 1, AST.ALPHABET_MIN_CODE]);
  collectBoundaries(expr, boundaries);

  const sortedBoundaries = [...boundaries]
    .filter(
      (codePoint) => codePoint >= AST.ALPHABET_MIN_CODE && codePoint <= AST.ALPHABET_MAX_CODE + 1,
    )
    .sort((left, right) => left - right);

  const ranges: TransitionRange[] = [];
  for (let index = 0; index < sortedBoundaries.length - 1; index += 1) {
    const start = sortedBoundaries[index];
    const end = sortedBoundaries[index + 1] - 1;
    if (start <= end) {
      ranges.push({ end, start });
    }
  }

  return ranges;
}

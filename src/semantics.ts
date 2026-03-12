import type { Expr } from './types.ts';

import * as AST from './ast.ts';

const nullableCache = new WeakMap<Expr, boolean>();
const derivativeCache = new WeakMap<Expr, Map<number, Expr>>();
const charsetTableCache = new WeakMap<Extract<Expr, { kind: 'charset' }>, Uint8Array>();

export function derive(expr: Expr, inputChar: string): Expr {
  const codePoint = inputChar.charCodeAt(0);
  let cachedByCode = derivativeCache.get(expr);

  if (cachedByCode !== undefined) {
    const cached = cachedByCode.get(codePoint);
    if (cached !== undefined) {
      return cached;
    }
  }

  const result = deriveImpl(expr, inputChar, codePoint);

  if (cachedByCode === undefined) {
    cachedByCode = new Map<number, Expr>();
    derivativeCache.set(expr, cachedByCode);
  }
  cachedByCode.set(codePoint, result);

  return result;
}

export function isNullable(expr: Expr): boolean {
  const cached = nullableCache.get(expr);
  if (cached !== undefined) {
    return cached;
  }

  let result: boolean;

  switch (expr.kind) {
    case 'char':
    case 'charset':
    case 'dot':
    case 'endAnchor':
    case 'null':
    case 'startAnchor':
      result = false;
      break;
    case 'complement':
      result = !isNullable(expr.expr);
      break;
    case 'concat':
      result = isNullable(expr.left) && isNullable(expr.right);
      break;
    case 'empty':
      result = true;
      break;
    case 'intersection':
      result = isNullable(expr.left) && isNullable(expr.right);
      break;
    case 'repeat':
      result = expr.min === 0 || isNullable(expr.expr);
      break;
    case 'star':
      result = true;
      break;
    case 'union':
      result = isNullable(expr.left) || isNullable(expr.right);
      break;
  }

  nullableCache.set(expr, result);
  return result;
}

function deriveImpl(expr: Expr, inputChar: string, codePoint: number): Expr {
  switch (expr.kind) {
    case 'char':
      return expr.value.charCodeAt(0) === codePoint ? AST.emptyExpr() : AST.nullExpr();
    case 'charset':
      return getCharsetTable(expr)[codePoint] === 1 ? AST.emptyExpr() : AST.nullExpr();

    case 'complement':
      return AST.complementExpr(derive(expr.expr, inputChar));

    case 'concat': {
      const leftDerivative = derive(expr.left, inputChar);
      if (isNullable(expr.left)) {
        return AST.unionExpr(
          AST.concatExpr(leftDerivative, expr.right),
          derive(expr.right, inputChar),
        );
      }
      return AST.concatExpr(leftDerivative, expr.right);
    }

    case 'dot':
      return codePoint > AST.END_MARKER_CODE ? AST.emptyExpr() : AST.nullExpr();

    case 'empty':

    case 'null':
      return AST.nullExpr();

    case 'endAnchor':
      return codePoint === AST.END_MARKER_CODE ? AST.emptyExpr() : AST.nullExpr();

    case 'intersection':
      return AST.intersectionExpr(derive(expr.left, inputChar), derive(expr.right, inputChar));

    case 'repeat':
      return deriveRepeat(expr, inputChar);

    case 'star':
      return AST.concatExpr(derive(expr.expr, inputChar), AST.starExpr(expr.expr));

    case 'startAnchor':
      return codePoint === AST.START_MARKER_CODE ? AST.emptyExpr() : AST.nullExpr();

    case 'union':
      return AST.unionExpr(derive(expr.left, inputChar), derive(expr.right, inputChar));
  }
}

function deriveRepeat(expr: Extract<Expr, { kind: 'repeat' }>, inputChar: string): Expr {
  if (expr.max === 0) {
    return AST.nullExpr();
  }

  const remaining = AST.repeatExpr(
    expr.expr,
    Math.max(0, expr.min - 1),
    expr.max === Infinity ? Infinity : expr.max - 1,
  );
  const consumeCurrent = AST.concatExpr(derive(expr.expr, inputChar), remaining);

  if (!isNullable(expr.expr)) {
    return consumeCurrent;
  }

  return AST.unionExpr(consumeCurrent, derive(remaining, inputChar));
}

function getCharsetTable(expr: Extract<Expr, { kind: 'charset' }>): Uint8Array {
  const cached = charsetTableCache.get(expr);
  if (cached !== undefined) {
    return cached;
  }

  const table = new Uint8Array(AST.ALPHABET_MAX_CODE + 1);

  for (const range of expr.ranges) {
    const start = Math.max(AST.ALPHABET_MIN_CODE, range.start);
    const end = Math.min(AST.ALPHABET_MAX_CODE, range.end);
    for (let codePoint = start; codePoint <= end; codePoint += 1) {
      table[codePoint] = 1;
    }
  }

  if (expr.negated) {
    for (
      let codePoint = AST.END_MARKER_CODE + 1;
      codePoint <= AST.ALPHABET_MAX_CODE;
      codePoint += 1
    ) {
      table[codePoint] = table[codePoint] === 1 ? 0 : 1;
    }
    table[AST.START_MARKER_CODE] = 0;
    table[AST.END_MARKER_CODE] = 0;
  }

  charsetTableCache.set(expr, table);
  return table;
}

import { Builder } from './builder.ts';
import { Lexer } from './lexer.ts';
import { Matcher } from './matcher.ts';
import { Parser } from './parser.ts';

const COMPILE_CACHE_LIMIT = 128;
const compileCache = new Map<string, Matcher>();

export function compile(pattern: string): Matcher {
  const cached = compileCache.get(pattern);
  if (cached !== undefined) {
    compileCache.delete(pattern);
    compileCache.set(pattern, cached);
    return cached;
  }

  const tokens = new Lexer(pattern).tokenize();
  const expr = new Parser(tokens).parse();
  const builder = new Builder(expr, true);
  const dfa = builder.build();
  const matcher = new Matcher(dfa, builder.hasStartAnchor, builder.hasEndAnchor);

  if (compileCache.size >= COMPILE_CACHE_LIMIT) {
    const oldestKey = compileCache.keys().next().value;
    if (typeof oldestKey === 'string') {
      compileCache.delete(oldestKey);
    }
  }

  compileCache.set(pattern, matcher);
  return matcher;
}

export function clearCompileCache(): void {
  compileCache.clear();
}

export * as AST from './ast.ts';
export { Builder, Lexer, Matcher, Parser };
export type { CharRange, Dfa, Expr, PredefinedClass, Token, TokenType } from './types.ts';

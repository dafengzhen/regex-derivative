export const TOKEN_TYPES = {
  AMPERSAND: 'AMPERSAND',
  BANG: 'BANG',
  CARET: 'CARET',
  CHAR: 'CHAR',
  COMMA: 'COMMA',
  DASH: 'DASH',
  DOLLAR: 'DOLLAR',
  DOT: 'DOT',
  EOF: 'EOF',
  LBRACE: 'LBRACE',
  LBRACKET: 'LBRACKET',
  LPAREN: 'LPAREN',
  PIPE: 'PIPE',
  PLUS: 'PLUS',
  PREDEFINED_CLASS: 'PREDEFINED_CLASS',
  QUESTION: 'QUESTION',
  RBRACE: 'RBRACE',
  RBRACKET: 'RBRACKET',
  RPAREN: 'RPAREN',
  STAR: 'STAR',
} as const;

export interface CharRange {
  readonly end: number;
  readonly start: number;
}

export interface Dfa {
  readonly acceptStates: ReadonlySet<number>;
  readonly acceptTable: Uint8Array;
  readonly initialState: number;
  readonly stateCount: number;
  readonly transitions: ReadonlyMap<number, ReadonlyMap<number, number>>;
  readonly transitionTable: readonly Int32Array[];
}

export type Expr =
  | { readonly expr: Expr; readonly kind: 'complement' }
  | { readonly expr: Expr; readonly kind: 'repeat'; readonly max: number; readonly min: number }
  | { readonly expr: Expr; readonly kind: 'star' }
  | { readonly kind: 'char'; readonly value: string }
  | { readonly kind: 'charset'; readonly negated: boolean; readonly ranges: readonly CharRange[] }
  | { readonly kind: 'concat'; readonly left: Expr; readonly right: Expr }
  | { readonly kind: 'dot' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'endAnchor' }
  | { readonly kind: 'intersection'; readonly left: Expr; readonly right: Expr }
  | { readonly kind: 'null' }
  | { readonly kind: 'startAnchor' }
  | { readonly kind: 'union'; readonly left: Expr; readonly right: Expr };

export type PredefinedClass = 'd' | 'D' | 's' | 'S' | 'w' | 'W';

export interface Token {
  readonly position: number;
  readonly type: TokenType;
  readonly value?: string;
}

export type TokenType = (typeof TOKEN_TYPES)[keyof typeof TOKEN_TYPES];

export const TOKEN_TYPES = {
  CHAR: 'CHAR',
  DOT: 'DOT',
  STAR: 'STAR',
  PLUS: 'PLUS',
  QUESTION: 'QUESTION',
  LBRACE: 'LBRACE',
  RBRACE: 'RBRACE',
  COMMA: 'COMMA',
  LBRACKET: 'LBRACKET',
  RBRACKET: 'RBRACKET',
  CARET: 'CARET',
  DOLLAR: 'DOLLAR',
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  PIPE: 'PIPE',
  AMPERSAND: 'AMPERSAND',
  BANG: 'BANG',
  PREDEFINED_CLASS: 'PREDEFINED_CLASS',
  DASH: 'DASH',
  EOF: 'EOF',
} as const;

export type TokenType = (typeof TOKEN_TYPES)[keyof typeof TOKEN_TYPES];
export type PredefinedClass = 'd' | 'D' | 'w' | 'W' | 's' | 'S';

export interface Token {
  readonly type: TokenType;
  readonly position: number;
  readonly value?: string;
}

export interface CharRange {
  readonly start: number;
  readonly end: number;
}

export type Expr =
  | { readonly kind: 'empty' }
  | { readonly kind: 'null' }
  | { readonly kind: 'char'; readonly value: string }
  | { readonly kind: 'dot' }
  | { readonly kind: 'charset'; readonly ranges: readonly CharRange[]; readonly negated: boolean }
  | { readonly kind: 'startAnchor' }
  | { readonly kind: 'endAnchor' }
  | { readonly kind: 'concat'; readonly left: Expr; readonly right: Expr }
  | { readonly kind: 'union'; readonly left: Expr; readonly right: Expr }
  | { readonly kind: 'intersection'; readonly left: Expr; readonly right: Expr }
  | { readonly kind: 'complement'; readonly expr: Expr }
  | { readonly kind: 'star'; readonly expr: Expr }
  | { readonly kind: 'repeat'; readonly expr: Expr; readonly min: number; readonly max: number };

export interface Dfa {
  readonly initialState: number;
  readonly stateCount: number;
  readonly acceptTable: Uint8Array;
  readonly transitionTable: readonly Int32Array[];
  readonly acceptStates: ReadonlySet<number>;
  readonly transitions: ReadonlyMap<number, ReadonlyMap<number, number>>;
}

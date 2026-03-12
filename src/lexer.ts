import type { Token } from './types.ts';

import { TOKEN_TYPES, type TokenType } from './types.ts';

export class Lexer {
  private offset = 0;

  private readonly source: string;

  private readonly tokens: Token[] = [];

  constructor(source: string) {
    this.source = source;
  }

  public tokenize(): Token[] {
    const { source, tokens } = this;
    const length = source.length;
    let offset = this.offset;

    while (offset < length) {
      const position = offset;
      const codePoint = source.charCodeAt(offset);

      if (isWhitespaceCode(codePoint)) {
        offset += 1;
        continue;
      }

      if (codePoint === 92) {
        offset = this.readEscape(position, offset, tokens);
        continue;
      }

      const tokenType = tokenTypeFromSingleCharCode(codePoint);
      if (tokenType !== undefined) {
        if (tokenType === TOKEN_TYPES.DASH) {
          tokens.push({ position, type: tokenType, value: '-' });
        } else {
          tokens.push({ position, type: tokenType });
        }
        offset += 1;
        continue;
      }

      tokens.push({ position, type: TOKEN_TYPES.CHAR, value: source[offset] });
      offset += 1;
    }

    this.offset = offset;
    tokens.push({ position: offset, type: TOKEN_TYPES.EOF });
    return tokens;
  }

  private readEscape(position: number, offset: number, tokens: Token[]): number {
    const escapeOffset = offset + 1;
    if (escapeOffset >= this.source.length) {
      throw new Error(`Unfinished escape sequence at position ${position}`);
    }

    const escapedChar = this.source[escapeOffset];

    switch (escapedChar) {
      case ' ':
        tokens.push({ position, type: TOKEN_TYPES.CHAR, value: ' ' });
        return escapeOffset + 1;
      case 'd':
      case 'D':
      case 's':
      case 'S':
      case 'w':
      case 'W':
        tokens.push({ position, type: TOKEN_TYPES.PREDEFINED_CLASS, value: escapedChar });
        return escapeOffset + 1;
      case 'n':
        tokens.push({ position, type: TOKEN_TYPES.CHAR, value: '\n' });
        return escapeOffset + 1;
      case 'r':
        tokens.push({ position, type: TOKEN_TYPES.CHAR, value: '\r' });
        return escapeOffset + 1;
      case 't':
        tokens.push({ position, type: TOKEN_TYPES.CHAR, value: '\t' });
        return escapeOffset + 1;
      default:
        tokens.push({ position, type: TOKEN_TYPES.CHAR, value: escapedChar });
        return escapeOffset + 1;
    }
  }
}

function isWhitespaceCode(codePoint: number): boolean {
  return (
    codePoint === 32 || codePoint === 9 || codePoint === 10 || codePoint === 13 || codePoint === 12
  );
}

function tokenTypeFromSingleCharCode(codePoint: number): TokenType | undefined {
  switch (codePoint) {
    case 33:
      return TOKEN_TYPES.BANG;
    case 36:
      return TOKEN_TYPES.DOLLAR;
    case 38:
      return TOKEN_TYPES.AMPERSAND;
    case 40:
      return TOKEN_TYPES.LPAREN;
    case 41:
      return TOKEN_TYPES.RPAREN;
    case 42:
      return TOKEN_TYPES.STAR;
    case 43:
      return TOKEN_TYPES.PLUS;
    case 44:
      return TOKEN_TYPES.COMMA;
    case 45:
      return TOKEN_TYPES.DASH;
    case 46:
      return TOKEN_TYPES.DOT;
    case 63:
      return TOKEN_TYPES.QUESTION;
    case 91:
      return TOKEN_TYPES.LBRACKET;
    case 93:
      return TOKEN_TYPES.RBRACKET;
    case 94:
      return TOKEN_TYPES.CARET;
    case 123:
      return TOKEN_TYPES.LBRACE;
    case 124:
      return TOKEN_TYPES.PIPE;
    case 125:
      return TOKEN_TYPES.RBRACE;
    default:
      return undefined;
  }
}

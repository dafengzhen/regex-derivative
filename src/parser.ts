import * as AST from './ast.ts';
import {
  type CharRange,
  type Expr,
  type PredefinedClass,
  type Token,
  TOKEN_TYPES,
  type TokenType,
} from './types.ts';

export class Parser {
  private current = 0;

  private readonly tokens: readonly Token[];

  constructor(tokens: readonly Token[]) {
    this.tokens = tokens;
  }

  public parse(): Expr {
    const expr = this.parseUnion();
    this.consume(TOKEN_TYPES.EOF, 'Unexpected tokens after the end of the pattern');
    return AST.normalize(expr);
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      this.current += 1;
    }
    return this.tokens[this.current - 1];
  }

  private canBeRangeEnd(token: Token): boolean {
    return (
      token.type !== TOKEN_TYPES.RBRACKET &&
      token.type !== TOKEN_TYPES.EOF &&
      token.type !== TOKEN_TYPES.PREDEFINED_CLASS
    );
  }

  private canStartExpression(tokenType: TokenType): boolean {
    switch (tokenType) {
      case TOKEN_TYPES.BANG:
      case TOKEN_TYPES.CARET:
      case TOKEN_TYPES.CHAR:
      case TOKEN_TYPES.DASH:
      case TOKEN_TYPES.DOLLAR:
      case TOKEN_TYPES.DOT:
      case TOKEN_TYPES.LBRACKET:
      case TOKEN_TYPES.LPAREN:
      case TOKEN_TYPES.PREDEFINED_CLASS:
        return true;
      default:
        return false;
    }
  }

  private check(tokenType: TokenType): boolean {
    return this.peek().type === tokenType;
  }

  private consume(tokenType: TokenType, message: string): Token {
    if (!this.check(tokenType)) {
      throw new Error(`${message} at position ${this.peek().position}`);
    }
    return this.advance();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TOKEN_TYPES.EOF;
  }

  private match(tokenType: TokenType): boolean {
    if (!this.check(tokenType)) {
      return false;
    }
    this.current += 1;
    return true;
  }

  private parseCharacterSet(startPosition: number): Expr {
    const negated = this.match(TOKEN_TYPES.CARET);

    if (this.match(TOKEN_TYPES.RBRACKET)) {
      if (!negated) {
        throw new Error('Empty character set [] is not allowed');
      }
      return AST.charSetExpr([], true);
    }

    const ranges: CharRange[] = [];

    while (!this.check(TOKEN_TYPES.RBRACKET)) {
      if (this.isAtEnd()) {
        throw new Error(`Unterminated character set starting at position ${startPosition}`);
      }

      if (this.check(TOKEN_TYPES.PREDEFINED_CLASS)) {
        const predefinedToken = this.advance();
        ranges.push(
          ...AST.predefinedClassRanges(this.requiredValue(predefinedToken) as PredefinedClass),
        );
        continue;
      }

      const startToken = this.advance();
      const startCode = this.tokenToCharacterSetCode(startToken);

      if (this.check(TOKEN_TYPES.DASH) && this.canBeRangeEnd(this.peekNext())) {
        this.advance();
        const endToken = this.advance();
        const endCode = this.tokenToCharacterSetCode(endToken);

        if (startCode > endCode) {
          throw new Error(
            `Invalid character range ${String.fromCharCode(startCode)}-${String.fromCharCode(endCode)} at position ${startToken.position}`,
          );
        }

        ranges.push({ end: endCode, start: startCode });
        continue;
      }

      ranges.push({ end: startCode, start: startCode });
    }

    this.consume(TOKEN_TYPES.RBRACKET, 'Expected ] to close the character set');
    return AST.charSetExpr(ranges, negated);
  }

  private parseConcatenation(): Expr {
    if (!this.canStartExpression(this.peek().type)) {
      return AST.emptyExpr();
    }

    let expr = this.parseUnary();

    while (this.canStartExpression(this.peek().type)) {
      expr = AST.concatExpr(expr, this.parseUnary());
    }

    return expr;
  }

  private parseInteger(message: string): number {
    let value = 0;
    let digitCount = 0;

    while (this.check(TOKEN_TYPES.CHAR)) {
      const token = this.peek();
      const tokenValue = token.value;

      if (typeof tokenValue !== 'string') {
        break;
      }

      const codePoint = tokenValue.charCodeAt(0);
      if (codePoint < 48 || codePoint > 57) {
        break;
      }

      value = value * 10 + codePoint - 48;
      digitCount += 1;
      this.advance();
    }

    if (digitCount === 0) {
      throw new Error(`${message} at position ${this.peek().position}`);
    }

    return value;
  }

  private parseIntersection(): Expr {
    let expr = this.parseConcatenation();

    while (this.match(TOKEN_TYPES.AMPERSAND)) {
      expr = AST.intersectionExpr(expr, this.parseConcatenation());
    }

    return expr;
  }

  private parsePrimary(): Expr {
    const token = this.advance();

    switch (token.type) {
      case TOKEN_TYPES.CARET:
        return AST.startAnchorExpr();
      case TOKEN_TYPES.CHAR:
      case TOKEN_TYPES.DASH:
        return AST.charExpr(this.requiredValue(token));
      case TOKEN_TYPES.DOLLAR:
        return AST.endAnchorExpr();
      case TOKEN_TYPES.DOT:
        return AST.dotExpr();
      case TOKEN_TYPES.LBRACKET:
        return this.parseCharacterSet(token.position);
      case TOKEN_TYPES.LPAREN: {
        const expr = this.check(TOKEN_TYPES.RPAREN) ? AST.emptyExpr() : this.parseUnion();
        this.consume(TOKEN_TYPES.RPAREN, 'Expected ) to close the group');
        return expr;
      }
      case TOKEN_TYPES.PREDEFINED_CLASS:
        return AST.predefinedClassExpr(this.requiredValue(token) as PredefinedClass);
      default:
        throw new Error(`Unexpected token ${token.type} at position ${token.position}`);
    }
  }

  private parseRepeat(expr: Expr): Expr {
    const startToken = this.consume(TOKEN_TYPES.LBRACE, 'Expected { to start a repeat quantifier');
    const min = this.parseInteger('Expected a numeric lower bound in the repeat quantifier');
    let max = min;

    if (this.match(TOKEN_TYPES.COMMA)) {
      max = this.check(TOKEN_TYPES.RBRACE)
        ? Infinity
        : this.parseInteger('Expected a numeric upper bound in the repeat quantifier');
    }

    this.consume(TOKEN_TYPES.RBRACE, 'Expected } to close the repeat quantifier');

    if (max !== Infinity && max < min) {
      throw new Error(`Invalid repeat range {${min},${max}} at position ${startToken.position}`);
    }

    return AST.repeatExpr(expr, min, max);
  }

  private parseUnary(): Expr {
    let expr: Expr;

    if (this.match(TOKEN_TYPES.BANG)) {
      expr = AST.complementExpr(this.parseUnary());
    } else {
      expr = this.parsePrimary();
    }

    while (true) {
      if (this.match(TOKEN_TYPES.STAR)) {
        expr = AST.starExpr(expr);
        continue;
      }

      if (this.match(TOKEN_TYPES.PLUS)) {
        expr = AST.repeatExpr(expr, 1, Infinity);
        continue;
      }

      if (this.match(TOKEN_TYPES.QUESTION)) {
        expr = AST.repeatExpr(expr, 0, 1);
        continue;
      }

      if (this.check(TOKEN_TYPES.LBRACE)) {
        expr = this.parseRepeat(expr);
        continue;
      }

      return expr;
    }
  }

  private parseUnion(): Expr {
    let expr = this.parseIntersection();

    while (this.match(TOKEN_TYPES.PIPE)) {
      expr = AST.unionExpr(expr, this.parseIntersection());
    }

    return expr;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private peekNext(): Token {
    return this.tokens[this.current + 1] ?? this.tokens[this.tokens.length - 1];
  }

  private requiredValue(token: Token): string {
    if (typeof token.value !== 'string') {
      throw new Error(
        `Token ${token.type} at position ${token.position} is missing a string value`,
      );
    }
    return token.value;
  }

  private tokenToCharacterSetCode(token: Token): number {
    switch (token.type) {
      case TOKEN_TYPES.AMPERSAND:
        return 38;
      case TOKEN_TYPES.BANG:
        return 33;
      case TOKEN_TYPES.CARET:
        return 94;
      case TOKEN_TYPES.CHAR:
      case TOKEN_TYPES.DASH:
        return this.requiredValue(token).charCodeAt(0);
      case TOKEN_TYPES.COMMA:
        return 44;
      case TOKEN_TYPES.DOLLAR:
        return 36;
      case TOKEN_TYPES.DOT:
        return 46;
      case TOKEN_TYPES.LBRACE:
        return 123;
      case TOKEN_TYPES.LBRACKET:
        return 91;
      case TOKEN_TYPES.LPAREN:
        return 40;
      case TOKEN_TYPES.PIPE:
        return 124;
      case TOKEN_TYPES.PLUS:
        return 43;
      case TOKEN_TYPES.QUESTION:
        return 63;
      case TOKEN_TYPES.RBRACE:
        return 125;
      case TOKEN_TYPES.RPAREN:
        return 41;
      case TOKEN_TYPES.STAR:
        return 42;
      default:
        throw new Error(
          `Unexpected token ${token.type} inside character set at position ${token.position}`,
        );
    }
  }
}

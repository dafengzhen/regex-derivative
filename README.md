# regex-derivative

[![GitHub License](https://img.shields.io/github/license/dafengzhen/regex-derivative?color=blue)](https://github.com/dafengzhen/regex-derivative)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/dafengzhen/regex-derivative/pulls)

[简体中文](./README.zh.md)

A regular expression engine based on **Brzozowski derivatives**. Supports standard regular expression syntax as well as union, intersection, and complement operators. Compiles regular expressions into deterministic finite automata (DFA) for efficient matching. Written entirely in TypeScript.

- Standard regex syntax: characters, `.`, `*`, `+`, `?`, `{}`, `[]`, `^`, `$`, `()`, `|`
- Extended operators:
  - Union `|`
  - Intersection `&`
  - Complement `!`
- Predefined character classes: `\d`, `\D`, `\w`, `\W`, `\s`, `\S`
- DFA construction based on derivatives (Brzozowski derivatives)
- Anchor support `^` and `$` (handled internally with special markers)
- Fast matching after DFA compilation
- Full TypeScript type definitions
- No dependencies

## Installation

```bash
npm install @dafengzhen/regex-derivative
```

## Quick Start

```ts
import { compile } from '@dafengzhen/regex-derivative';

const matcher = compile('[a-z]+@[a-z]+\\.[a-z]{2,}');
console.log(matcher.match('hello@example.com')); // true
console.log(matcher.match('invalid')); // false
```

Using extended operators (intersection, complement):

```ts
// Match characters that are both letters and vowels (intersection)
const vowelMatcher = compile('[a-z]&[aeiou]');
console.log(vowelMatcher.match('a')); // true
console.log(vowelMatcher.match('b')); // false

// Match non-digit characters (complement)
const nonDigitMatcher = compile('!\\d');
console.log(nonDigitMatcher.match('x')); // true
console.log(nonDigitMatcher.match('5')); // false
```

## API Reference

### Core Functions

#### compile(pattern: string): Matcher

Compiles a regular expression pattern and returns a Matcher object. Results are cached (LRU, max 128 entries). Repeated compilation of the same pattern returns the cached matcher.

```ts
import { compile } from '@dafengzhen/regex-derivative';

const matcher = compile('^hello world$');
```

#### clearCompileCache(): void

Clears the compilation cache.

### Classes

#### Lexer

Converts an input string into a stream of tokens.

```ts
import { Lexer } from '@dafengzhen/regex-derivative';

const lexer = new Lexer('[a-z]');
const tokens = lexer.tokenize();
```

#### Parser

Parses a token stream into an abstract syntax tree (Expr).

```ts
import { Parser } from '@dafengzhen/regex-derivative';

const parser = new Parser(tokens);
const expr = parser.parse();
```

#### Builder

Builds a DFA from an expression.

```ts
import { Builder } from '@dafengzhen/regex-derivative';

const builder = new Builder(expr);
const dfa = builder.build();
```

#### Matcher

Used to perform matching. Usually obtained via compile.

```ts
import { Matcher } from '@dafengzhen/regex-derivative';

interface Matcher {
  match(input: string): boolean;
}
```

### Type Exports

```ts
import type { Expr, Dfa, Token, CharRange, PredefinedClass } from '@dafengzhen/regex-derivative';
```

### How It Works

This engine builds a DFA based on **Brzozowski derivatives**. The core idea:

1. Parse the regular expression into an abstract syntax tree (`Expr`).
2. Compute the derivative of an expression with respect to a character using `derive(expr, char)` (the remaining language after consuming that character).
3. Assign a DFA state to the initial expression and to every reachable derivative.
4. Repeat until no new states are generated, resulting in a complete DFA transition table.
5. Matching simply simulates the DFA, running in O(n) time.

This approach naturally supports set operations such as union, intersection, and complement without requiring additional construction algorithms.

## Development and Testing

### Install Dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

## Contributing

Pull requests are welcome!

## License

[MIT](https://opensource.org/licenses/MIT)

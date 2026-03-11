## regex-derivative

[![GitHub License](https://img.shields.io/github/license/dafengzhen/regex-derivative?color=blue)](https://github.com/dafengzhen/regex-derivative)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/dafengzhen/regex-derivative/pulls)

[English](./README.md)

基于 **Brzozowski 导数** 的正则表达式引擎。支持标准正则语法，以及并集、交集、补集操作。通过将正则表达式转换为确定有限自动机（DFA）实现高效匹配。完全使用 TypeScript 编写。

- 标准正则语法：字符、`.`、`*`、`+`、`?`、`{}`、`[]`、`^`、`$`、`()`、`|`
- 扩展操作符：
  - 并集 `|`
  - 交集 `&`
  - 补集 `!`
- 预定义字符类：`\d`、`\D`、`\w`、`\W`、`\s`、`\S`
- 基于导数的 DFA 构建（Brzozowski 导数）
- 支持锚点 `^` 和 `$`（内部通过特殊标记处理）
- 编译后 DFA 快速匹配
- 完全 TypeScript 类型定义
- 无依赖

## 安装

```bash
npm install @dafengzhen/regex-derivative
```

## 快速开始

```ts
import { compile } from '@dafengzhen/regex-derivative';

const matcher = compile('[a-z]+@[a-z]+\\.[a-z]{2,}');
console.log(matcher.match('hello@example.com')); // true
console.log(matcher.match('invalid')); // false
```

使用扩展操作符（交集、补集）：

```ts
// 匹配既是字母又是元音的字符（交集）
const vowelMatcher = compile('[a-z]&[aeiou]');
console.log(vowelMatcher.match('a')); // true
console.log(vowelMatcher.match('b')); // false

// 匹配非数字字符（补集）
const nonDigitMatcher = compile('!\\d');
console.log(nonDigitMatcher.match('x')); // true
console.log(nonDigitMatcher.match('5')); // false
```

## API 参考

### 核心函数

#### compile(pattern: string): Matcher

编译正则表达式模式，返回一个 Matcher 对象。结果会被缓存（LRU，最多 128 条），重复编译相同模式将返回缓存中的匹配器。

```ts
import { compile } from '@dafengzhen/regex-derivative';

const matcher = compile('^hello world$');
```

#### clearCompileCache(): void

清空编译缓存。

### 类

#### Lexer

将输入字符串转换为 Token 流。

```ts
import { Lexer } from '@dafengzhen/regex-derivative';

const lexer = new Lexer('[a-z]');
const tokens = lexer.tokenize();
```

#### Parser

将 Token 流解析为抽象语法树（Expr）。

```ts
import { Parser } from '@dafengzhen/regex-derivative';

const parser = new Parser(tokens);
const expr = parser.parse();
```

#### Builder

基于表达式构建 DFA。

```ts
import { Builder } from '@dafengzhen/regex-derivative';

const builder = new Builder(expr);
const dfa = builder.build();
```

#### Matcher

用于执行匹配的类。通常通过 compile 获得。

```ts
import { Matcher } from '@dafengzhen/regex-derivative';

interface Matcher {
  match(input: string): boolean;
}
```

### 类型导出

```ts
import type { Expr, Dfa, Token, CharRange, PredefinedClass } from '@dafengzhen/regex-derivative';
```

### 工作原理

本引擎基于 Brzozowski **导数** 构建 DFA。核心思想：

1. 将正则表达式解析为抽象语法树（`Expr`）。
2. 通过 `derive(expr, char)` 计算表达式在某个字符下的导数（即剩余语言）。
3. 从初始表达式开始，对每个可达的导数表达式分配一个 DFA 状态。
4. 重复直到没有新状态产生，得到完整的 DFA 转移表。
5. 匹配时只需模拟 DFA 运行，时间复杂度 O(n)。

这种方法的优点是可以自然地支持并集、交集、补集等集合操作，无需额外的构造算法。

## 开发与测试

### 安装依赖

```bash
npm install
```

### 构建

```bash
npm run build
```

### 测试

```bash
npm test
```

## 贡献

欢迎贡献 PR！

## License

[MIT](https://opensource.org/licenses/MIT)

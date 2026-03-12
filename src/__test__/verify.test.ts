import { describe, expect, it } from '@jest/globals';

import { compile } from '../index.ts';

describe('Regular Expression Compiler Tests', () => {
  it('literal match', () => {
    const matcher = compile('abc');
    expect(matcher.match('abc')).toBe(true);
    expect(matcher.match('ab')).toBe(false);
    expect(matcher.match('abcd')).toBe(false);
  });

  it('dot matches any character', () => {
    const matcher = compile('a.c');
    expect(matcher.match('abc')).toBe(true);
    expect(matcher.match('a-c')).toBe(true);
    expect(matcher.match('ac')).toBe(false);
  });

  it('dot should not match internal markers', () => {
    const matcher = compile('^a');
    expect(matcher.match('a')).toBe(true);
    expect(matcher.match('')).toBe(false);
  });

  it('star matches zero or more', () => {
    const matcher = compile('a*b');
    expect(matcher.match('b')).toBe(true);
    expect(matcher.match('ab')).toBe(true);
    expect(matcher.match('aaab')).toBe(true);
    expect(matcher.match('a')).toBe(false);
  });

  it('union operation', () => {
    const matcher = compile('a|b');
    expect(matcher.match('a')).toBe(true);
    expect(matcher.match('b')).toBe(true);
    expect(matcher.match('c')).toBe(false);
  });

  it('intersection operation', () => {
    const matcher = compile('[a-z] & [aeiou]');
    expect(matcher.match('a')).toBe(true);
    expect(matcher.match('b')).toBe(false);
    expect(matcher.match('e')).toBe(true);
  });

  it('complement operation', () => {
    const matcher = compile('![0-9]');
    expect(matcher.match('a')).toBe(true);
    expect(matcher.match('5')).toBe(false);
  });

  it('repeat quantifiers', () => {
    const matcher = compile('a{3}');
    expect(matcher.match('aaa')).toBe(true);
    expect(matcher.match('aa')).toBe(false);

    const matcher2 = compile('a{2,4}');
    expect(matcher2.match('aa')).toBe(true);
    expect(matcher2.match('aaa')).toBe(true);
    expect(matcher2.match('aaaa')).toBe(true);
    expect(matcher2.match('a')).toBe(false);
    expect(matcher2.match('aaaaa')).toBe(false);

    const matcher3 = compile('a{10}');
    expect(matcher3.match('a'.repeat(10))).toBe(true);
    expect(matcher3.match('a'.repeat(9))).toBe(false);

    const matcher4 = compile('a{5,}');
    expect(matcher4.match('a'.repeat(5))).toBe(true);
    expect(matcher4.match('a'.repeat(10))).toBe(true);
    expect(matcher4.match('a'.repeat(4))).toBe(false);
  });

  it('anchor matching', () => {
    const matcher = compile('^hello$');
    expect(matcher.match('hello')).toBe(true);
    expect(matcher.match('hello world')).toBe(false);
    expect(matcher.match('say hello')).toBe(false);

    const matcher2 = compile('^$');
    expect(matcher2.match('')).toBe(true);
    expect(matcher2.match('a')).toBe(false);
  });

  it('character set with predefined class', () => {
    const matcher = compile('[\\d]');
    expect(matcher.match('5')).toBe(true);
    expect(matcher.match('a')).toBe(false);

    const matcher2 = compile('[\\dae]');
    expect(matcher2.match('5')).toBe(true);
    expect(matcher2.match('a')).toBe(true);
    expect(matcher2.match('e')).toBe(true);
    expect(matcher2.match('b')).toBe(false);
  });

  it('character set with escaped bracket', () => {
    const matcher = compile('[\\]]');
    expect(matcher.match(']')).toBe(true);
    expect(matcher.match('a')).toBe(false);
  });

  it('character set with range including hyphen', () => {
    const matcher = compile('[-abc]');
    expect(matcher.match('-')).toBe(true);
    expect(matcher.match('a')).toBe(true);
    expect(matcher.match('d')).toBe(false);

    const matcher2 = compile('[a-c]');
    expect(matcher2.match('a')).toBe(true);
    expect(matcher2.match('b')).toBe(true);
    expect(matcher2.match('c')).toBe(true);
    expect(matcher2.match('d')).toBe(false);
  });

  it('character set negation', () => {
    const matcher = compile('[^0-9]');
    expect(matcher.match('a')).toBe(true);
    expect(matcher.match('5')).toBe(false);
  });

  it('empty character set is not allowed', () => {
    expect(() => compile('[]')).toThrow(/Empty character set \[] is not allowed/);
  });

  it('complex intersection', () => {
    const matcher = compile('[0-9] & [02468]');
    expect(matcher.match('2')).toBe(true);
    expect(matcher.match('3')).toBe(false);
  });

  it('nested complement', () => {
    const matcher = compile('!!a');
    expect(matcher.match('a')).toBe(true);
    expect(matcher.match('b')).toBe(false);
  });

  it('empty group', () => {
    const matcher = compile('()');
    expect(matcher.match('')).toBe(true);
    expect(matcher.match('a')).toBe(false);
  });

  it('hyphen outside character set', () => {
    const matcher = compile('a-b');
    expect(matcher.match('a-b')).toBe(true);
    expect(matcher.match('ab')).toBe(false);
  });

  it('predefined classes outside character set', () => {
    const matcher = compile('\\d\\d');
    expect(matcher.match('42')).toBe(true);
    expect(matcher.match('4a')).toBe(false);

    const matcher2 = compile('\\D+');
    expect(matcher2.match('abc')).toBe(true);
    expect(matcher2.match('a1c')).toBe(false);
  });

  it('operator precedence', () => {
    const matcher = compile('[a-c] & [b-d]');
    expect(matcher.match('b')).toBe(true);
    expect(matcher.match('c')).toBe(true);
    expect(matcher.match('a')).toBe(false);
    expect(matcher.match('d')).toBe(false);
  });

  it('large repeat', () => {
    const matcher = compile('a{100}');
    expect(matcher.match('a'.repeat(100))).toBe(true);
    expect(matcher.match('a'.repeat(99))).toBe(false);
  });

  it('character set with only caret', () => {
    const matcher = compile('[^]');
    expect(matcher.match('a')).toBe(true);
    expect(matcher.match('5')).toBe(true);
    expect(matcher.match('')).toBe(false);
  });
});

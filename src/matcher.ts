import type { Dfa } from './types.ts';

import { ALPHABET_MAX_CODE, END_MARKER_CODE, START_MARKER_CODE } from './ast.ts';

export class Matcher {
  private readonly acceptTable: Uint8Array;

  private readonly hasEndAnchor: boolean;

  private readonly hasStartAnchor: boolean;

  private readonly initialState: number;

  private readonly transitionTable: readonly Int32Array[];

  constructor(dfa: Dfa, hasStartAnchor: boolean, hasEndAnchor: boolean) {
    this.initialState = dfa.initialState;
    this.acceptTable = dfa.acceptTable;
    this.transitionTable = dfa.transitionTable;
    this.hasStartAnchor = hasStartAnchor;
    this.hasEndAnchor = hasEndAnchor;
  }

  public match(input: string): boolean {
    const transitionTable = this.transitionTable;
    let stateId = this.initialState;

    if (this.hasStartAnchor) {
      stateId = transitionTable[stateId][START_MARKER_CODE];
      if (stateId < 0) {
        return false;
      }
    }

    for (let index = 0; index < input.length; index += 1) {
      const codePoint = input.charCodeAt(index);
      if (codePoint > ALPHABET_MAX_CODE) {
        return false;
      }

      stateId = transitionTable[stateId][codePoint];
      if (stateId < 0) {
        return false;
      }
    }

    if (this.hasEndAnchor) {
      stateId = transitionTable[stateId][END_MARKER_CODE];
      if (stateId < 0) {
        return false;
      }
    }

    return this.acceptTable[stateId] === 1;
  }
}

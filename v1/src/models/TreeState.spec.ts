import TreeState from './TreeState';
import sampleData from '../sampleData';
import { describe, expect, test } from 'vitest'

describe('TreeState.ts', ()=> {
  test('JsonString', () => {
    const state = new TreeState(sampleData.jsonStr);
    expect(state.tree).toBeDefined();
    expect(state.selected?.key).toBe('root');
    expect(state.selection).toEqual({});
    expect(state.history.items.length).toBe(1);

    state.select('invalidPath');
    expect(state.selected?.key).toBe('root');

    state.select('#/activityHistory/1');
    expect(state.selected?.key).toBe('1');
    expect(state.selection.start?.pos).toBe(339);
    expect(state.selection.end?.pos).toBe(582);
    expect(state.history.items.length).toBe(2);

    state.toggleMaxPane('table');
    expect(state.maxPane).toBe('table');
    state.toggleMaxPane('table');
    expect(state.maxPane).toBe('');
  });
})
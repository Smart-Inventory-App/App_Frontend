import { selectedFirst } from '../src/utils/selectedFirst';

describe('selectedFirst', () => {
  const options = ['a', 'b', 'c', 'd'];

  it('puts the selected item first and keeps the rest in their original order', () => {
    expect(selectedFirst(options, o => o === 'c')).toEqual(['c', 'a', 'b', 'd']);
  });

  it('goes back to the original order when nothing is selected', () => {
    expect(selectedFirst(options, () => false)).toEqual(options);
  });

  it('keeps several selected items together, in their original order, before the rest', () => {
    expect(selectedFirst(options, o => o === 'd' || o === 'b')).toEqual(['b', 'd', 'a', 'c']);
  });

  it('does not change the original list', () => {
    const copy = [...options];
    selectedFirst(copy, o => o === 'c');
    expect(copy).toEqual(options);
  });
});

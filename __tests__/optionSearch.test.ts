import { findSimilarOptions, sortAlphabetically } from '../src/utils/optionSearch';

describe('findSimilarOptions', () => {
  const options = ['Lácteos', 'Limpieza', 'Almacén', 'Bebidas', 'Lacteos light'];

  it('returns nothing for an empty query', () => {
    expect(findSimilarOptions('', options)).toEqual([]);
    expect(findSimilarOptions('   ', options)).toEqual([]);
  });

  it('matches by substring ignoring case', () => {
    expect(findSimilarOptions('BEB', options)).toEqual(['Bebidas']);
    expect(findSimilarOptions('ie', options)).toEqual(['Limpieza']);
  });

  it('ignores accents on both sides', () => {
    expect(findSimilarOptions('lacteos', options)).toEqual(['Lácteos', 'Lacteos light']);
    expect(findSimilarOptions('almacen', options)).toEqual(['Almacén']);
    expect(findSimilarOptions('lácteos', options)).toEqual(['Lácteos', 'Lacteos light']);
  });

  it('limits the number of results', () => {
    const many = Array.from({ length: 10 }, (_, i) => `Item ${i}`);
    expect(findSimilarOptions('item', many)).toHaveLength(5);
    expect(findSimilarOptions('item', many, 3)).toHaveLength(3);
  });

  it('returns nothing when no option matches', () => {
    expect(findSimilarOptions('zzz', options)).toEqual([]);
  });
});

describe('sortAlphabetically', () => {
  it('orders the options alphabetically, ignoring case and accents', () => {
    expect(sortAlphabetically(['limpieza', 'Lácteos', 'almacén', 'Bebidas', 'Álamo'])).toEqual(['Álamo', 'almacén', 'Bebidas', 'Lácteos', 'limpieza']);
  });

  it('does not change the original list', () => {
    const original = ['b', 'a'];
    sortAlphabetically(original);
    expect(original).toEqual(['b', 'a']);
  });

  it('keeps a stable order for options that only differ in case or accents', () => {
    expect(sortAlphabetically(['cafe', 'Café', 'CAFE'])).toEqual(sortAlphabetically(['CAFE', 'Café', 'cafe']));
  });

  it('handles an empty list', () => {
    expect(sortAlphabetically([])).toEqual([]);
  });
});

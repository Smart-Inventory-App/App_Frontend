import { findSimilarOptions } from '../src/utils/optionSearch';

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

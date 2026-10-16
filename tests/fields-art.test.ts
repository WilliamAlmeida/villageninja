// Arte dos campos cercados (scripts/field-art.py → src/art/fields): uma folha por cultura, mais o chão e a cerca.
import { describe, expect, test } from 'bun:test';
import { CROP_LIST } from '../src/data/crops';
import { artUrl } from '../src/render/art';

describe('arte dos campos cercados', () => {
  test('toda cultura tem a sua folha registrada em render/art.ts, e o chão e a cerca também', () => {
    for (const c of CROP_LIST) expect(artUrl(`crop-${c.id}`), c.id).not.toBeNull();
    expect(artUrl('field-soil')).not.toBeNull();
    expect(artUrl('field-fence')).not.toBeNull();
  });
});

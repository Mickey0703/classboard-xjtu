import { expect, it } from 'vitest';
import { parseRoster } from './roster';

it('reads spreadsheet headers, tab-separated names, and normalized emails', () => {
  expect(parseRoster('\uFEFF姓名\t邮箱\r\n张三\t A@EXAMPLE.COM \r\n李四\tb@example.com')).toEqual([
    { displayName: '张三', email: 'a@example.com' }, { displayName: '李四', email: 'b@example.com' }
  ]);
});
it('reads quoted CSV and refuses duplicates or invalid rows rather than partially importing', () => {
  expect(parseRoster('"张,三",a@example.com')).toEqual([{ displayName: '张,三', email: 'a@example.com' }]);
  expect(() => parseRoster('张三,a@example.com\n李四,A@example.com')).toThrow(/重复/);
  expect(() => parseRoster('张三,a@example.com\n李四,wrong')).toThrow(/第 2 行/);
});

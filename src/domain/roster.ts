export interface RosterEntry { displayName: string; email: string }

export function validateRoster(value: unknown): RosterEntry[] {
  if (!Array.isArray(value) || !value.length || value.length > 500) throw Error('请提供 1 至 500 位成员');
  const seen = new Set<string>();
  return value.map((entry: unknown, index) => {
    const row = entry as Partial<RosterEntry> | null;
    const name = typeof row?.displayName === 'string' ? row.displayName.trim() : '';
    const email = typeof row?.email === 'string' ? row.email.trim().toLowerCase() : '';
    if (!name || name.length > 80 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error(`第 ${index + 1} 行姓名或邮箱无效`);
    if (seen.has(email)) throw Error(`第 ${index + 1} 行邮箱重复：${email}`);
    seen.add(email);
    return { displayName: name, email };
  });
}

export function parseRoster(text: string): RosterEntry[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  const rows = lines.map((line, index) => {
    const delimiter = line.includes('\t') ? '\t' : ',';
    const cells: string[] = [];
    let cell = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (quoted && line[i + 1] === '"') { cell += '"'; i++; }
        else quoted = !quoted;
      } else if (char === delimiter && !quoted) { cells.push(cell.trim()); cell = ''; }
      else cell += char;
    }
    if (quoted) throw Error(`第 ${index + 1} 行引号未闭合`);
    cells.push(cell.trim());
    if (cells.length !== 2) throw Error(`第 ${index + 1} 行需要姓名和邮箱两列`);
    return { displayName: cells[0], email: cells[1] };
  });
  if (rows[0] && /^(姓名|同学姓名|displayName|name)$/i.test(rows[0].displayName) && /^(邮箱|邮箱地址|email)$/i.test(rows[0].email)) rows.shift();
  return validateRoster(rows);
}

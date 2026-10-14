import { expect, test } from '@playwright/test';

test('a stable calendar URL reflects new events, edits, completion and deletion', async ({ page, request }) => {
  await page.context().addCookies([{ name: 'local_admin', value: 'test-token', domain: '127.0.0.1', path: '/' }]);
  const event = { title: `日历同步测试 ${Date.now()}`, description: '班级🎓集合，检查中文内容。', category: '班级', startAt: '2099-10-20T18:00:00+08:00', dueAt: '2099-10-20T19:00:00+08:00', done: false };
  const created = await page.request.post('/api/admin/events', { data: event });
  expect(created.status()).toBe(200);
  const { id } = await created.json() as { id: string };
  const unfold = (value: string) => value.replace(/\r\n /g, '');
  const feed = async () => {
    const response = await request.get('/api/calendar.ics');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('text/calendar; charset=utf-8');
    expect(response.headers()['cache-control']).toBe('no-store');
    return unfold(await response.text());
  };
  try {
    const initial = await feed();
    expect(initial).toContain(event.title);
    expect(initial).toContain('DTSTART:20991020T100000Z\r\nDTEND:20991020T110000Z');
    const uid = initial.match(new RegExp(`UID:${id}@[^\r]+`))?.[0];
    expect(uid).toBeTruthy();
    await page.goto('/?view=schedule');
    const card = page.getByRole('heading', { name: event.title }).locator('..').locator('..');
    await card.getByRole('button', { name: '添加到日历' }).click();
    const dialog = page.getByRole('dialog', { name: '添加到日历' });
    const download = page.waitForEvent('download');
    await dialog.getByRole('link', { name: '下载日历文件' }).click();
    expect((await download).suggestedFilename()).toBe(event.title + '.ics');
    await dialog.getByRole('button', { name: '关闭窗口' }).click();
    const edited = { ...event, id, title: event.title + '（已更新）', dueAt: '2099-10-20T20:00:00+08:00' };
    expect((await page.request.put('/api/admin/events', { data: edited })).status()).toBe(200);
    const updated = await feed();
    expect(updated).toContain(edited.title);
    expect(updated).toContain(uid!);
    expect(updated).toContain('DTEND:20991020T120000Z');
    expect((await page.request.put('/api/admin/events', { data: { ...edited, done: true } })).status()).toBe(200);
    expect(await feed()).not.toContain(uid!);
    const single = await request.get('/api/calendar.ics?event=' + encodeURIComponent(id));
    expect(single.status()).toBe(200);
    expect(unfold(await single.text())).toContain(edited.title);
    expect((await page.request.delete('/api/admin/events', { data: { id } })).status()).toBe(200);
    const removed = await request.get('/api/calendar.ics?event=' + encodeURIComponent(id));
    expect(removed.status()).toBe(200);
    expect(await removed.text()).not.toContain('BEGIN:VEVENT');
    expect((await request.get('/api/calendar.ics?event=' + encodeURIComponent(id) + '&download=1')).status()).toBe(404);
  } finally {
    await page.request.delete('/api/admin/events', { data: { id } });
  }
});

test('subscription instructions fit small phones in light and dark themes and restore focus', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?view=schedule');
  const button = page.getByRole('button', { name: '订阅班级日程' });
  await button.click();
  const dialog = page.getByRole('dialog', { name: '订阅班级日程' });
  await expect(dialog.getByRole('link', { name: '订阅班级日程' })).toHaveAttribute('href', /^webcal:.*\/api\/calendar\.ics$/);
  expect(await dialog.getByLabel('订阅地址').inputValue()).toBe(new URL('/api/calendar.ics', page.url()).href);
  await dialog.getByLabel('选择手机系统').selectOption('ios');
  await expect(dialog.getByText(/添加订阅日历/)).toBeVisible();
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/calendar-subscription-mobile.png', fullPage: true });
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await page.screenshot({ path: 'test-results/calendar-subscription-dark.png', fullPage: true });
  await page.setViewportSize({ width: 812, height: 375 });
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(button).toBeFocused();
});

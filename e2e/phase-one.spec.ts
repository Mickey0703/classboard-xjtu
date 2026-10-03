import { expect, test } from '@playwright/test';

test('public mobile navigation focuses on today, schedule and notifications', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByText('ID 2601 班务').first()).toBeVisible();
  await expect(page.getByRole('link', { name: '查看 ID 2601 完整班徽' })).toHaveAttribute('href', '/class-emblem.png');
  expect((await request.get('/class-emblem.png')).status()).toBe(200);
  const nav = page.getByRole('navigation', { name: '主导航' });
  await expect(nav.getByRole('button')).toHaveCount(3);
  await expect(nav.getByRole('button')).toHaveText(['今日', '通知', '日程']);
  await expect(page.getByRole('region', { name: '添加到主屏幕' })).toBeVisible();
  await expect(nav.getByRole('button', { name: '课表' })).toHaveCount(0);
  await expect(page.getByText(/下一节|今日时间轴/)).toHaveCount(0);
  await page.screenshot({ path: 'test-results/home-mobile.png', fullPage: true });
  await nav.getByRole('button', { name: '日程' }).click();
  await expect(page.getByRole('heading', { name: '班级日程' })).toBeVisible();
  await expect(page.getByRole('region', { name: '添加到主屏幕' })).toHaveCount(0);
  await nav.getByRole('button', { name: '通知' }).click();
  await expect(page.getByRole('heading', { name: '班级通知' })).toBeVisible();
  await expect(page.getByRole('region', { name: '添加到主屏幕' })).toHaveCount(0);
});

test('the committee can save a class matter while visitors cannot write', async ({ page, request }) => {
  const title = `班级事项（测试 ${Date.now()}）`;
  expect((await request.post('/api/admin/events', { data: { title } })).status()).toBe(403);
  await page.context().addCookies([{ name: 'local_admin', value: 'test-token', domain: '127.0.0.1', path: '/' }]);
  await page.goto('/?view=admin');
  await expect(page.getByRole('region', { name: '添加到主屏幕' })).toHaveCount(0);
  await expect(page.getByText(/monitor@stu.xjtu.edu.cn/)).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: '日程', exact: true }).click();
  await page.getByLabel('事项标题').fill(title);
  await page.getByLabel('开始时间').fill('2026-09-29T18:00');
  await page.getByLabel('截止时间', { exact: true }).fill('2026-09-29T19:00');
  await page.getByRole('button', { name: '保存事项' }).click();
  await expect(page.getByText('保存事项成功')).toBeVisible();
  await page.reload();
  await page.getByRole('main').getByRole('button', { name: '日程', exact: true }).click();
  await expect(page.getByText(title)).toBeVisible();
  const snapshot = await (await request.get('/api/snapshot')).json() as { events: { id: string; title: string }[] };
  const created = snapshot.events.find(item => item.title === title);
  expect(created).toBeTruthy();
  expect((await page.request.delete('/api/admin/events', { data: { id: created!.id } })).status()).toBe(200);
});

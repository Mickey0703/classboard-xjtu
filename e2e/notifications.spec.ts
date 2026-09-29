import { expect, test } from '@playwright/test';

test('committee publishes a task; a roster member confirms it; committee sees delivery stats', async ({ page, request }) => {
  const title = `班级待办（测试 ${Date.now()}）`;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '通知', exact: true }).click();
  await expect(page.getByText('班级会议地点调整（演示）')).toBeVisible();
  await expect(page.getByText('使用班级邮箱登录')).toBeVisible();
  await page.screenshot({ path: 'test-results/notifications-mobile.png', fullPage: true });
  expect((await request.get('/api/member/session')).status()).toBe(403);

  await page.context().addCookies([{ name: 'local_admin', value: 'test-token', domain: '127.0.0.1', path: '/' }]);
  await page.goto('/?view=admin');
  await expect(page.getByText(/monitor@stu.xjtu.edu.cn/)).toBeVisible();
  await page.getByLabel('通知标题').fill(title);
  await page.getByLabel('通知正文').fill('请在截止时间前提交，并确认已知悉。');
  await page.getByLabel('类型').selectOption('task');
  await page.getByLabel('截止时间', { exact: true }).fill('2026-10-05T18:00');
  await page.getByRole('button', { name: '保存草稿' }).click();
  const adminRow = page.locator('.admin-notice-row').filter({ hasText: title });
  await expect(adminRow).toBeVisible();
  const beforePublish = await (await request.get('/api/snapshot')).json() as { notifications: { title: string }[] };
  expect(beforePublish.notifications.some(item => item.title === title)).toBe(false);
  await adminRow.getByRole('button', { name: '发布通知' }).click();
  await expect(adminRow.getByText('已发布')).toBeVisible();
  await expect(page.getByText(/已知悉 0\/2/)).toBeVisible();

  await page.context().addCookies([{ name: 'local_member', value: 'member-test', domain: '127.0.0.1', path: '/' }]);
  await page.goto('/?view=notifications');
  await expect(page.getByText(/演示同学甲/)).toBeVisible();
  const card = page.locator('.notice-card').filter({ hasText: title });
  await card.getByRole('button', { name: '标记已完成' }).click();
  await expect(card.getByRole('button', { name: '撤销完成' })).toBeVisible();

  await page.goto('/?view=admin');
  await expect(page.getByText(/monitor@stu.xjtu.edu.cn/)).toBeVisible();
  await page.locator('.admin-notice-row').filter({ hasText: title }).getByRole('button', { name: '查看统计' }).click();
  await expect(page.getByText(/已知悉 1\/2/)).toBeVisible();
  await expect(page.getByText(/已完成 1\/2/)).toBeVisible();
  await page.screenshot({ path: 'test-results/notification-stats-mobile.png', fullPage: true });
  await page.locator('.admin-notice-row').filter({ hasText: title }).getByRole('button', { name: '撤回' }).click();
  await expect(page.locator('.admin-notice-row').filter({ hasText: title }).getByText('已撤回')).toBeVisible();
  const publicSnapshot = await (await request.get('/api/snapshot')).json() as { notifications: { title: string }[] };
  expect(publicSnapshot.notifications.some(item => item.title === title)).toBe(false);
});

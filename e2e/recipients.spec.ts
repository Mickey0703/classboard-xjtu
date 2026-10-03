import { expect, test } from '@playwright/test';

test('imports a roster file and publishes only to the selected member on mobile', async ({ page }) => {
  await page.context().addCookies([{ name: 'local_admin', value: 'test-token', domain: '127.0.0.1', path: '/' }]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?view=admin');
  await page.getByRole('button', { name: '成员', exact: true }).click();
  await page.getByLabel('选择名单文件').setInputFiles({ name: 'roster.csv', mimeType: 'text/csv', buffer: Buffer.from('姓名,邮箱\n演示同学甲,student@example.com\n演示同学乙,classmate@example.com', 'utf8') });
  await expect(page.getByText('待导入 2 人')).toBeVisible();
  await page.getByRole('button', { name: '导入名单', exact: true }).click();
  await expect(page.getByText('已导入 2 位成员')).toBeVisible();
  await page.screenshot({ path: 'test-results/roster-import-mobile.png', fullPage: true });

  await page.getByRole('main').getByRole('button', { name: '通知', exact: true }).click();
  await expect(page.getByText('已选 2 / 2 人')).toBeVisible();
  await page.getByRole('button', { name: '清空', exact: true }).click();
  await page.locator('.recipient-picker summary').click();
  await page.getByLabel('搜索姓名或邮箱').fill('演示同学甲');
  await page.getByLabel('演示同学甲student@example.com').check();
  await expect(page.getByText('已选 1 / 2 人')).toBeVisible();
  const title = `指定收件人 ${Date.now()}`;
  await page.getByLabel('通知标题').fill(title);
  await page.getByLabel('通知正文').fill('仅指定同学计入知悉统计。');
  await page.screenshot({ path: 'test-results/recipient-picker-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: '保存草稿' }).click();
  const row = page.locator('.admin-notice-row').filter({ hasText: title });
  await expect(row.getByText('收件人：1 人')).toBeVisible();
  await page.reload();
  await row.getByRole('button', { name: '编辑' }).click();
  await expect(page.getByText('已选 1 / 2 人')).toBeVisible();
  await page.getByRole('button', { name: '取消编辑' }).click();
  await row.getByRole('button', { name: '发布通知' }).click();
  await expect(page.getByText('已知悉 0/1')).toBeVisible();

  await page.context().addCookies([{ name: 'local_member', value: 'member-test', domain: '127.0.0.1', path: '/' }]);
  await page.goto('/?view=notifications');
  const card = page.locator('.notice-card').filter({ hasText: title });
  await card.getByRole('button', { name: '确认已知悉', exact: true }).click();
  await expect(card.getByText('已知悉', { exact: true })).toBeVisible();
  await page.goto('/?view=admin');
  await row.getByRole('button', { name: '查看统计' }).click();
  await expect(page.getByText('已知悉 1/1')).toBeVisible();
  await row.getByRole('button', { name: '撤回' }).click();
});

import { expect, test } from '@playwright/test';

test('public pages work on phone and course week changes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByText('西交班务').first()).toBeVisible();
  await expect(page.getByText(/演示数据/).first()).toBeVisible();
  await page.screenshot({ path: 'test-results/home-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: 'test-results/home-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '课表', exact: true }).click();
  const currentLabel = await page.getByText(/第 \d+ 周/).first().textContent();
  const currentWeek = Number(currentLabel?.match(/第 (\d+) 周/)?.[1]);
  expect(currentWeek).toBeGreaterThan(0);
  await page.getByRole('button', { name: '下周' }).click();
  await expect(page.getByText(`第 ${currentWeek + 1} 周`).first()).toBeVisible();
  await page.getByRole('button', { name: '日程', exact: true }).click();
  await expect(page.getByRole('heading', { name: '班级日程' })).toBeVisible();
});

test('the local admin can save a course and visitors cannot write without a valid session', async ({ page, request }) => {
  const courseName = `线性代数（测试 ${Date.now()}）`;
  const bad = await request.post('/api/admin/courses', { data: { title: '恶意写入' }, headers: { Origin: 'https://another.example' } });
  expect(bad.status()).toBe(403);
  expect((await request.get('/api/admin/session')).status()).toBe(403);
  await page.context().addCookies([{ name: 'local_admin', value: 'test-token', domain: '127.0.0.1', path: '/' }]);
  await page.goto('/');
  await page.getByRole('button', { name: '班委管理' }).click();
  await expect(page.getByText(/monitor@stu.xjtu.edu.cn/)).toBeVisible();
  await page.getByLabel('课程名称').fill(courseName);
  await page.getByRole('button', { name: '保存课程' }).click();
  await expect(page.getByText('保存课程成功')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '班委管理' }).click();
  await expect(page.getByText(courseName)).toBeVisible();
  const snapshot = await (await request.get('/api/snapshot')).json() as { courses: { id: string; title: string }[] };
  const created = snapshot.courses.find(item => item.title === courseName);
  expect(created).toBeTruthy();
  const removed = await page.request.delete('/api/admin/courses', { data: { id: created!.id } });
  expect(removed.status()).toBe(200);
});

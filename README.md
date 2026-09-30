# 西交班务

ID 2601 班务看板。访客可查看首页、班级日程和通知；班委经 Cloudflare Access 登录后维护成员、发布通知和添加事项。名单内同学用邮箱一次性验证码登录后，可确认“已知悉”，并对待办标记“已完成”。论坛和课表不在当前网站中。`db/demo.sql` 与 `db/demo-notifications.sql` 仅含演示数据。

班徽原件保存在根目录 `class-emblem.png`，网站使用 `public/class-emblem.png`。顶部显示中心图形的方形裁切；首页标识条可打开完整原图。

## 本地运行

需要 Node.js 20 及以上。

```powershell
npm install
npm run build
npm run db:init
npm run db:notifications
npm run db:notification-guards
npm run db:demo
npm run db:notification-demo
npm run preview
```

浏览 `http://127.0.0.1:8788`。普通 `preview` 不启用身份模拟，因此写入会返回 403。自动化测试使用 `preview:e2e`，只在 localhost 且有测试令牌 Cookie 时模拟班委或学生身份；不要用于对外服务。

```powershell
npm test
npm run test:e2e
```

首次运行浏览器测试时，可把 Playwright 浏览器安装到项目目录：

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = (Resolve-Path '.').Path + '\.playwright-browsers'
npx playwright install chromium --only-shell
```

## 日程与通知

班委在管理页维护班级名称与日程事项。通知分为“公告”和“待办”：公告可确认知悉；待办可确认知悉、标记完成或撤销完成。班委发布时固定当时的活跃成员为收件人，后续名单变化不改变统计分母。公开阅读不自动计入知悉。发布后正文不能直接修改，需要更正时撤回并重发。发布通知不会主动群发邮件。

正式使用前需要班级成员姓名与邮箱名单。通知正文公开可读，避免填写学号、联系方式等个人资料；成员名单和逐人确认结果只对班委开放。

## Cloudflare 部署

1. 创建 D1 数据库，将真实 `database_id` 写入 `wrangler.toml`。仓库中的全零 ID 仅供本地占位。
2. 依次运行 `npx wrangler d1 execute DB --remote --file=db/schema.sql`、`npx wrangler d1 execute DB --remote --file=db/migrations/002_notifications.sql` 和 `npx wrangler d1 execute DB --remote --file=db/migrations/003_publish_recipients_trigger.sql`。生产库不要运行演示脚本。旧本地数据库若有课程表，网站不会查询或展示它们；本次不删除既有数据。
3. 创建 Pages 项目并连接仓库，构建命令 `npm run build`，输出目录 `dist`，将 D1 绑定名设为 `DB`。
4. 为 `/api/admin/*` 配置班委 Access 应用，设置 `ACCESS_DOMAIN`、`ACCESS_AUD` 和逗号分隔的 `ADMIN_EMAILS`。
5. 为 `/api/member/*` 配置另一 Access 应用，启用 [One-time PIN 邮箱登录](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)，策略只允许班级成员邮箱，并把其 Audience Tag 配为 `MEMBER_ACCESS_AUD`。网站中的成员名单也需与 Access 允许名单同步。
6. 发布后核对公开通知可读、匿名写入被拒、名单内同学可确认通知且班委统计更新。

`LOCAL_DEV_MODE`、`LOCAL_DEV_ADMIN_EMAIL`、`LOCAL_DEV_TOKEN`、`LOCAL_DEV_MEMBER_EMAIL` 和 `LOCAL_DEV_MEMBER_TOKEN` 只用于本地自动化测试，不配置到生产环境。

Cloudflare Pages、Functions、D1 和 Access 当前都有免费计划或额度；Access 免费计划面向少于 50 位用户。上线前请核对账户价格及限额。天气数据来自 [Open-Meteo](https://open-meteo.com/)（CC BY 4.0），本网站将天气代码转为中文描述。免费接口限非商业使用，须遵守其[条款](https://open-meteo.com/en/terms)。

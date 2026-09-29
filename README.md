# 西交班务

西安交通大学班务看板。访客可查看首页、课表、日程和通知；班委通过 Cloudflare Access 登录后可编辑。名单内同学可以通过邮箱一次性验证码登录，确认通知已知悉及待办已完成。论坛未加入。`db/demo.sql` 和 `db/demo-notifications.sql` **只含演示数据**。

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

浏览 `http://127.0.0.1:8788`。普通 `preview` 不启用身份模拟，因此写入会返回 403。自动化测试单独使用 `preview:e2e`，它只在 localhost 且提供测试令牌 Cookie 时模拟班委或学生身份；不要把该命令用于对外服务。

```powershell
npm test
npm run test:e2e
```

首次运行浏览器测试时，可把 Playwright 浏览器安装到项目目录：

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = (Resolve-Path '.').Path + '\.playwright-browsers'
npx playwright install chromium --only-shell
```

## 录入本班资料

请准备班级名称、学期起止日期、每天的节次和时间、课程名称与教室、起止周和单双周规则、近期事项，以及班级成员姓名和邮箱。班委登录后在“班委管理”页逐条维护。正式数据库运行 `db/schema.sql`、`db/migrations/002_notifications.sql` 和 `db/migrations/003_publish_recipients_trigger.sql`，**不要运行任何演示脚本**。通知正文公开可读，不要写入学号、联系方式等个人资料；成员名单和逐人确认情况仅班委可见。

通知有“公告”和“待办”两种。公告可确认已知悉；待办可确认已知悉、标记已完成或撤销完成。班委发布时固定当时的活跃成员为收件人，后续名单变化不会改变这条通知的统计分母。发布后正文不能直接修改；需要更正时撤回并发布新通知。公开阅读不自动计入知悉。发布通知**不会主动发送提醒邮件**。

学期第一周从开学日期所在周的周一计算。课程时间采用 Asia/Shanghai，周次、今日课程、下一节课与日历导出共用同一套计算规则。日程的“即将截止”指距离截止不超过 24 小时。

## Cloudflare 部署

1. 在 Cloudflare 创建 D1 数据库，名称建议 `classboard-xjtu`。把返回的真实 `database_id` 写入 `wrangler.toml`。仓库中的全零 ID 只供本地开发占位。
2. 依次运行 `npx wrangler d1 execute DB --remote --file=db/schema.sql`、`npx wrangler d1 execute DB --remote --file=db/migrations/002_notifications.sql`、`npx wrangler d1 execute DB --remote --file=db/migrations/003_publish_recipients_trigger.sql` 建表与发布触发器。不要在生产数据库运行演示数据脚本。
3. 创建 Pages 项目并连接此 Git 仓库：构建命令 `npm run build`，输出目录 `dist`。确保 D1 数据库以 `DB` 名称绑定到 Pages Functions。
4. 为 `/api/admin/*` 配置班委 Cloudflare Access 应用，允许班委邮箱登录。将 `ACCESS_DOMAIN`（例如 `https://your-team.cloudflareaccess.com`）、`ACCESS_AUD`（班委应用的 Audience Tag）及 `ADMIN_EMAILS`（逗号分隔的班委邮箱）配置为 Pages Functions 的生产环境变量。
5. 为 `/api/member/*` 配置另一 Access 应用，启用 [One-time PIN 邮箱登录](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)，策略只允许班级成员邮箱，并将该应用 Audience Tag 配为 `MEMBER_ACCESS_AUD`。班委在网站中维护 D1 成员名单时，也要同步 Access 允许名单。服务端会再次查 D1 名单，非成员即使取得 Access 会话也不能确认通知。
6. 发布后核对：公开 `/api/snapshot` 可读；匿名和非成员写入被拒；班委发布一条通知后学生可用邮箱验证码登录确认，统计人数同步更新。

`LOCAL_DEV_MODE`、`LOCAL_DEV_ADMIN_EMAIL`、`LOCAL_DEV_TOKEN`、`LOCAL_DEV_MEMBER_EMAIL` 和 `LOCAL_DEV_MEMBER_TOKEN` 仅用于本地自动化测试，不应配置到生产环境。即使误配，本地模拟也要求请求域名是 `localhost` 或 `127.0.0.1`，且带有匹配令牌的 Cookie。

Cloudflare Pages、Functions、D1 及 Access 当前都有免费计划或额度；Access 免费计划面向少于 50 位用户。超额或使用自购域名可能产生额外成本。Cloudflare Zero Trust 免费计划开通时可能要求付款资料，即使该计划不收费。上线前请在账户中核对当前价格及限额。

天气数据来自 [Open-Meteo](https://open-meteo.com/)（CC BY 4.0）；页面把天气代码转换为中文描述。免费接口限非商业使用，使用量须遵守其[条款](https://open-meteo.com/en/terms)。

## 已实现范围

- 红色顶部的响应式首页、今日课程与下一节课、近期事项及西安实时天气。
- 每周课表、单双周规则、周次切换与 `.ics` 导出。
- 日程类别、截止日期、未完成筛选及截止状态。
- 班委课程、事项和学期设置编辑；D1 统一存储。
- 公开通知页、首页重要通知、班委发布与成员维护、学生邮箱验证码登录后的知悉/完成回执，以及班委逐人统计。

论坛不在本阶段。网站尚未连接任何真实班级资料或发布到 Cloudflare。

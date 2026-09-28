# 西交班务（第一阶段）

西安交通大学班级课表与日程看板。访客可查看首页、课表和日程；班委通过 Cloudflare Access 登录后可编辑。当前仓库的 `db/demo.sql` **只含演示数据**，不是任何真实班级的课表。

## 本地运行

需要 Node.js 20 及以上。

```powershell
npm install
npm run build
npm run db:init
npm run db:demo
npm run preview
```

浏览 `http://127.0.0.1:8788`。普通 `preview` 不启用班委身份模拟，因此管理写入会返回 403。自动化测试单独使用 `preview:e2e`，它只在 localhost 且显式配置测试身份时绕过 Cloudflare Access；不要把该命令用于对外服务。

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

请准备班级名称、学期起止日期、每天的节次和时间、课程名称与教室、起止周和单双周规则，以及近期事项。班委登录后在“班委管理”页逐条维护。正式数据库只运行 `db/schema.sql`，**不要运行 `db/demo.sql`**。不要公开录入学号、联系方式等个人资料。

学期第一周从开学日期所在周的周一计算。课程时间采用 Asia/Shanghai，周次、今日课程、下一节课与日历导出共用同一套计算规则。日程的“即将截止”指距离截止不超过 24 小时。

## Cloudflare 部署

1. 在 Cloudflare 创建 D1 数据库，名称建议 `classboard-xjtu`。把返回的真实 `database_id` 写入 `wrangler.toml`。仓库中的全零 ID 只供本地开发占位。
2. 运行 `npx wrangler d1 execute DB --remote --file=db/schema.sql` 建表。不要在生产数据库运行演示数据脚本。
3. 创建 Pages 项目并连接此 Git 仓库：构建命令 `npm run build`，输出目录 `dist`。确保 D1 数据库以 `DB` 名称绑定到 Pages Functions。
4. 为 `/api/admin/*` 配置 Cloudflare Access 应用，允许班委邮箱登录。将 `ACCESS_DOMAIN`（例如 `https://your-team.cloudflareaccess.com`）、`ACCESS_AUD`（该 Access 应用的 Audience Tag）及 `ADMIN_EMAILS`（逗号分隔的班委邮箱）配置为 Pages Functions 的生产环境变量。管理接口还会验证 Access 签发的令牌与邮箱白名单。
5. 发布后先核对：公开 `/api/snapshot` 可读；未登录写入 `/api/admin/courses` 被拒；班委登录后可保存课程并在公开课表看到更新。

`LOCAL_DEV_MODE` 和 `LOCAL_DEV_ADMIN_EMAIL` 仅用于本地自动化测试，不应配置到生产环境。即使误配，本地绕过也要求请求域名是 `localhost` 或 `127.0.0.1`。

Cloudflare Pages、Functions、D1 及 Access 当前都有免费计划或额度；超额或使用自购域名可能产生额外成本。Cloudflare Zero Trust 免费计划开通时可能要求付款资料，即使该计划不收费。上线前请在账户中核对当前价格及限额。

天气数据来自 [Open-Meteo](https://open-meteo.com/)（CC BY 4.0）；页面把天气代码转换为中文描述。免费接口限非商业使用，使用量须遵守其[条款](https://open-meteo.com/en/terms)。

## 已实现范围

- 红色顶部的响应式首页、今日课程与下一节课、近期事项及西安实时天气。
- 每周课表、单双周规则、周次切换与 `.ics` 导出。
- 日程类别、截止日期、未完成筛选及截止状态。
- 班委课程、事项和学期设置编辑；D1 统一存储。

论坛与通知不在第一阶段。网站尚未连接任何真实班级资料或发布到 Cloudflare。

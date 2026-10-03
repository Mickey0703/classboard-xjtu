# 西交班务

ID 2601 班务看板。访客可查看首页、班级日程和通知；班委经 Cloudflare Access 登录后维护成员、发布通知和添加事项。名单内同学用邮箱一次性验证码登录后，可确认“已知悉”，并对待办标记“已完成”。论坛和课表不在当前网站中。`db/demo.sql` 与 `db/demo-notifications.sql` 仅含演示数据。

班徽原件保存在根目录 `class-emblem.png`，网站使用 `public/class-emblem.png`。网页中的 `ClassEmblem` 组件通过 SVG 滤镜将原藏蓝底转为透明，以当前文字颜色显示主体：红色顶部和首页横幅为白色，浅色区域默认藏蓝色。首页标识条可打开完整原图；iOS 桌面图标仍使用不透明正方形班徽。

iOS 添加到主屏幕使用 `public/apple-touch-icon.png`（180 × 180、不透明正方形班徽）；`public/site.webmanifest` 提供网页 App 名称及 192 / 512 像素图标。更新图标后，已添加的旧图标可能需要移除，再从 Safari 添加到主屏幕。

展示标题使用自托管 Noto Serif SC 衬线字体子集，正文与操作控件保持系统无衬线字体。字形范围与开源许可见 `public/fonts/README.md`；新增固定展示标题时需同步更新字形子集。

辅助文字最小字号为 12 px，常读说明与正文为 13–15 px。大号通知计数、日期与温度数字使用同款衬线字体，并包含完整数字、负号和小数点字形。

## 本地运行

本地开发与完整测试使用 Node.js 24 及以上（收件人数据库集成测试使用内置 `node:sqlite`）。

```powershell
npm install
npm run build
npm run db:init
npm run db:notifications
npm run db:notification-guards
npm run db:recipient-selection
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

班委在管理页维护班级名称与日程事项。通知分为“公告”和“待办”：公告可确认知悉；待办可确认知悉、标记完成或撤销完成。撰写通知时可通过下拉列表按姓名或邮箱搜索并勾选收件人，也可点击“全选”或“清空”。新通知默认选择全部活跃成员，草稿会保存所选人员；发布时固定收件人，后续名单变化不改变统计分母。旧草稿未保存收件人时，仍在发布时选择全部活跃成员。若所选成员已停用，需编辑草稿重新选择后再发布。公开阅读不自动计入知悉，正文仍公开展示。发布后正文不能直接修改，需要更正时撤回并重发。发布通知不会主动群发邮件。

正式使用前需要班级成员姓名与邮箱名单。通知正文公开可读，避免填写学号、联系方式等个人资料；成员名单和逐人确认结果只对班委开放。

### 批量导入成员

在班委管理的“成员”页选择 UTF-8 编码的 CSV / TSV 文件，或从 Excel 复制“姓名、邮箱”两列粘贴到“批量名单”。可参考 `db/roster.example.csv`，将真实名单保存在自己的本地文件中。页面显示待导入人数，点击“导入名单”后写入 Cloudflare D1。名单最多 500 人，文件最多 1 MB；姓名不能为空，邮箱必须有效且同一次导入不能重复。前后端均校验完整名单，错误名单不会部分写入。

同一邮箱再次导入会更新姓名并启用该成员，其他已有成员保留。D1 名单与 Cloudflare Access 允许名单需分别维护：导入 D1 不会自动修改 Access 策略。真实名单不要放在 `public/` 或提交到公开仓库。

已有网站升级时，先对 D1 执行一次 `npx wrangler d1 execute DB --remote --file=db/migrations/004_selected_recipients.sql`，再部署新代码。此迁移新增草稿收件人字段并更新发布触发器，保留已有通知及回执；由于包含 `ALTER TABLE`，不要重复执行。本地使用 `npm run db:recipient-selection`。

## Cloudflare 部署

1. 创建 D1 数据库，将真实 `database_id` 写入 `wrangler.toml`。仓库中的全零 ID 仅供本地占位。
2. 依次运行 `npx wrangler d1 execute DB --remote --file=db/schema.sql`、`npx wrangler d1 execute DB --remote --file=db/migrations/002_notifications.sql`、`npx wrangler d1 execute DB --remote --file=db/migrations/003_publish_recipients_trigger.sql` 和 `npx wrangler d1 execute DB --remote --file=db/migrations/004_selected_recipients.sql`。迁移 004 仅执行一次。生产库不要运行演示脚本。旧本地数据库若有课程表，网站不会查询或展示它们；本次不删除既有数据。
3. 创建 Pages 项目并连接仓库，构建命令 `npm run build`，输出目录 `dist`，将 D1 绑定名设为 `DB`。
4. 为 `/api/admin/*` 配置班委 Access 应用，设置 `ACCESS_DOMAIN`、`ACCESS_AUD` 和逗号分隔的 `ADMIN_EMAILS`。
5. 为 `/api/member/*` 配置另一 Access 应用，启用 [One-time PIN 邮箱登录](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)，策略只允许班级成员邮箱，并把其 Audience Tag 配为 `MEMBER_ACCESS_AUD`。网站中的成员名单也需与 Access 允许名单同步。
6. 发布后核对公开通知可读、匿名写入被拒、名单内同学可确认通知且班委统计更新。

`LOCAL_DEV_MODE`、`LOCAL_DEV_ADMIN_EMAIL`、`LOCAL_DEV_TOKEN`、`LOCAL_DEV_MEMBER_EMAIL` 和 `LOCAL_DEV_MEMBER_TOKEN` 只用于本地自动化测试，不配置到生产环境。

Cloudflare Pages、Functions、D1 和 Access 当前都有免费计划或额度；Access 免费计划面向少于 50 位用户。上线前请核对账户价格及限额。天气数据来自 [Open-Meteo](https://open-meteo.com/)（CC BY 4.0），本网站将天气代码转为中文描述。免费接口限非商业使用，须遵守其[条款](https://open-meteo.com/en/terms)。

# 西安交通大学班务系统第一阶段 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立公开可读、由班委维护的西安交通大学班务网站第一版，覆盖首页、课表和日程。

**Architecture:** React 前端通过 Pages Functions 读取 D1 中的课程、学期和事项；首页摘要从同一数据源计算。写入接口及管理页由 Cloudflare Access 保护，并在服务端验证令牌与班委邮件白名单。

**Tech Stack:** TypeScript、React、Vite、Vitest、Cloudflare Pages Functions、D1、Cloudflare Access、Playwright。

**Spec:** `docs/superpowers/specs/2026-09-28-classboard-xjtu-design.md`

## Global Constraints

- 顶部使用西安交大标志性的红色；移动端保留参考站的卡片与底部导航结构。
- 公开可读；仅班委可写；不在前端保存可写数据库的密钥。
- 使用本班自有资料和原创标识，不复制参考站的班级数据与校徽文件。
- 全部课程及日程时间按 `Asia/Shanghai` 处理。
- 第一阶段不实现论坛、通知和普通同学账户。
- 真实班级资料尚未提供；示例数据必须显式标记为演示数据。

## Review Focus

1. 学期开始日期不是周一：教学周仍从包含该日期的周一开始；Task 1 测试。
2. 单双周或超出起止周课程：只在匹配周显示；Task 1 测试。
3. 跨天截止事项：按上海时区计算是否过期；Task 1 测试。
4. 无效或缺失 Access 令牌：写入返回 403，公开读取仍可用；Task 3 测试。
5. 天气接口失败：显示“天气暂不可用”，不显示模拟的实时温度；Task 5 测试。

---

## File map

- `src/domain/types.ts`: 课程、学期、事项和快照类型。
- `src/domain/calendar.ts`: 教学周、课程展开、下一节课与事项状态。
- `src/domain/ics.ts`: 手机日历导出文本。
- `db/schema.sql`, `db/demo.sql`: D1 结构和标明为演示的初始数据。
- `functions/api/snapshot.ts`: 公开读取接口。
- `functions/api/admin/_middleware.ts`: Access 令牌和管理员邮件验证。
- `functions/api/admin/courses.ts`, `events.ts`, `semester.ts`: 管理写入接口。
- `src/api/client.ts`: 前端读取和写入 API 封装。
- `src/pages/Today.tsx`, `Timetable.tsx`, `Schedule.tsx`, `Admin.tsx`: 页面。
- `src/components/*`, `src/styles/*`: 共用布局、卡片、导航和红色主题。
- `src/weather.ts`: 西安天气适配与错误状态。
- `README.md`: 本地运行、班级资料录入和 Cloudflare 部署说明。

### Task 1: 课表和日程领域规则

**Files:** `src/domain/types.ts`, `src/domain/calendar.ts`, `src/domain/ics.ts`, `src/domain/calendar.test.ts`, `src/domain/ics.test.ts`; 同时建立运行这些测试所需的最小 Vite/Vitest 配置并初始化本地 Git 仓库。

**Interfaces:** `getTeachingWeek(date, semester): number`；`getCoursesForDate(date, courses, semester): CourseOccurrence[]`；`getNextClass(now, courses, semester): CourseOccurrence | null`；`getEventStatus(now, event): EventStatus`；`buildIcs(courses, semester): string`。

- [ ] 写失败测试：非周一开学、周次边界、单双周、无课日、下一节课、跨天截止与 `.ics` 时间及转义。
- [ ] 运行 `npm test -- src/domain`，确认测试因接口未实现而失败。
- [ ] 实现上述类型与纯函数，不依赖页面或数据库。
- [ ] 运行 `npm test -- src/domain`，确认通过并提交该任务。

### Task 2: D1 数据与公开读取

**Files:** `db/schema.sql`, `db/demo.sql`, `functions/api/snapshot.ts`, `functions/api/snapshot.test.ts`, `src/api/client.ts`。

**Interfaces:** `GET /api/snapshot` 返回 `{semester, courses, events}`；`fetchSnapshot(): Promise<Snapshot>`。

- [ ] 写失败测试：正常读取、空数据库、数据库异常、公开响应不包含管理员配置或敏感字段。
- [ ] 运行 `npm test -- functions/api/snapshot.test.ts`，确认失败。
- [ ] 建表、添加明确标识的演示数据并实现只读接口及客户端请求。
- [ ] 运行 `npm test -- functions/api/snapshot.test.ts`，确认通过并提交。

### Task 3: 班委写入权限与接口

**Files:** `functions/api/admin/_middleware.ts`, `functions/api/admin/courses.ts`, `functions/api/admin/events.ts`, `functions/api/admin/semester.ts`, `functions/api/admin/admin.test.ts`。

**Interfaces:** `POST/PUT/DELETE /api/admin/courses` 与 `/api/admin/events`，`PUT /api/admin/semester`；成功返回更新后的记录，字段错误返回 400，无权限返回 403。

- [ ] 写失败测试：缺失/伪造/过期令牌、非白名单邮件、合法班委写入、错误字段和越权访问；公开读取不受管理路由保护。
- [ ] 运行 `npm test -- functions/api/admin/admin.test.ts`，确认失败。
- [ ] 用 Cloudflare Access 官方 Pages 插件验证令牌，再检查邮件白名单；实现参数校验与 D1 写入。
- [ ] 运行 `npm test -- functions/api/admin/admin.test.ts`，确认通过并提交。

### Task 4: 红色主题的公开页面

**Files:** `src/App.tsx`, `src/pages/Today.tsx`, `src/pages/Timetable.tsx`, `src/pages/Schedule.tsx`, `src/components/*`, `src/styles/*`, `src/pages/public.test.tsx`。

**Interfaces:** 三个公开页面消费 `fetchSnapshot()` 和 Task 1 的纯函数；课表导出调用 `buildIcs()`。

- [ ] 写失败组件测试：演示标记、今日课程与下一节课、周次切换、空课表、日期筛选和接口失败状态。
- [ ] 运行 `npm test -- src/pages/public.test.tsx`，确认失败。
- [ ] 实现首页、课表、日程、响应式导航和西交大红色顶部；完成 `.ics` 下载操作。
- [ ] 运行组件测试与 `npm run build`，确认通过并提交。

### Task 5: 天气与班委管理页

**Files:** `src/weather.ts`, `src/weather.test.ts`, `src/pages/Admin.tsx`, `src/pages/admin.test.tsx`, `src/api/client.ts`。

**Interfaces:** `getXianWeather(): Promise<WeatherResult>`；管理页通过 `/api/admin/*` 保存并在成功后刷新公开快照。

- [ ] 写失败测试：天气正常及失败、未登录管理状态、无效表单、成功保存、服务端拒绝及保存失败后输入保留。
- [ ] 运行 `npm test -- src/weather.test.ts src/pages/admin.test.tsx`，确认失败。
- [ ] 实现天气适配、登录入口与课程/事项/学期编辑表单；天气失败明确显示“天气暂不可用”。
- [ ] 运行对应测试与 `npm run build`，确认通过并提交。

### Task 6: 端到端验收与交付

**Files:** `e2e/phase-one.spec.ts`, `playwright.config.ts`, `README.md`, Pages/D1 配置文件。

**Interfaces:** 本地开发命令启动静态前端、Functions 和本地 D1；README 给出 Cloudflare 绑定及 Access 白名单设置步骤。

- [ ] 写端到端场景：手机与桌面首页、课表切周与导出、日程筛选、访客写入被拒、班委保存后刷新仍可见。
- [ ] 运行 `npm run test:e2e`，确认场景先因未接通本地服务而失败。
- [ ] 完成 Wrangler 本地配置、必要的测试身份注入及 README；不要将生产密钥或真实班级数据写入仓库。
- [ ] 运行 `npm test`、`npm run build`、`npm run test:e2e` 并人工核对手机/桌面截图，然后提交。

## Execution note

当前目录还不是 Git 仓库。执行 Task 1 时在此目录初始化本地 Git，以便按任务保存可回退的提交。部署需要用户的 Cloudflare 账户及真实班级资料，先完成本地可运行版本与部署文档。

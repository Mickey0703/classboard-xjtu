# 班级通知与待办 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让班委发布公告和待办，让名单内同学无密码登录后确认知悉/完成，并让班委查看传达统计。

**Architecture:** D1 存通知、班级成员和发布时的收件人快照。公开接口返回通知内容，成员接口通过独立 Cloudflare Access OTP 身份和 D1 名单验证，管理接口沿用班委权限。

**Tech Stack:** React、TypeScript、Pages Functions、D1、Cloudflare Access OTP、Vitest、Playwright。

**Spec:** `docs/superpowers/specs/2026-09-29-notifications-design.md`

## Global Constraints

- 论坛不加入；公开读通知，确认/完成需名单内邮箱登录，统计只给班委。
- 发布时固定收件人名单；发布后正文不可直接修改；撤回保留历史。
- 邮件验证码只用于登录，本阶段不主动发送通知邮件。
- 不公开姓名邮箱名单或逐人状态；使用 Asia/Shanghai 时间。

## Review Focus

1. 访客、非名单邮箱不能提交确认，且不能查询名单和统计。
2. 重复知悉/完成不会重复计数；撤销完成只影响完成统计。
3. 名单在发布后变化不影响该通知收件分母。
4. 草稿不可公开；撤回后不可继续确认。
5. 网络或数据库失败时不显示虚假的确认成功。

---

### Task 1: 模型、迁移与公开通知

**Files:** `db/migrations/002_notifications.sql`, `src/domain/types.ts`, `functions/api/snapshot.ts`, `functions/api/snapshot.test.ts`, `src/api/client.ts`。

**Interfaces:** `NotificationItem`、`ClassMember`、`RecipientStatus`；`GET /api/snapshot` 增加仅已发布通知的公开字段。

- [ ] 写失败测试：草稿/撤回不可见，公开响应不含收件人邮箱。
- [ ] 运行对应测试并确认失败。
- [ ] 建表、模型和公开快照映射。
- [ ] 运行测试及构建，通过后提交。

### Task 2: 班委成员、通知和统计接口

**Files:** `functions/api/admin/members.ts`, `functions/api/admin/notifications.ts`, `functions/api/admin/notification-stats.ts`, `functions/api/admin/notifications.test.ts`，共用校验函数。

**Interfaces:** 班委可管理成员、草稿、发布、撤回；`GET /api/admin/notification-stats?id=` 返回收件快照的已知悉/已完成及待处理名单。

- [ ] 写失败测试：成员唯一、草稿编辑、空名单拒绝发布、发布快照、发布后不可改正文、撤回、统计隐私。
- [ ] 运行测试确认失败。
- [ ] 实现校验、D1 批次发布和管理接口。
- [ ] 运行测试及构建，通过后提交。

### Task 3: 同学无密码身份与回执

**Files:** `functions/api/member/_middleware.ts`, `functions/api/member/login.ts`, `functions/api/member/session.ts`, `functions/api/member/receipt.ts`, `functions/api/member/member.test.ts`。

**Interfaces:** 单独 `MEMBER_ACCESS_AUD`；会话接口返回本人邮箱/姓名；收件接口只返回和修改本人状态。已完成自动知悉，重复操作幂等，撤销完成有效。

- [ ] 写失败测试：无身份、伪造/非名单、错误收件人、重复确认、完成与撤销、撤回拒绝。
- [ ] 运行测试确认失败。
- [ ] 复用 Access 官方插件并增加 D1 成员与收件验证。
- [ ] 运行测试及构建，通过后提交。

### Task 4: 通知界面与班委统计

**Files:** `src/pages/Notifications.tsx`, `src/pages/Admin.tsx` 及通知管理组件，`src/App.tsx`, `src/components/Shell.tsx`, `src/pages/Today.tsx`, `src/styles/main.css`, 对应组件测试。

**Interfaces:** 底部新增“通知”；首页突出重要通知；登录后可操作本人确认状态；管理页成员/通知表单与统计。

- [ ] 写失败组件测试：公开列表、重要通知、登录引导、知悉/完成反馈、班委草稿发布与统计。
- [ ] 运行测试确认失败。
- [ ] 实现响应式界面与 API 客户端。
- [ ] 运行测试、构建和截图检查，通过后提交。

### Task 5: 浏览器验收与交付

**Files:** `e2e/notifications.spec.ts`, `README.md`, `package.json` 脚本与演示数据。

- [ ] 写浏览器场景：访客阅读、班委发布、名单内成员确认和完成、班委统计、非成员拒绝。
- [ ] 运行确认初始失败。
- [ ] 完成本地迁移/测试身份、部署说明和不含真实名单的演示数据。
- [ ] 运行全部单元测试、构建、浏览器测试及 Git 检查；保留本地预览供审阅。

## Execution note

在现有 `feat/notifications` 分支实现；沿用本地 D1。正式班级邮箱名单和 Cloudflare Access 策略需用户在部署前提供/配置；本阶段不发布到外部服务。

# 展示标题衬线字体

`noto-serif-sc-display.woff2` 为 Noto Serif SC 的 700–800 可变字重 WOFF2 子集，页面、栏目标题和大号统计/日期/温度数字为 700，首页大标题与品牌文字为 800。
字体来自 Google Fonts 官方 CSS API，许可见同目录 `OFL-NotoSerifSC.txt`。

官方项目：https://github.com/google/fonts/tree/main/ofl/notoserifsc

当前包含字形：

```
今天的班务班级通知班级日程班委管理通知速览近期事项西安天气工设2601西交ID 2601 -.0123456789
```

应用于固定页面标题、首页栏目标题和班级品牌文字。未包含的自定义班级名称字形回退到系统宋体；通知正文、内容标题和表单保持系统无衬线字体。

新增固定展示标题时，通过 Google Fonts CSS API 的 `text` 参数重新生成上述字符集的 WOFF2，并同步更新 `src/styles/main.css` 的 `unicode-range`。网页通过本域字体文件加载，使用 preload 和 font-display: swap，无需连接 Google Fonts。

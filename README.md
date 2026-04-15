<div align="center">

<h1>教师百宝箱 · Teacher Toolbox</h1>

<p><strong>以教师自己的教学资料为知识底座的 AI 教学助手</strong></p>

<p>
  <em>NotebookLM 的三栏工作台 · Claude 的对话能力 · 面向中国高中语文课堂的具体工作流</em>
</p>

<p>
  <img src="https://img.shields.io/badge/Next.js-16.2-000?logo=next.js" alt="Next.js 16.2" />
  <img src="https://img.shields.io/badge/React-19.2-61dafb?logo=react" alt="React 19.2" />
  <img src="https://img.shields.io/badge/Claude-Sonnet%204.6-d97706" alt="Claude Sonnet 4.6" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss" alt="Tailwind 4" />
</p>

<img src="docs/screenshots/02-notebook-chat.png" alt="教师百宝箱主界面" width="880" />

</div>

---

## 一、为什么要做这个？

市面上的通用 AI 助手（ChatGPT / 文心一言 / 豆包）对教师有两个难解的痛点：

1. **不懂我的教材。** 我用的是人教版必修上册、我刚发了一份班级月考卷、上周的教案里留了三个没讲透的知识点 — AI 都不知道。它只会给出"通用的好答案"，不是"我班上的答案"。
2. **不适配我的工作流。** 教师一天的真实任务是：备课、命题、改作业、预判学生提问。通用聊天框让教师自己把这些工作翻译成 prompt，摩擦极高。

**教师百宝箱的定位：教师上传自己的资料（教材、试卷、教案、教学反思），AI 只基于这些资料工作，并把常见教学任务固化为"一键工具"。**

目前首发科目：**高中语文**。

---

## 二、核心功能一览

### 2.1 笔记本（按课程 / 学期 / 单元组织知识库）

每个笔记本是一个独立的知识库命名空间：你可以为"必修上册"、"高三一轮复习"、"文言文专题"各开一本。笔记本之间资料隔离、聊天历史隔离。

<img src="docs/screenshots/01-home.png" alt="笔记本列表" width="780" />

### 2.2 三栏工作台（借鉴 NotebookLM，但为中文教学重做）

| 左栏 · 知识库来源 | 中栏 · 对话 | 右栏 · 教学百宝箱 |
| :--- | :--- | :--- |
| 上传 PDF / Word / 图片 / PPT；自动按教材/试卷/教案/教学反思分组 | 基于知识库的流式问答；支持 Markdown 渲染、中文 IME 安全回车、回到底部按钮 | 一键调用测验生成、模拟学生提问、课程设计三大工具 |

<img src="docs/screenshots/02-notebook-chat.png" alt="三栏工作台" width="880" />

### 2.3 知识库来源（Sources）

- **拖拽上传** PDF / Word / 图片 / PPT；后台异步解析，前端实时显示"解析中"状态
- **AI 自动分类**：每次上传后调用 Claude 判断是教材 / 试卷 / 教案 / 教学反思，并生成 50 字摘要
- **图片 OCR**：扫描版试卷走 Claude Vision，按题号结构化提取
- **网页链接 / 粘贴纯文本**也能入库
- **上传大小限制**（默认 25 MB，可通过 `NEXT_PUBLIC_MAX_UPLOAD_MB` 调整）

<img src="docs/screenshots/06-add-source.png" alt="添加资料" width="780" />

### 2.4 AI 聊天（中栏）

- **流式输出** + **中途可停止**（Stop 按钮 → 后端把已生成的部分写入历史并标 `（已停止生成）`）
- **历史自动持久化**：刷新页面 / 换设备都能看到完整对话
- **IME 安全**：中文输入法选字回车不会误发送（`e.nativeEvent.isComposing` 守护）
- **Markdown 渲染**：标题 / 列表 / 引用 / 代码块 / 分割线 / 行内 code 都支持
- **智能自动滚动**：长回答自动跟随；用户上滚阅读时停止跟随，并显示"回到底部"按钮
- **知识库截断告警**：若上传文档内容超过 8000 字进入上下文的部分，顶部会出现黄色 banner 提示

### 2.5 教学百宝箱（右栏·三件套）

#### ① 测验生成
<img src="docs/screenshots/03-tool-quiz.png" alt="测验生成" width="780" />

基于你上传的教材和试卷自动出题。可选**问题数量**（5-8 / 10-12 / 15-20 题）、**难度**（基础识记 / 混合 / 综合分析）、并可指定主题范围。输出含题号、题型、分值、参考答案、评分标准。

#### ② 模拟学生提问
<img src="docs/screenshots/04-tool-student-sim.png" alt="模拟学生提问" width="780" />

帮你**提前预演课堂提问**。可选学生类型（优等生 / 中等生 / 学困生 / 混合），生成 8-12 个"真实学生可能问的问题"，并附教师备课要点。

#### ③ 课程设计
<img src="docs/screenshots/05-tool-lesson.png" alt="课程设计" width="780" />

一键生成教案框架：课题 → 三维目标 → 重难点 → 课时安排 → 五环节教学过程（导入 / 感知 / 研读 / 拓展 / 总结）→ 板书设计 → 反思预留。每个环节都含教师活动 + 学生活动。

---

## 三、技术栈

| 层 | 技术 |
| :--- | :--- |
| **框架** | Next.js 16.2 (App Router + Turbopack)，React 19.2 |
| **LLM** | Claude Sonnet 4.6（可通过 `ANTHROPIC_MODEL` 切换 Opus / Haiku） |
| **SDK** | `@anthropic-ai/sdk` 0.88 · 官方流式 SSE |
| **文档解析** | `pdf-parse`（PDF），`mammoth`（Word），Claude Vision（图片 OCR） |
| **UI** | Tailwind 4 + OKLCH 自定义色板（朱砂 / 竹 / 靛 / 金 / 宣纸），Noto Serif SC 衬线字体 |
| **状态** | React hooks · 单文件 JSON 持久化（MVP）· 会迁 SQLite |
| **网络** | 内置 undici EnvHttpProxyAgent，自动拾取 `https_proxy` 环境变量（国内网络友好） |

### 项目结构

```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts              # 聊天流式端点，支持 AbortSignal
│   │   ├── tool/route.ts              # 三件套统一端点
│   │   ├── upload/route.ts            # 文件上传 + 解析 + 分类
│   │   ├── documents/                 # CRUD 文档
│   │   └── notebooks/[id]/messages    # 聊天历史 GET / DELETE
│   ├── notebooks/[id]/page.tsx        # 三栏工作台主页
│   └── page.tsx                       # 笔记本列表首页
├── components/
│   ├── chat-panel.tsx                 # 中栏（流式 + 停止 + 历史 + IME）
│   ├── sources-panel.tsx              # 左栏
│   ├── studio-panel.tsx               # 右栏
│   ├── tool-slide-over.tsx            # 三个工具 modal
│   ├── markdown.tsx                   # 共享 Markdown 渲染器
│   └── add-source-modal.tsx           # 上传模态框（拖拽 / URL / 纯文本）
├── lib/
│   ├── anthropic.ts                   # Claude 客户端 + system prompt
│   └── store.ts                       # 文件后端存储（data/store.json）
└── instrumentation.ts                 # 启动时配置网络代理
```

---

## 四、快速开始

### 4.1 先决条件

- Node.js ≥ 20
- Anthropic API Key（https://console.anthropic.com/settings/keys）
- 国内网络建议配置代理（Clash / Surge 默认 `http://127.0.0.1:7890`）

### 4.2 安装 & 运行

```bash
git clone https://github.com/willmusubi/school-better.git
cd school-better
npm install
```

手动新建 `.env.local`，填入以下内容：

```bash
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxx

# 可选：切换模型
# ANTHROPIC_MODEL=claude-opus-4-6

# 可选：提高上传大小限制（默认 25 MB）
# NEXT_PUBLIC_MAX_UPLOAD_MB=50

# 可选：国内代理（SDK 会自动拾取）
# https_proxy=http://127.0.0.1:7890
# http_proxy=http://127.0.0.1:7890
```

启动：

```bash
npm run dev
# → http://localhost:3000
```

### 4.3 第一次使用

1. 打开 `http://localhost:3000`，系统预置了一个"高中语文·入门笔记本"
2. 进入笔记本 → 左栏点"添加资料"→ 拖几份真实教材/试卷/教案进来
3. 等待左栏图标由 ⏳ 变为 ✓（AI 后台解析 + 分类需 10-60 秒/份）
4. 中栏随便问一句："帮我分析这篇课文的论证思路"
5. 右栏点"测验生成"，看看 AI 基于你的教材出题的效果

---

## 五、设计原则

**「书卷气」视觉系统**。不想让它看起来像又一个硅谷 SaaS。所以：

- 主色 **朱砂红**（`oklch(0.46 0.2 24)`） — 像批注用的红笔、像老式印章
- 衬字 **Noto Serif SC** — 中文宋体的端正感
- 背景 **宣纸色** 而非纯白 — 减少屏幕疲劳，呼应纸质教学资料
- 辅助色用 **竹绿、靛蓝、金黄** — 每个功能区域有自己的"印章色"
- 阴影柔和、圆角 2xl — 避免锐利边缘造成的"工具感"

目标是：老师看到会觉得"这是给我用的"，而不是"这是一个工程师做的系统"。

---

## 六、Roadmap

### 已完成（v0.1 MVP）

- [x] 三栏工作台
- [x] 知识库上传 + 自动分类 + OCR
- [x] 流式 AI 聊天 + 历史持久化 + 停止按钮
- [x] 三个教学工具（测验 / 模拟学生 / 教案）
- [x] 中文 IME 安全、长回答滚动、智能自动滚动
- [x] 知识库截断告警

### 下一步（v0.2）

- [ ] **认证系统**（Clerk 或自建邮箱 magic link） — 上线前必修
- [ ] **SQLite 持久化**（`better-sqlite3`，脱离 `data/store.json`）
- [ ] **RAG 检索**：文档 embeddings + 按 query 召回 top-k 片段，而非粗暴拼接 8000 字
- [ ] **上传解析进度 SSE**（替换 2s 轮询 + spinner）
- [ ] **Toast 错误反馈系统**

### 再下一步（v0.3+）

- [ ] 其他学科适配：数学、英语、历史
- [ ] 教师之间的知识库共享（教研组模式）
- [ ] 学生家长端 app（基于教师批改数据做个性化推荐）
- [ ] 移动端 PWA
- [ ] Playwright 关键流程 e2e 测试

---

## 七、贡献 & 反馈

目前项目处于早期原型阶段，欢迎在 Issues 里提想法 / bug。

如果你是中国一线高中教师，特别欢迎联系 — 最想听到的是"你们这工具其实少做了 X" / "真实工作流中最占时间的是 Y"。

---

## 八、License

MIT.

产品 / UI 设计灵感来源：Google NotebookLM、字节豆包、Anthropic Claude。
AI 协作开发：Claude Opus 4.6 (1M context)。

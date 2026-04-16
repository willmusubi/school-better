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
| 上传 PDF / Word / 图片 / PPT；自动按教材/试卷/教案/教学反思分组 | 基于知识库的流式问答；支持 Markdown 渲染、中文 IME 安全回车、回到底部按钮 | 一键调用测验生成、模拟学生提问、课程设计、**作文批改**四大工具 |

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

### 2.5 教学百宝箱（右栏·四件套）

#### ① 测验生成
<img src="docs/screenshots/03-tool-quiz.png" alt="测验生成" width="780" />

基于你上传的教材和试卷自动出题。可选**问题数量**（5-8 / 10-12 / 15-20 题）、**难度**（基础识记 / 混合 / 综合分析）、并可指定主题范围。输出含题号、题型、分值、参考答案、评分标准。

#### ② 模拟学生提问
<img src="docs/screenshots/04-tool-student-sim.png" alt="模拟学生提问" width="780" />

帮你**提前预演课堂提问**。可选学生类型（优等生 / 中等生 / 学困生 / 混合），生成 8-12 个"真实学生可能问的问题"，并附教师备课要点。

#### ③ 课程设计
<img src="docs/screenshots/05-tool-lesson.png" alt="课程设计" width="780" />

一键生成教案框架：课题 → 三维目标 → 重难点 → 课时安排 → 五环节教学过程（导入 / 感知 / 研读 / 拓展 / 总结）→ 板书设计 → 反思预留。每个环节都含教师活动 + 学生活动。

#### ④ 作文批改（新）

按**全国卷高考作文评分标准（60分制）**批改学生作文。两个专精 AI Agent 分工协作：

- **Agent 1 · 视觉识别**：上传手写作文图片 → AI 逐字提取文字（保留错别字原样，无法辨认用□标注）
- **教师 Checkpoint**：识别结果填入文本框，教师检查/修正后再提交
- **Agent 2 · 评分批改**：按评分标准逐维度打分 + 生成批改报告

支持**直接粘贴文本**或**上传手写图片**两种输入方式。可选批改侧重（综合评价 / 内容立意 / 语言表达 / 结构布局）。

**评分标准内嵌 prompt**，覆盖完整高考评分体系：
- 基础等级：内容（20分）+ 表达（20分），各分四个等级
- 发展等级（20分）：深刻 / 丰富 / 文采 / 创意
- 扣分项：错别字、缺标题、字数不足、套作、抄袭
- 评分原则：等级不跨越、文体上限等约束

**输出结构**：总分 + 三维度得分表 → 扣分项 → 各维度详评（引用原文佐证）→ 优点 → 问题与建议 → 修改方向

---

## 三、技术栈

| 层 | 技术 |
| :--- | :--- |
| **框架** | Next.js 16.2 (App Router + Turbopack)，React 19.2 |
| **LLM** | **双 provider 抽象层**：Claude (Anthropic) 或 Kimi (Moonshot),UI 里一键切换 |
| **默认模型** | Claude: `claude-sonnet-4-6` / Kimi: `kimi-k2-thinking`(思考模型) |
| **SDK** | `@anthropic-ai/sdk` 0.88 (Claude) · 纯 `fetch` OpenAI-compatible (Kimi,零 SDK 依赖) |
| **文档解析** | `pdf-parse`（PDF）、`mammoth`/`officeparser`（docx/pptx）、`word-extractor`（旧版 .doc）、Claude Vision / Kimi K2.5（图片 OCR，跟随 provider 设置） |
| **UI** | Tailwind 4 + OKLCH 自定义色板（朱砂 / 竹 / 靛 / 金 / 宣纸），Noto Serif SC 衬线字体 |
| **状态** | React hooks · 单文件 JSON 持久化（MVP）· 会迁 SQLite |
| **网络** | 内置 undici EnvHttpProxyAgent，自动拾取 `https_proxy` 环境变量（国内网络友好） |

### 项目结构

```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts              # 聊天流式端点，支持 AbortSignal
│   │   ├── tool/route.ts              # 四件套统一端点
│   │   ├── ocr/route.ts              # 手写作文图片 → 文字（视觉模型 OCR）
│   │   ├── followups/route.ts         # 每次回答后生成 3 个动态追问
│   │   ├── settings/route.ts          # UI 里配 provider/API key 的后端
│   │   ├── upload/route.ts            # 文件上传 + 解析 + 分类
│   │   ├── documents/                 # CRUD 文档
│   │   └── notebooks/[id]/messages    # 聊天历史 GET / DELETE
│   ├── notebooks/[id]/page.tsx        # 三栏工作台主页
│   └── page.tsx                       # 笔记本列表首页
├── components/
│   ├── chat-panel.tsx                 # 中栏（流式 + 停止 + 历史 + IME + 追问胶囊）
│   ├── sources-panel.tsx              # 左栏
│   ├── studio-panel.tsx               # 右栏（4 活 + 2 待开发)
│   ├── tool-slide-over.tsx            # 四个工具 modal（含作文批改 OCR 上传）
│   ├── profile-menu.tsx               # 右上角姓氏 / AI 配置入口
│   ├── settings-modal.tsx             # AI 配置模态框
│   ├── markdown.tsx                   # 共享 Markdown 渲染器(含表格)
│   └── add-source-modal.tsx           # 上传模态框（拖拽 / URL / 纯文本）
└── lib/
    ├── llm/
    │   ├── types.ts                   # 共享 LLMProvider 接口
    │   ├── anthropic.ts               # AnthropicProvider
    │   ├── moonshot.ts                # MoonshotProvider (Kimi)
    │   └── index.ts                   # 工厂 + 根据设置选 provider
    ├── app-settings.ts                # 读写 data/settings.json
    ├── prompts.ts                     # 系统提示词 + 称呼指令
    ├── profile.ts                     # 客户端姓氏 (localStorage)
    └── store.ts                       # 笔记本/文档/历史 (data/store.json)
```

---

## 四、快速开始（首次 15 分钟跑通）

面向**第一次克隆本项目到自己电脑上的老师**。推荐用 **Kimi (Moonshot)**,国内直连,不需要翻墙。不想改任何配置文件也可以,**API Key 直接在浏览器里填**。

### 4.1 准备环境（一次性,5 分钟）

需要装 3 样东西:

| 工具 | 用途 | 检查是否装好 | 没装的话 |
| :--- | :--- | :--- | :--- |
| **Node.js 20+** | 跑项目 | 终端输入 `node -v`,看到 `v20.x` 或更高 | 去 https://nodejs.org 下载 LTS 版,一路下一步 |
| **Git** | 下载项目 | 终端输入 `git --version` | Mac: 装 Xcode Command Line Tools (`xcode-select --install`)<br>Windows: 装 https://git-scm.com |
| **一个 AI API Key** | 调模型 | 看下面 ↓ | 看下面 ↓ |

**申请 AI API Key**(二选一):

- **Kimi (推荐,国内教师用这个)**:到 https://platform.moonshot.cn 注册 → 控制台 → API Key 管理 → 新建 → 复制备用。新用户有免费额度够试几百次对话。
- **Claude (海外老师或有代理的)**:到 https://console.anthropic.com/settings/keys 注册 → 充值(最低 $5) → 复制备用。国内需要开**全局代理**才能连上。

### 4.2 下载 + 安装项目(3 分钟)

打开终端,执行:

```bash
# 1. 下载项目到当前目录(会新建 school-better 文件夹)
git clone https://github.com/willmusubi/school-better.git

# 2. 进入项目目录
cd school-better

# 3. 安装依赖(第一次会下几百个包,国内可能需要几分钟)
npm install
```

> **国内 npm install 慢?** 换淘宝镜像: `npm config set registry https://registry.npmmirror.com` 然后再 `npm install`。

### 4.3 启动服务(1 分钟)

```bash
npm run dev
```

终端会打印类似:
```
▲ Next.js 16.2.3 (Turbopack)
- Local:         http://localhost:3000
✓ Ready in 475ms
```

**保持这个终端开着不要关**。打开浏览器访问 http://localhost:3000 就能看到首页。

### 4.4 在 UI 里配置 API Key(2 分钟)

打开首页后,你会看到笔记本列表。**还不能对话,先配 Key:**

1. 点击**右上角头像**(灰色 `+`)
2. 在弹出框底部点 **"AI 配置 →"**
3. 在 AI 配置模态框里:
   - **使用哪个 AI** —— 选 **Kimi (Moonshot)** 或 **Claude (Anthropic)**
   - **API Key** —— 把第 4.1 步复制的 Key 粘进来
   - **Moonshot 接入地址**(只 Kimi 需要)—— 国内选 **国内 · api.moonshot.cn**
   - **模型选择** —— 留默认就行(Kimi 默认是 `kimi-k2-thinking`)
4. 点 **保存**

> **可选:在头像 popover 里填你的姓(例如"王"),AI 会叫你"王老师"。**

### 4.5 第一次对话(5 分钟见效)

1. 回到首页,系统预置了一个"**高中语文·入门笔记本**"。也可以点右上角 **新建笔记本** 开一个新的
2. 进入笔记本 → 左栏点 **"添加资料"** → 拖几份真实教材/试卷/教案(PDF / docx / pptx / doc / 图片都行)
3. 等待左栏图标由 ⏳(解析中) 变为 ✓(就绪)。每份文档 AI 自动判断是教材/试卷/教案,并生成 50 字摘要,通常 10-60 秒
4. 中栏随便问一句,比如"**总结我上传的资料要点**"或"**帮我分析《青蒿素》这篇课文的论证思路**"
5. 回答完成后,下方会出现 3 个**动态追问按钮**,点一下自动作为下一条消息发送
6. 右栏点 **"测验生成"** / **"模拟学生提问"** / **"课程设计"** / **"作文批改"** 任一工具,体验基于你知识库的一键生成

完整走一遍应该在 15 分钟内。如果卡住了看下面。

### 4.6 常见问题排查

<details>
<summary><b>打开 http://localhost:3000 显示"无法访问此网站"</b></summary>

- 确认第 4.3 步终端是开着的,且输出里有 `Ready in ...`
- 如果终端显示 **Port 3000 is in use**,它会自动换到 3001 或 3002,按终端提示的实际地址打开就行
</details>

<details>
<summary><b>保存 API Key 时提示"API Key 只能包含可见 ASCII 字符"</b></summary>

你可能**不小心把别的内容(比如错误信息、链接)粘进了 Key 输入框**。
回到控制台重新复制一次真 Key,只包含 `sk-xxxxxxxxxxxx` 这样的字符,不要任何中文、空格、换行。
</details>

<details>
<summary><b>对话时报 "Moonshot 400 Bad Request: invalid temperature"</b></summary>

已修复。如果还遇到,更新到最新代码:
```bash
git pull
npm install
# Ctrl+C 停掉 dev,重新 npm run dev
```
</details>

<details>
<summary><b>对话时报 "Moonshot 404 Not Found the model ..."</b></summary>

选了不存在的模型。去 **AI 配置 → 模型选择**,选 **"使用默认"** 或从下拉里挑一个:
- `kimi-k2-thinking`(默认,强制思考)
- `kimi-k2.5`(最新,思考默认开 —— 注意不是 `kimi-k2.5-thinking`!)
- `kimi-k2-turbo-preview`(快速,不思考)
</details>

<details>
<summary><b>Claude 连不上,报 ECONNREFUSED / 超时</b></summary>

国内直连 `api.anthropic.com` 会被墙。两个选择:

- 切 Kimi: AI 配置里把 provider 改成 **Moonshot**,填 Kimi Key,base url 选国内 `api.moonshot.cn`
- 配代理: 开全局代理后,在**项目根目录**新建 `.env.local`,加一行 `https_proxy=http://127.0.0.1:7890`(改成你代理软件的实际端口),重启 dev server
</details>

<details>
<summary><b>上传的 .doc 文件解析失败</b></summary>

`.doc`(2003 年 Word)有两种可能:
- 文件损坏:另存为 `.docx` 再上传
- 文件里全是图片扫描:先用系统自带的"图片 OCR"导出为文字,或直接上传为图片走 Claude Vision
</details>

<details>
<summary><b>npm install 卡在某个包,或报 Permission denied</b></summary>

- 卡住: 换镜像 `npm config set registry https://registry.npmmirror.com` 后重试
- 权限: Mac/Linux 不要用 `sudo npm install`,如果以前 sudo 过,修复权限 `sudo chown -R $(whoami) ~/.npm`
</details>

<details>
<summary><b>我电脑上还是装不上 Node.js / git,就是不会用终端</b></summary>

先不用 clone 本地,直接联系作者(见下方**八、贡献 & 反馈**)用 **在线部署版** 或安排远程帮你装。本项目面向零前端经验的老师,这块正在找更易用的发行方式。
</details>

### 4.7 高级:用环境变量代替 UI 配置(工程师可跳这里)

如果想让配置写在文件里、可以 git 管理或批量分发(**不推荐把真 Key 入库**),新建项目根目录的 `.env.local`:

```bash
# provider: anthropic | moonshot
LLM_PROVIDER=moonshot

# Moonshot / Kimi
MOONSHOT_API_KEY=sk-xxxxxxxxxxxxxxxx
MOONSHOT_BASE_URL=https://api.moonshot.cn/v1

# Anthropic(可选,如果 provider=moonshot 则仅图片上传解析会用到)
# ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxx

# 可选:模型覆盖
# LLM_CHAT_MODEL=kimi-k2.5
# LLM_FOLLOWUP_MODEL=kimi-k2-turbo-preview

# 可选:视觉模型覆盖(手写作文 OCR + 图片上传解析)
# MOONSHOT_VISION_MODEL=kimi-k2.5
# ANTHROPIC_VISION_MODEL=claude-sonnet-4-6

# 可选:上传大小限制(默认 25MB)
# NEXT_PUBLIC_MAX_UPLOAD_MB=50

# 可选:国内代理(只 Claude 需要)
# https_proxy=http://127.0.0.1:7890
```

**优先级:UI 里保存的设置 > 环境变量 > 内置默认**。所以 UI 里一经保存,环境变量会被覆盖。

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

### 已完成（v0.1.1）

- [x] **作文批改**：全国卷高考60分制评分标准内嵌 prompt，结构化评分报告
- [x] **手写识别**：上传手写作文图片 → 视觉模型 OCR → 教师确认 → 提交批改（双 Agent 架构）
- [x] **OCR 跟随 provider**：Anthropic 用 Claude Vision，Moonshot 用 Kimi K2.5，不再强制依赖 Anthropic

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

# Pi Desktop 一体化重构方案：真实 Pi 接入 + 完整供应商体系

## Summary

把当前项目的两条核心工作线整合为同一套架构来推进：

- 主线 1：把桌面应用从“假聊天壳 + `pi-ai` 简单流式调用”升级为真实 Pi 运行时前端
- 主线 2：把当前很薄的 ProviderManager 升级为 Pi 兼容的完整供应商管理系统

核心原则只有一条：供应商配置必须直接服务真实 Pi 运行时，而不是再维护一套只给桌面 UI 用的假模型体系。

最终目标：

- Electron 负责桌面壳、会话、文件、预览、配置
- Pi 负责真实 Agent 运行
- 供应商配置统一注入 Pi
- 模型选择、附件、工作目录、工件文件、工具事件都围绕真实 Pi 流程运转

## Key Changes

### 1. 运行时架构统一为 `PiBridge`

在主进程新增一个统一的 `PiBridge` 层，替代当前 `src/main/agent.ts` 的直接 `streamSimple()` 主路径。

`PiBridge` 职责：

- 启动和管理真实 Pi 运行时
- 接收桌面端请求：发送消息、取消、切换会话、附加文件、切换工作目录、切换模型
- 将 Pi 事件标准化后通过 IPC 推给 renderer
- 把供应商配置、模型配置、工作目录和会话上下文传入 Pi

优先集成方式：

- 第一阶段优先采用 Pi CLI / coding-agent bridge
- 保留接口形状，后续可切到更深的 in-process SDK 集成而不改 renderer

统一事件协议：

- `run_started`
- `assistant_token`
- `assistant_message`
- `tool_started`
- `tool_finished`
- `tool_failed`
- `artifact_created`
- `run_aborted`
- `run_failed`
- `session_state_changed`
- `warning`

当前 `src/main/agent.ts` 处理方式改为：

- 退居兼容层或临时 fallback
- 不再作为默认真实运行路径

### 2. 供应商体系直接服务 Pi

把当前“名称 + baseUrl + models”的 provider 存储升级为 Pi 兼容结构，并作为 `PiBridge` 的唯一模型来源。

新的 `ProviderConfig` 至少包含：

- `id`
- `providerId`
- `displayName`
- `kind`: `builtin | custom`
- `authType`: `apiKey | oauth | none`
- `apiType`: `openai-completions | openai-responses | anthropic-messages | google-generative-ai`
- `baseUrl`
- `apiKeyEncrypted`
- `headers`
- `authHeader`
- `compat`
- `models`
- `isDefault`
- `createdAt`
- `updatedAt`

模型记录至少包含：

- `id`
- `name`
- `providerId`
- `runtimeKey`
- `input`
- `reasoning`
- `isDefault`

内置供应商目录按 Pi 当前支持面建立注册表，至少覆盖：

- `openai`
- `anthropic`
- `google`
- `openrouter`
- `groq`
- `mistral`
- `deepseek`
- `xai`
- `azure-openai-responses`
- `cerebras`
- `cloudflare-ai-gateway`
- `cloudflare-workers-ai`
- `vercel-ai-gateway`
- `together-ai`
- `github-copilot`
- `openai-codex`
- 本地 / 兼容端点：`ollama`、`lm-studio`、`vllm` 作为 custom presets

关键约束：

- 不再靠 `provider.name.toLowerCase()` 或 `baseUrl.includes(...)` 猜供应商
- 不再让 `TopBar` 持有假的模型列表
- 默认模型不再硬编码 `openai/gpt-4`

### 3. 自定义供应商能力一次做对

自定义供应商不再只等于“Custom OpenAI-compatible endpoint”，而是支持 Pi 的实际使用场景：

支持类型：

- OpenAI 兼容端点
- OpenAI Responses 兼容端点
- Anthropic 兼容端点
- Google / Gemini 风格端点
- 本地模型服务端点

表单能力：

- 选择 `apiType`
- 录入 `baseUrl`
- 录入 `apiKey`
- 自定义 headers
- 自定义 `authHeader`
- 配置 `compat`
- 发现模型
- 手动录入模型
- 指定默认模型
- 保存为默认供应商

兼容策略：

- 本地端点允许“无 key / 任意 key”
- 模型发现失败时允许手动录入
- 保存时允许未通过测试，但必须标记 `unverified`

### 4. 会话、工作目录、附件、工件都与 Pi 对齐

会话模型升级，不能再只是消息数组。

每个 session 至少维护：

- `sessionId`
- `cwd`
- `selectedProviderId`
- `selectedModelId`
- `runtimeStatus`
- `messages`
- `toolCalls`
- `artifacts`
- `attachments`
- `createdAt`
- `updatedAt`

统一行为：

- TopBar 当前目录 = Files 面板根目录 = Pi 实际 cwd = 默认工件输出目录
- InputBar 的附件、拖拽文件、截图粘贴必须进入 Pi 上下文，而不只是前端显示 chip
- Pi 产生的文件要进入 `artifacts`，并自动出现在右侧预览区
- PreviewPanel 打开的文件优先来自 session artifacts 和当前工作目录

### 5. ProviderManager / Welcome / TopBar 改成同一数据源

Renderer 侧所有“供应商/模型”入口全部共用主进程返回的真实目录与真实配置。

ProviderManager：

- 从 `providers:catalog` 读取内置供应商
- 支持新增、编辑、删除、设默认
- 支持测试连接、发现模型、手动添加模型
- 显示状态：未配置、已配置、已验证、验证失败、无默认模型

Welcome：

- 第一步选择内置供应商或自定义供应商
- 第二步输入密钥并测试
- 第三步拉取或手动配置模型
- 第四步设置默认工作目录
- 完成后立即生成可用默认 provider/model，不允许落回假界面

TopBar：

- 模型列表来自已配置供应商的真实模型集合
- 切换模型时传递真实 `providerId + modelId`
- 没有可用模型时显示空状态，引导打开 Provider Manager
- 当前模型标签显示 `供应商 / 模型`

### 6. 主进程 IPC 与接口统一

新增或重构这些接口，避免后续再拆：

- `providers:list()`
- `providers:catalog()`
- `providers:add(config, secret)`
- `providers:update(id, updates)`
- `providers:delete(id)`
- `providers:test(config)`
- `providers:discoverModels(config)`
- `pi:sendMessage(payload)`
- `pi:abortRun(sessionId)`
- `pi:switchSession(sessionId)`
- `pi:updateSessionRuntime(sessionId, runtimeSelection)`
- `pi:attachFiles(sessionId, files)`
- `pi:setWorkingDirectory(sessionId, cwd)`

Renderer 到主进程的模型选择统一结构：

- `providerId`
- `modelId`
- `sessionId`
- 可选 `thinkingLevel`

### 7. 迁移策略

为了不破坏当前已有修复，这次改造按兼容迁移处理：

保留并复用已有成果：

- 真实配置存储
- session 列表和消息持久化
- preview 面板
- 文件打开逻辑
- 当前测试框架

需要迁移的旧行为：

- 旧版 providers.json 自动升级到新结构
- 旧 session 若只有 `model` 字段，迁移为 `selectedProviderId/selectedModelId`
- 当前 `Welcome` 和 `ProviderManager` 的硬编码列表全部移除
- `TopBar` mock models 全部移除
- 当前 `providers:test -> /models` 的逻辑废弃

## Implementation Sequence

### 阶段 A：打通后端骨架

- 引入 `PiBridge` 抽象和事件协议
- 保留现有 UI，不改视觉，先让聊天后端从统一桥接层走
- 定义新的 provider/model/session 类型
- 加载和迁移旧 provider 数据

### 阶段 B：供应商体系落地

- 建立内置供应商注册表
- 重写 provider store、test、discoverModels
- 更新 preload 和 IPC 类型
- 让运行时模型解析改为基于 `providerId + modelId`

### 阶段 C：前端统一

- 重写 ProviderManager、Welcome、TopBar 的数据来源
- 去掉 fake model picker
- 让首次启动必须落到真实可用配置流
- 让附件、工件、当前目录进入统一 session runtime

### 阶段 D：真实 Pi 工作流补齐

- 把 Pi 工具事件映射到聊天 UI
- 把 Pi 生成文件接入 PreviewPanel
- 让 Files 面板、预览面板、会话状态围绕真实 cwd 和 artifacts 工作

## Test Plan

必须覆盖这些场景：

- 旧 providers 数据自动迁移成功
- 设置默认供应商时只有一个默认项
- OpenAI / OpenRouter / Groq 的测试与模型发现正常
- Anthropic / Google 不再错误请求 `/models`
- 自定义本地端点可保存、可设默认、可手动录入模型
- `PiBridge` 能接收 `providerId + modelId` 并构造正确运行时配置
- TopBar 显示真实模型，不再显示 mock 列表
- Welcome 完成后首次发送消息走真实 provider/model
- 附件进入 session runtime，不再只是前端 chip
- Pi 产出的 artifact 会出现在 PreviewPanel
- 无供应商、无模型、测试失败、模型发现失败、运行中止这些状态都有明确 UI 和错误反馈
- 回归验证 `npm test`、`npm run typecheck`、`npm run build`

## Assumptions

- 本轮以“真实 Pi 接入 + 供应商系统统一”为第一优先级，UI 继续沿用现有风格，不做额外大改版
- OAuth 型供应商先在目录中展示并标注“后续支持登录流程”；本轮优先做 `apiKey | none | custom endpoint`
- 第一阶段真实 Pi 集成优先走 CLI / coding-agent bridge；接口设计保持可切换到更深 SDK 集成
- 自定义供应商优先支持 `openai-completions`、`openai-responses`、`anthropic-messages`、`google-generative-ai`
- 模型自动发现不是强依赖，手动录入模型始终保留为兜底路径

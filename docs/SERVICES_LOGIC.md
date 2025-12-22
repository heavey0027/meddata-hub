
# 核心服务层逻辑详解 (Core Services)

本模块位于 `services/` 目录，主要负责**数据处理**、**安全认证**与**外部接口通信**。

---

## 📂 `services/mockDb.ts`
**定位**：数据访问层 (DAL) / API 客户端 / 本地模拟数据库

### 🌟 核心功能
*   **统一数据网关**：前端应用与后端服务器之间的唯一通信桥梁，封装所有 HTTP 请求。
*   **🛡️ 混合模式 (Hybrid API Strategy)**：采用 **“API 优先，Mock 兜底”** 的高可用策略。
    *   优先请求真实后端 (`http://localhost:5000`)。
    *   若失败（网络断开/后端未启动），自动降级使用本地 Mock 数据。
*   **本地持久化**：在 Mock 模式下利用 `localStorage` 模拟数据库 CRUD，确保刷新页面后数据不丢失。
*   **全链路审计**：集成日志服务，自动记录请求的发起、响应及回退行为。
*   **复杂业务聚合**：处理前端“联表查询”（如病历关联处方）、数据统计等逻辑。

### ⚙️ 核心机制：`fetchWithFallback`
这是本文件的**关键函数**，负责智能路由请求：
1.  **🚀 发起请求**：向 `API_BASE_URL` 发起带超时控制 (`AbortController`) 的真实 `fetch`。
2.  **📝 记录日志**：调用 `addLog` 记录请求元数据。
3.  **✅ 成功处理**：若后端返回 `200 OK`，记录成功日志并返回真实数据。
4.  **⚠️ 失败回退**：若超时、断网 or `500` 错误：
    *   捕获异常。
    *   记录警告日志 (Warning)。
    *   **直接返回 `fallbackData`**（本地预置数据或 LocalStorage 数据）。

### 📦 主要模块与逻辑
| 模块 | 逻辑说明 |
| :--- | :--- |
| **基础配置** | 定义实体（患者/医生/药品）的初始静态 Mock 数据；提供时间格式化工具。 |
| **认证服务** | `loginUser`：发送登录请求。**注意**：认证通常不走 Mock 兜底（安全考量），失败即抛出异常。 |
| **实体 CRUD** | 实现标准的增删改查。**乐观更新**：发送 API 请求同时也更新 `localStorage`，确保 UI 即使在 API 失败时也能反馈最新状态。 |
| **病历事务** | `saveMedicalRecord`：将病历主表与处方明细组装成复合 JSON 提交。<br>`getFullPatientDetails`：前端实现的“联表查询”，遍历病历并匹配药品信息，组装完整视图。 |
| **多模态数据** | `createMultimodalData`：Mock 模式下使用 `URL.createObjectURL` 生成 Blob 链接，支持文件即时预览。 |
| **统计报表** | `getStats` / `getSankeyData`：在前端并行聚合多源数据，计算性别分布、科室排名等（当后端不可用时）。 |

### 🔧 关键函数签名
```typescript
// 核心请求封装
fetchWithFallback<T>(endpoint: string, fallbackData: T): Promise<T>

// 复杂业务处理
saveMedicalRecord(record: MedicalRecord, details: PrescriptionDetail[]): Promise<void>
getFullPatientDetails(patientId: string): Promise<FullPatientData>
getExistingPatient(appointment: Appointment): Promise<Patient | undefined>
```

---

## 🔐 `services/authService.ts`
**定位**：认证与鉴权服务 / 会话管理

### 🌟 核心功能
*   **多模式验证**：支持“后端 API 验证”与“本地 Mock 验证”双轨制。
*   **会话管理 (Session)**：管理登录状态，持久化至 `localStorage`。
*   **患者注册**：包含数据校验、ID 生成、查重及入库逻辑。
*   **审计与调试**：记录登录/登出日志，控制全局 Debug 模式。

### 🔄 核心业务流程

#### 1. 登录流程 (`login`)
1.  **API 尝试**：调用 `mockDb.loginUser` 尝试真实后端验证。成功则建立 Session。
2.  **Mock 降级**：若后端不可用（网络问题），进入本地验证逻辑：
    *   **管理员**：硬编码校验 (`admin` / `admin123`)。
    *   **医生/患者**：遍历本地缓存列表匹配 ID 和密码（默认通常为 `password`）。

#### 2. 注册流程 (`registerPatient`)
1.  **校验**：检查必填字段。
2.  **查重**：遍历现有患者列表，确保手机号唯一。
3.  **构建**：生成 ID (`P` + 时间戳后4位)，设置默认值。
4.  **持久化**：调用 `createPatient` 写入数据（触发 API + LocalStorage 双写）。

### 🔧 关键函数
*   `login(credentials)`: 封装 API 与 Mock 的双重认证逻辑。
*   `logout()`: 清除本地 Session，记录登出日志。
*   `getCurrentUser()`: 获取当前用户对象，是 UI 权限判断（如 `isAdmin`）的依据。

---

## 🤖 `services/aiService.ts`
**定位**：多模型 AI 适配层 (Adapter)

### 🌟 核心功能
*   **统一接口**：适配 Google Gemini、OpenAI、DeepSeek、豆包等厂商 API。
*   **RAG 对话 (Chat)**：支持注入前端数据（Context）实现“基于数据的问答”。
*   **影像分析 (Vision)**：支持 Base64 图片上传与医学影像分析。
*   **提示词工程**：内置 System Prompt 与 Context 注入逻辑。

### ⚙️ 双路调用策略
根据配置的 `provider` 自动选择调用路径：

1.  **Google Gemini 路径** (`provider === 'gemini'`)
    *   使用官方 SDK: `@google/genai`。
    *   利用原生 `generateContent` 处理文本和图片流。

2.  **OpenAI 兼容路径** (ChatGPT / DeepSeek / Doubao)
    *   使用标准 `fetch` 请求。
    *   适配 `/chat/completions` 接口规范。

### 🧠 核心逻辑
*   **chatWithAI**：构建 System Prompt，设定“医疗助手”人设，将 JSON 数据嵌入 Prompt 强制模型基于事实回答。
*   **analyzeMedicalImage**：构建多模态 Payload（图片 + 文本指令），要求 AI 输出专业医学中文分析。
*   **异常处理**：捕获 Key 错误或 API 限制，记录详细堆栈 (`stack`) 供调试。

### 🔧 关键函数
```typescript
chatWithAI(message: string, contextData: any, config: AIConfig): Promise<string>
analyzeMedicalImage(file: File, prompt: string, config: AIConfig): Promise<string>
```

---

## 📝 `services/logger.ts`
**定位**：前端日志持久化服务

### 🌟 核心功能
*   **本地存储**：基于 `localStorage` 的轻量级日志系统。
*   **自动轮替 (Rotation)**：默认保留最新 **200 条**，防止缓存溢出。
*   **安全写入**：内置元数据截断与循环引用处理，防止单条日志过大导致崩溃。
*   **配额容错**：存储空间不足时自动触发紧急清理。

### 🛡️ 安全元数据处理 (Safe Metadata Handling)
在写入日志前，对 `metadata` 进行严格清洗：
1.  **序列化检查**：尝试 `JSON.stringify`。
2.  **循环引用保护**：若失败，替换为错误占位符。
3.  **大小截断**：若长度超过 **10,000 字符**，自动截断并标记 `[TRUNCATED]`，防止阻塞主线程或撑爆存储。

### 🔄 存储异常回退机制
当 `localStorage.setItem` 抛出 `QuotaExceededError` 时：
1.  捕获异常。
2.  **紧急瘦身**：将保留日志数从 200 条削减至 **50 条**。
3.  **重试写入**：腾出空间后再次尝试保存当前日志。

### 🔧 关键函数
*   `addLog(level, module, action, details)`: 核心写入，包含修剪队列与安全检查。
*   `getLogs()`: 读取所有日志供 UI 展示。
*   `clearLogs()`: 一键清空。
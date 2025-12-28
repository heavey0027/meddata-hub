
# 核心服务层逻辑详解 (Core Services)

本模块位于 `services/` 目录，主要负责**数据处理**、**安全认证**与**外部接口通信**。

---

## `services/apiService.ts`
**定位**：数据访问层 (DAL) / HTTP API 客户端

### 核心功能
*   **统一数据网关**：前端应用与后端服务器之间的唯一通信桥梁，封装所有 HTTP 请求。
*   **严格 API 模式**：所有数据操作（增删改查）均直接请求后端 `http://localhost:5000`。若请求失败，直接向上抛出错误，不进行本地数据模拟。
*   **全链路审计**：集成日志服务，自动记录所有 API 请求的发起、成功响应及失败原因。
*   **客户端数据聚合**：针对部分复杂视图（如仪表盘、患者全景视图），在前端并发请求多个基础接口并进行逻辑组装。

### 核心机制：`fetchFromApi`
这是本文件的**基础函数**，负责统一的请求处理：
1.  **URL 签名**：自动添加时间戳 `_t` 参数，防止浏览器激进的 304 缓存。
2.  **超时控制**：利用 `AbortController` 实现 10秒 请求超时熔断。
3.  **日志记录**：调用 `logger.addLog` 记录 Request 和 Response/Error 详情。
4.  **错误处理**：若 `response.ok` 为 false，抛出包含状态码的 Error；若网络异常，抛出 Network Error。

### 主要模块与逻辑
| 模块 | 逻辑说明 |
| :--- | :--- |
| **基础配置** | 定义 API 基地址；提供时间格式化工具。 |
| **认证接口** | `loginUser`：发送 POST 请求。成功则返回用户信息，失败则抛出后端返回的错误信息。 |
| **实体 CRUD** | 实现标准的 RESTful 调用。例如 `createPatient` 对应 `POST /patients`，`deleteDoctor` 对应 `DELETE /doctors/:id`。 |
| **复合事务** | `saveMedicalRecord`：将病历主表与处方明细组装成一个 JSON 对象发送给后端，由后端处理事务性插入。 |
| **数据聚合** | `getStats` / `getFullPatientDetails`：前端实现的“联表查询”。通过 `Promise.all` 并行获取基础数据（如医生列表、科室列表、病历记录），在 JS 内存中计算分布统计或关联名称。 |
| **多模态数据** | `createMultimodalData`：封装 `FormData` 对象，支持文件上传。 |

### 🔧 关键函数签名
```typescript
// 核心请求封装 (不再提供 fallbackData 参数)
fetchFromApi<T>(endpoint: string): Promise<T>

// 业务逻辑
saveMedicalRecord(record: MedicalRecord, details: PrescriptionDetail[]): Promise<void>
// 在客户端聚合 Record + PrescriptionDetails + MedicineName
getFullPatientDetails(patientId: string): Promise<FullPatientData[]> 
// 聚合 Count/Ratio 等数据用于前端图表
getStats(): Promise<DashboardStats> 
```

---

## `services/authService.ts`
**定位**：认证与鉴权服务 / 会话管理

### 核心功能
*   **API 验证**：登录请求直接透传至后端 `/api/login`。
*   **会话持久化**：登录成功后，将用户角色、ID 和 Token (如有) 存储在 `localStorage` 中，以便页面刷新后保持登录状态。
*   **权限校验**：提供 `getCurrentUser` 方法，供 UI 组件判断当前用户是否为管理员或医生。

### 核心业务流程

#### 1. 登录流程 (`login`)
1.  调用 `apiService.loginUser(role, id, password)`。
2.  **成功**：
    *   后端返回 `{ success: true, user: ... }`。
    *   AuthService 将用户信息写入 `localStorage`。
    *   记录 "Login Success" 日志。
3.  **失败**：
    *   捕获 API 抛出的错误。
    *   记录 "Login Failed" 日志。
    *   向 UI 抛出错误以显示提示。

#### 2. 注册流程 (`registerPatient`)
*   调用 `apiService.createPatient`。
*   注意：注册逻辑完全依赖后端查重（如手机号是否已存在），前端只负责表单预校验。

### 关键函数
*   `login(credentials)`: 执行 API 登录并建立本地 Session。
*   `logout()`: 清除本地 Session，记录登出日志。
*   `isAuthenticated()`: 检查是否存在有效的 Session 数据。

---

## `services/aiService.ts`
**定位**：多模型 AI 适配层 (Adapter)

### 核心功能
*   **统一接口**：适配 Google Gemini、OpenAI、DeepSeek、豆包等厂商 API。
*   **RAG 对话 (Chat)**：支持注入前端数据（Context）实现“基于数据的问答”。
*   **影像分析 (Vision)**：支持 Base64 图片上传与医学影像分析。
*   **提示词工程**：内置 System Prompt 与 Context 注入逻辑。

### 双路调用策略
根据配置的 `provider` 自动选择调用路径：

1.  **Google Gemini 路径** (`provider === 'gemini'`)
    *   使用官方 SDK: `@google/genai`。
    *   利用原生 `generateContent` 处理文本和图片流。

2.  **OpenAI 兼容路径** (ChatGPT / DeepSeek / Doubao)
    *   使用标准 `fetch` 请求。
    *   适配 `/chat/completions` 接口规范。

### 核心逻辑
*   **chatWithAI**：构建 System Prompt，设定“医疗助手”人设，将 JSON 数据嵌入 Prompt 强制模型基于事实回答。
*   **analyzeMedicalImage**：构建多模态 Payload（图片 + 文本指令），要求 AI 输出专业医学中文分析。
*   **异常处理**：捕获 Key 错误或 API 限制，记录详细堆栈 (`stack`) 供调试。

### 🔧 关键函数
```typescript
chatWithAI(message: string, contextData: any, config: AIConfig): Promise<string>
analyzeMedicalImage(file: File, prompt: string, config: AIConfig): Promise<string>
```

---

## `services/logger.ts`
**定位**：前端日志持久化服务

### 核心功能
*   **本地调试存储**：基于 `localStorage` 的轻量级日志系统，用于在没有后端日志服务的情况下排查前端问题。
*   **自动轮替 (Rotation)**：默认保留最新 **200 条**，防止缓存溢出。
*   **安全写入**：内置元数据截断与循环引用处理，防止单条日志过大导致崩溃。

### 安全元数据处理 (Safe Metadata Handling)
在写入日志前，对 `metadata` 进行严格清洗：
1.  **序列化检查**：尝试 `JSON.stringify`。
2.  **循环引用保护**：若失败，替换为错误占位符。
3.  **大小截断**：若长度超过 **10,000 字符**，自动截断并标记 `[TRUNCATED]`，防止阻塞主线程或撑爆存储。

### 关键函数
*   `addLog(level, module, action, details)`: 核心写入，包含修剪队列与安全检查。
*   `getLogs()`: 读取所有日志供 UI 展示 (Admin Dashboard -> Logs Panel)。
*   `clearLogs()`: 一键清空本地日志缓存。
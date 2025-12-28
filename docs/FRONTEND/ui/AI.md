
# AI 智能服务组件详解

---

### 目录
*   **1 [智能问答助手 (AskAI)](#ask-ai)**
    *   功能：基于角色的智能聊天系统，支持病历查询、药品库存咨询及科室推荐。
    *   文件：`components/AskAI.tsx`
*   **2 [医学影像 AI 诊断助手 (RadiologyAI)](#radiology-ai)**
    *   功能：多模态影像识别（X光/CT/MRI），支持多模型集成分析与结构化诊断报告。
    *   文件：`components/RadiologyAI.tsx`

---

## <a id="ask-ai"></a>1. components/AskAI.tsx (智能问答助手)

### 功能定位
*   **全角色覆盖**：为患者、医生和管理员提供统一的智能问答入口。
*   **业务信息查询**：支持通过自然语言查询医院信息、病历细节、药品库存及科室推荐。
*   **个性化交互**：根据用户角色的不同（Patient/Doctor/Admin），提供差异化的初始问候语和数据访问深度。
*   **动态配置**：用户可实时修改 AI 提供商（Gemini/OpenAI 等）、模型名称及 API Key。

### 业务逻辑
1.  **角色感知初始化**
    *   通过 `useEffect` 调用 `authService.getCurrentUser()` 获取当前登录用户。
    *   加载特定角色的问候语（例如：为患者提供就医指南，为医生提供临床辅助）。
2.  **上下文构建 (Context Injection)**
    *   在发送消息前，根据用户角色从 `apiService` 获取相关联的数据。
    *   医生与管理员请求会包含更广泛的数据上下文；患者请求则侧重于个人信息和通用科室信息。
3.  **配置持久化**
    *   AI 配置信息存储在 `localStorage` 中。组件加载时自动恢复，修改时同步写入。
4.  **交互处理**
    *   支持文本输入、键盘快捷发送 (`Enter`)，并实现聊天窗口自动滚动至底部 (`scrollToBottom`)。

### 核心函数

| 函数名 | 作用 |
| :--- | :--- |
| `useEffect` | 初始化加载：获取用户角色、问候语及 localStorage 中的 AI 配置。 |
| `handleSend` | 核心逻辑：封装用户消息，构建角色上下文，调用 AI 服务并更新消息列表。 |
| `handleProviderChange` | 配置管理：切换 AI 厂商，并根据预置模板自动填充默认模型和 Base URL。 |
| `saveConfig` | 持久化：将当前的 API 配置信息保存至本地存储。 |
| `chatWithAI` | 通信层：调用 aiService 的接口，向选定的 AI 模型发起请求。 |

### 数据流
1.  **输入**：用户输入文本消息 (userMsg)。
2.  **加工**：handleSend 根据角色获取 apiService 数据，组装成系统上下文提示词。
3.  **请求**：调用 aiService.chatWithAI。
4.  **展示**：AI 响应返回后，更新 messages 状态数组，触发 UI 渲染。

### 依赖
*   **Service**: aiService (逻辑核心), authService (角色获取), apiService (上下文数据)。
*   **Utility**: logger (记录配置变更), lucide-react (界面图标)。

---

## <a id="radiology-ai"></a>2. components/RadiologyAI.tsx (医学影像 AI 诊断助手)

### 功能定位
*   **多模态识别**：支持 X 光、CT 扫描、MRI 磁共振及超声等多种格式影像上传。
*   **模型适配器**：集成 Google Gemini、GPT-4o、DeepSeek 及豆包等多厂商视觉模型。
*   **自动化报告**：AI 自动输出包含模态识别、病灶检测及初步诊断建议的 Markdown 结构化报告。
*   **灵活配置**：支持在前端动态调整 Base URL、Model Name 和 API Key，适配各种中转 API。

### 业务逻辑
1.  **影像数据预处理**
    *   用户选择文件后，通过 fileToGenerativePart 将图片转换为 Base64 格式。
    *   分离预览用的 Data URI 和 API 请求用的纯 Base64 数据字符串。
2.  **AI 配置路由**
    *   根据选定的 Provider，组件会从 DEFAULT_CONFIGS 中拉取默认参数。
    *   所有配置通过 saveConfig 持久化，确保刷新页面后无需重复配置。
3.  **结构化提示词工程**
    *   runAnalysis 构建专门的医学影像提示词，要求模型以中文、专业视角、分点列出的 Markdown 格式输出。
4.  **故障回退与反馈**
    *   若选定的模型不支持视觉（如 DeepSeek 标准版），组件会捕获异常并通过界面提示用户更换模型。

### 核心函数

| 函数名 | 作用 |
| :--- | :--- |
| `handleFileChange` | 文件处理器：校验格式，读取文件流并生成 Base64 预览及传输数据起。 |
| `runAnalysis` | 任务控制器：负责 Loading 状态切换、异常捕获、API 请求发起及结果渲染。 |
| `handleProviderChange` | 状态处理器：切换厂商时重置配置模板，减少用户手动输入量。 |
| `saveConfig` | 存储处理器：将敏感的 Key 及配置项写入本地缓存。 |

### 数据流
1.  **输入**：用户上传本地图片文件。
2.  **转换**：FileReader 异步读取 -> Base64 状态 (selectedImage, base64ForApi)。
3.  **请求**：点击分析 -> 构建 Prompt -> 调用 aiService.analyzeMedicalImage。
4.  **结果**：AI 返回 Markdown 文本 -> analysis 状态更新 -> 报告栏渲染展示。

### 依赖
*   **Service**: aiService (核心适配层), logger (操作审计)。
*   **Library**: lucide-react (界面 UI 元素)。

# MedData Hub - 前端架构设计总纲 (System Architecture)

本文档描述了 MedData Hub 前端项目的顶层架构设计、技术选型以及核心设计模式。

> **详细子文档导航**：
> *   **逻辑层细节**：请查阅 [核心服务逻辑 (Services Logic)](./SERVICES_LOGIC.md)
> *   **UI 组件细节**：请查阅 `docs/ui/` 目录下对应的业务文档 ([CORE](./ui/CORE.md), [CLINICAL](./ui/CLINICAL.md), [ADMIN](./ui/ADMIN.md) ,[PATIENT](./ui/PATIENT.md) ,[AI](./ui/AI.md),)。

---

## 1. 技术栈概览 (Tech Stack)

本项目基于现代 React 生态构建，强调高性能、类型安全与开发体验。

| 领域 | 选型 | 说明 |
| :--- | :--- | :--- |
| **核心框架** | **React 19** | 利用最新的 Hooks、Concurrent Mode 与并发特性。 |
| **开发语言** | **TypeScript 5.x** | 全局强类型约束，提升代码健壮性与重构安全性。 |
| **构建工具** | **Vite** | 提供极速的冷启动（HMR）与优化的生产环境打包。 |
| **路由管理** | **React Router v6** | 实现单页应用（SPA）的客户端路由与导航守卫。 |
| **样式方案** | **Tailwind CSS** | 原子化 CSS 框架，快速构建响应式界面。 |
| **图标库** | **Lucide React** | 统一风格的 SVG 图标组件。 |
| **图表可视化** | **Recharts** | 基于 React 组件的声明式图表库，用于数据大屏。 |
| **AI 集成** | **Google GenAI SDK** | 用于直接与 Gemini 模型交互，另支持 Fetch 调用 OpenAI 格式接口。 |

---

## 2. 系统设计模式 (Design Patterns)

本项目采用了三种核心设计模式来应对业务需求：

### 2.1 混合数据层模式 (Hybrid Data Layer Strategy)
为了解决演示环境的不稳定性以及离线展示需求，系统实现了一套“**API 优先，本地兜底**”的数据策略。
*   **机制**：所有数据请求通过 `mockDb.ts` 网关。
*   **流程**：优先尝试连接真实的 Python 后端 -> 若连接失败（网络错误/服务未启动），自动降级读取浏览器 `localStorage` 中的 Mock 数据。
*   **持久化**：在 Mock 模式下，增删改操作会写入 `localStorage`，模拟数据库持久化行为。

### 2.2 适配器模式 (Adapter Pattern) - AI 网关
为了屏蔽不同 AI 厂商（Google Gemini, OpenAI, DeepSeek）的接口差异，系统在 `aiService.ts` 实现了适配器层。
*   **统一接口**：UI 组件只需调用标准的 `chatWithAI(prompt, context)` 或 `analyzeImage(file)`。
*   **内部实现**：Service 层根据配置，自动选择调用 Google SDK 还是标准的 REST API，并处理参数格式转换。

### 2.3 基于角色的访问控制 (RBAC)
安全架构基于三种角色：**Patient (患者)**、**Doctor (医生)**、**Admin (管理员)**。
*   **路由守卫**：高阶组件 `RequireAuth` 拦截所有路由跳转，验证 Session 有效性及角色权限。
*   **动态菜单**：侧边栏 (`Layout`) 根据当前用户角色动态渲染可见菜单项。

---

## 3. 目录结构说明 (Directory Structure)

项目遵循功能模块化与分层架构原则：

```text
meddata_hub/
├── components/          # UI 展示层 (按业务拆分)
│   ├── ...              # 具体组件代码 (详见 docs/ui/*.md)
├── services/            # 核心业务逻辑层
│   ├── mockDb.ts        # 数据网关 & Mock 引擎
│   ├── authService.ts   # 认证与 Session 管理
│   ├── aiService.ts     # AI 模型适配器
│   └── logger.ts        # 本地日志系统
├── App.tsx              # 根组件与路由配置
└── index.tsx             # 应用入口
```

---

## 4. 数据流向与依赖关系 (Data Flow)

### 4.1 系统上下文交互图
```mermaid
graph TD
    User((用户)) --> UI[React Components]
    
    subgraph Frontend_App
        UI --> ServiceLayer{Services Layer}
        
        subgraph Services
            Auth[authService]
            Data[mockDb]
            AI[aiService]
            Logger[logger]
        end
        
        ServiceLayer --> LocalStore[(localStorage)]
    end
    
    ServiceLayer -->|HTTP Request| Backend[Python API Server]
    ServiceLayer -->|SDK/API| AI_Cloud[Gemini / OpenAI / DeepSeek]
    
    Backend -.->|Fail/Offline| LocalStore
    note[Mock模式: API不可用时<br/>读写本地存储] -.-> LocalStore
```

### 4.2 模块依赖关系图
展示了主要模块之间的层级调用关系：

```mermaid
graph TD
    %% 核心层级
    Types[Shared Types]
    
    %% 服务层依赖
    Logger --> Types
    MockDb --> Logger & Types
    Auth --> MockDb & Logger & Types
    AIService --> Logger & Types

    %% UI 业务域依赖
    subgraph UI_Domains
        Core[CORE: App/Login] --> Auth
        Clinical[CLINICAL: Doctor/Records] --> MockDb & Auth
        Admin[ADMIN: Dashboard/Stats] --> MockDb
        Patient[PATIENT: Appointments] --> MockDb & Auth
        AI_UI[AI: Chat/Radiology] --> AIService
    end
```

---

## 5. 核心工作流时序 (Core Workflows)

### 5.1 启动与健康检查
1.  应用启动 (`index.tsx` -> `App.tsx`)。
2.  `Layout` 组件挂载。
3.  调用 `mockDb.checkBackendHealth()`。
    *   **Success**: 设置全局状态为 `Online`，Header 显示绿灯。
    *   **Fail**: 设置全局状态为 `Mock Mode`，Header 显示橙灯，启用本地数据源。

### 5.2 诊疗事务提交 (Example Transaction)
以医生提交病历为例，展示前端如何处理复杂事务：
1.  **UI 层 (`DoctorConsultation`)**: 收集表单数据 + 暂存处方列表。
2.  **调用**: `mockDb.saveMedicalRecord(record, prescriptions)`。
3.  **Service 层**:
    *   生成 Record ID 和 Prescription IDs。
    *   尝试 POST `/api/records` (包含嵌套数据)。
    *   若失败，写入 `localStorage` 中的 `records` 和 `prescriptions` 数组。
    *   同步扣减 `medicines` 表中的库存。
    *   调用 `logger.addLog` 记录审计日志。
4.  **UI 层**: 接收成功回调，清空表单，刷新队列。
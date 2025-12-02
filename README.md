
# MedData Hub - 全栈智能医疗数据平台

**MedData Hub** 是一个现代化的全栈医疗管理系统，结合了 **React 19 (Frontend)** 与 **Python Flask (Backend)** 的强大能力。

本项目采用独特的 **"混合架构" (Hybrid Architecture)** 设计：前端既支持连接真实的 MySQL 数据库进行企业级业务处理，也具备自动降级机制，在后端离线时无缝切换至本地 Mock 模式（基于 LocalStorage），确保系统演示的高可用性。此外，系统内置了基于 RAG（检索增强生成）的多模态 AI 助手。

---

## 🚀 核心特性 (Key Features)

### 1. 全栈业务闭环
*   **双模式数据层**：智能检测后端健康状态。
    *   **API 模式**：通过 RESTful API 连接 Python/MySQL 后端，支持事务处理、连接池管理。
    *   **Mock 模式**：后端断连时自动切换至前端模拟数据，演示零阻碍。
*   **复杂业务逻辑**：
    *   **事务控制**：病历提交与库存扣减原子化操作。
    *   **智能排班**：挂号时自动通过 SQL 聚合算法分配当前负载最低的医生。
    *   **高级查询**：包含相关子查询、关系除法（VIP患者识别）等复杂 SQL 实现。

### 2. 多模态 AI 赋能
*   **AI 网关**：统一封装 Google Gemini, DeepSeek, OpenAI 等接口。
*   **RAG 智能问答**：AI 自动读取当前数据库上下文（库存、排班），回答 "分析心内科接诊趋势" 等复杂问题。
*   **医学影像分析**：支持上传 X光/CT 影像，AI 识别解剖结构并提供辅助诊断。

### 3. 企业级管理功能
*   **RBAC 权限控制**：患者、医生、管理员三端视图隔离。
*   **全链路日志**：前端操作埋点 + 后端双向日志（文件/控制台），支持报文透视调试。
*   **数据大屏**：集成 Recharts 展示全院运营指标。

---

## 🏗️ 技术栈 (Tech Stack)

| 领域 | 技术选型 | 说明 |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript | 核心 UI 框架 |
| **Styling** | Tailwind CSS | 实用优先的 CSS 框架 |
| **Build Tool** | Vite | 极速构建工具 |
| **Backend** | Python 3, Flask | 轻量级 REST API 服务 |
| **Database** | MySQL 8.0+ | 关系型数据库 |
| **DB Driver** | mysql-connector-python | 原生驱动 (含连接池) |
| **AI SDK** | Google GenAI / Fetch API | 大模型接入 |

---

## 📂 项目结构 (Directory Structure)

```text
meddata-hub/
├── backend/                 # Python Flask 后端
│   ├── app.py               # 应用入口 (路由、业务逻辑)
│   ├── db_utils.py          # 数据库连接池配置
│   ├── app.log              # 运行时日志
│   ├── BACKEND_ARCHITECTURE.md  # 后端架构文档
│   ├── meddata_hub.sql      # MySQL脚本
│   └── ...
├── src/                     # React 前端源码
│   ├── components/          # 业务组件 (Dashboard, Consultation, etc.)
│   ├── services/            # 核心服务层
│   │   ├── mockDb.ts        # 混合数据层 (API/Mock 切换逻辑)
│   │   ├── aiService.ts     # AI 网关
│   │   ├── authService.ts   # 认证服务
│   │   └── logger.ts        # 前端日志
│   ├── types.ts             # TS 类型定义
│   ├── App.tsx              # 路由与布局
│   └── index.tsx             # 入口文件
├── FRONTEND_ARCHITECTURE.md # 前端架构文档
├── API_DOCUMENTATION.md     # 接口规范文档
└── README.md                # 项目说明书
```

---

## 🛠️ 安装与运行 (Setup Guide)

### 前置条件
*   Node.js (v18+) & Yarn
*   Python (v3.8+)
*   MySQL Server

### 1. 数据库配置 (Database Setup)
1.  创建数据库 `meddata_hub`。
2.  导入提供的 SQL 脚本（如包含建表语句）以初始化表结构（`patients`, `doctors`, `appointments`, `medical_records`, `medicines` 等）。
3.  修改 `backend/db_utils.py` 中的配置：
    ```python
    db_config = {
        "host": "localhost",
        "user": "root",
        "password": "YOUR_PASSWORD", # <--- 修改此处
        "database": "meddata_hub",
        ...
    }
    ```

### 2. 启动后端 (Backend)
```bash
cd backend
# 安装依赖
pip install flask mysql-connector-python flask-cors

# 启动服务 (默认端口 5000)
python app.py
```
*看见 `MedData Hub API is running...` 即表示启动成功。*

### 3. 启动前端 (Frontend)
```bash
# 回到项目根目录
yarn 
yarn dev
```
*访问浏览器显示的本地地址 (通常为 `http://localhost:3000`)。*

---

## 📖 使用指南 (Usage)

### 1. 登录账号 (Credentials)
系统根据角色提供不同的功能视图：

| 角色 | ID (Mock/DB) | 密码 | 权限范围 |
| :--- | :--- | :--- | :--- |
| **管理员** | `admin` | `admin123` | 仪表盘、库存管理、日志监控 |
| **医生** | `DOC001` (示例) | `password` | 接诊工作台、AI 辅助、开处方 |
| **患者** | `P001` (示例) | `password` | 自助挂号、病历查询、AI 导诊 |

*(注：非管理员账号需确保数据库或 Mock 数据中存在对应记录)*

### 2. 核心流程体验
1.  **挂号**：使用患者账号登录 -> "挂号大厅" -> 选择科室提交。
2.  **接诊**：使用医生账号登录 -> "工作台" -> 看到候诊队列 -> 点击叫号 -> 填写病历与处方 -> 提交（触发事务）。
3.  **AI 分析**：在 "智能问答" 页面，输入 "帮我总结一下今天内科的挂号情况"，AI 将读取系统实时数据回答。

---

## 🔌 API 接口概览

完整文档请参阅 [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)。

| 方法 | 端点 | 描述 |
| :--- | :--- | :--- |
| `POST` | `/api/login` | 用户认证 |
| `GET` | `/api/patients` | 获取患者列表 (含 VIP 逻辑) |
| `POST` | `/api/patients` | 注册新患者 |
| `GET` | `/api/doctors` | 获取医生列表 (含待诊数) |
| `POST` | `/api/appointments` | 提交挂号 (自动分配医生) |
| `POST` | `/api/records` | **提交病历 (数据库事务)** |

---

## 🛡️ 架构设计亮点

### 后端设计 (Python)
*   **连接池 (Pooling)**：使用 `mysql.connector.pooling` 管理 10 个连接，提升高并发下的响应速度。
*   **原子性事务**：在 `create_record` 接口中，病历写入与处方明细写入在同一事务中执行，失败自动回滚。
*   **SQL 技巧**：
    *   使用 `NOT EXISTS` 双重嵌套实现全称量词查询（查找去过所有科室的 VIP 患者）。
    *   使用相关子查询实时计算医生负载。

### 前端设计 (React)
*   **混合数据请求 (`fetchWithFallback`)**：
    ```typescript
    // 伪代码逻辑
    try {
      return await api.get('/patients'); // 尝试连接真实后端
    } catch (e) {
      console.warn('Backend offline, switching to Mock DB');
      return localStorage.getItem('patients'); // 自动降级
    }
    ```
*   **Context 注入**：在调用 LLM 时，前端会自动打包当前的业务数据（JSON 格式）注入 System Prompt，实现 "也就地 RAG"。

---

# MedData Hub

> **基于 React 19 + Python Flask 构建的全栈智能医院管理系统。**

<p align="center">
  <img src="https://img.shields.io/badge/React-19.0-blue?logo=react" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript" />
  <img src="https://img.shields.io/badge/Python-3.x-3776AB?logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/Flask-2.x-000000?logo=flask&logoColor=white" />
  <img src="https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-green" />
</p>

**MedData Hub** 是一个模拟现代化数字医院全流程的综合管理平台。项目采用前后端分离架构，集成了挂号分诊、电子病历、药房库存管理以及基于大模型的 AI 辅助诊断功能。

本项目采用 **"Hybrid Data Layer"（混合数据层）** 设计：前端支持连接真实的 Python 后端 API，亦可在无后端环境下通过本地 Mock 引擎全功能运行，实现演示环境 100% 可用。

---

## 核心特性 (Key Features)

### 🖥️ 前端交互 (Frontend)
*   **混合架构**: “API 优先，Mock 兜底”策略，确保演示稳定性。
*   **严格权限控制 (RBAC)**: 患者/医生/管理员三级权限体系，视图与操作完全隔离。
*   **AI 智能集成**:
    *   **影像诊断**: 集成多模态模型，支持 X 光/CT 片 AI 分析。
    *   **RAG 问答**: 基于医院数据的上下文增强对话助手。
*   **数据可视化**: 动态桑基图 (Sankey Diagram) 展示患者流转，运营数据大屏。

### ⚙️ 后端架构 (Backend)
*   **模块化单体 (Modular Monolith)**: 基于 Flask Blueprint 实现业务领域（Auth, Patient, Doctor 等）的物理隔离。
*   **复杂业务逻辑**:
    *   **事务脚本模式**: 确保病历写入与库存扣减的原子性。
    *   **高级 SQL 查询**: 实现相关子查询统计、双重 `NOT EXISTS` 筛选 VIP 患者等复杂逻辑。
*   **RESTful API**: 清晰的接口定义，屏蔽底层复杂的数据库表结构。

---

## 项目文档 (Documentation)

本项目包含详尽的全栈架构与逻辑说明文档。

### 🏗️ 系统架构
*   **[前端架构设计](./docs/FRONTEND_ARCHITECTURE.md)**: 技术选型、混合数据层模式及核心依赖。
*   **[后端架构设计](./docs/BACKEND_ARCHITECTURE.md)**: 蓝图设计、应用工厂模式及核心设计模式说明。
*   **[API 接口文档](./docs/API_DOCUMENTATION.md)**: 包含认证、挂号、病历、统计等全量接口说明。

### 📘 逻辑与组件
*   **[前端核心逻辑](./docs/SERVICES_LOGIC.md)**: Mock 引擎、Auth 流程及 AI 适配器。
*   **UI 组件手册**:
    *   [核心基础 (Core)](./docs/ui/CORE.md) | [临床业务 (Clinical)](./docs/ui/CLINICAL.md)
    *   [患者服务 (Patient)](./docs/ui/PATIENT.md) | [后台管理 (Admin)](./docs/ui/ADMIN.md)

---

## 快速开始 (Getting Started)

### 1. 环境准备
*   Node.js (v18+) & Yarn
*   Python (3.8+)
*   MySQL (8.0+)

### 2. 克隆项目
```bash
git clone https://github.com/heavey0027/meddata-hub.git
cd meddata-hub
```

### 3. 后端启动 (Backend)
确保 MySQL 服务已启动并创建好对应数据库。

```bash
# 进入后端目录
cd backend

# 安装依赖
pip install -r requirements.txt

# 配置数据库连接 (编辑 app/utils/db.py 或环境变量)
# ...

# 启动服务
python run.py
```
*后端服务默认运行在 `http://localhost:5000`*

### 4. 前端启动 (Frontend)

```bash
# 回到项目根目录
cd ..

# 安装依赖
yarn

# 启动开发服务器
yarn dev
```
*访问 `http://localhost:5173` (Vite 默认端口) 即可体验。*

> **提示**: 如果未启动后端，前端会自动检测并切换至 **Mock 模式**，您依然可以体验所有功能。

---

## 测试账号 (Demo Credentials)

系统内置 Mock 数据与后端种子数据保持一致：

| 角色 | 用户名 / ID | 密码 | 权限描述 |
| :--- | :--- | :--- | :--- |
| **管理员** | `admin` | `admin123` | 全局管理、数据大屏、日志监控、资源管理 |
| **医生** | `DOC01` | `password` | 接诊台、查看队列、开具处方、病历查询 |
| **患者** | `P001` | `password` | 自助挂号、查看个人病历、AI 问答 |

---

## 技术栈详情 (Tech Stack)

### Frontend
*   **Core**: React 19, TypeScript
*   **Build**: Vite
*   **Style**: Tailwind CSS, Lucide React
*   **State**: React Hooks, Context API
*   **AI**: Google GenAI SDK

### Backend
*   **Framework**: Python Flask (Blueprints, App Factory)
*   **Database**: MySQL (mysql-connector-python)
*   **Patterns**: Transaction Script, Singleton (DB Pool), Facade
*   **Utilities**: Flask-CORS, Python Logging

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
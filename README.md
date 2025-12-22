
# MedData Hub

> **基于 React 19 + TypeScript 构建的智能医院管理系统前端。**

<p align="center">
  <img src="https://img.shields.io/badge/React-19.0-blue?logo=react" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript" />
  <img src="https://img.shields.io/badge/Build-Vite-yellow?logo=vite" />
  <img src="https://img.shields.io/badge/Style-Tailwind-38bdf8?logo=tailwindcss" />
  <img src="https://img.shields.io/badge/License-MIT-green" />
</p>


**MedData Hub** 是一个模拟现代化数字医院全流程的单页应用（SPA）。它集成了挂号分诊、电子病历、药房库存管理以及基于大模型的 AI 辅助诊断功能。

本项目采用 **"Hybrid Data Layer"（混合数据层）** 设计，支持连接真实后端 API，亦可在无后端环境下通过本地 Mock 引擎全功能运行。

---

## 核心特性 (Key Features)

*   **混合数据架构 (Hybrid Architecture)**: 采用“API 优先，Mock 兜底”策略。后端服务不可用时，自动降级至浏览器 LocalStorage，确保演示环境 100% 可用。
*   **严格的角色权限 (RBAC)**: 内置 **患者 (Patient)**、**医生 (Doctor)**、**管理员 (Admin)** 三级权限体系，不同角色拥有独立的视图和操作权限。
*   **AI 智能集成**:
    *   **影像诊断**: 集成多模态模型（Gemini/OpenAI），支持上传 X 光/CT 片进行 AI 辅助分析。
    *   **RAG 问答助手**: 基于医院库存与病历数据的上下文增强对话。
*   **数据可视化**: 包含动态桑基图 (Sankey Diagram) 展示患者流转路径，以及多维度运营数据大屏。
*   **现代化技术栈**: 使用 React 19 并发特性、TypeScript 强类型约束及 Tailwind CSS 原子化样式。

---

## 项目文档 (Documentation)

本项目包含详尽的架构与逻辑说明文档，位于 `docs/` 目录下。

### [架构设计 (System Architecture)](./docs/FRONTEND_ARCHITECTURE.md)
> **必读**。包含技术选型、混合数据层模式、适配器模式设计以及核心模块依赖关系图。

### [核心逻辑 (Services Logic)](./docs/SERVICES_LOGIC.md)
> 详解 `services/` 层逻辑，包括 Mock 引擎实现、Auth 认证流程及 AI 接口适配器。

### UI 组件手册 (UI Components)
按业务领域拆分的组件逻辑详解：
*   [**核心基础 (Core)**](./docs/ui/CORE.md): 路由、布局与登录。
*   [**临床业务 (Clinical)**](./docs/ui/CLINICAL.md): 医生接诊台、电子病历管理。
*   [**患者服务 (Patient)**](./docs/ui/PATIENT.md): 自助挂号与预约中心。
*   [**后台管理 (Admin)**](./docs/ui/ADMIN.md): 仪表盘、库存管理与日志监控。
*   [**AI 智能 (Intelligence)**](./docs/ui/AI.md): 问答助手与影像分析组件。

---

## 快速开始 (Getting Started)

### 1. 环境准备

确保你的环境已安装 Node.js (v18+) 和 npm/yarn。

### 2. 安装依赖

```bash
git clone https://github.com/heavey0027/meddata-hub.git
cd meddata-hub
yarn
```

### 3. 启动开发服务器

```bash
yarn dev
```

打开浏览器访问 `http://localhost:5000` 即可。

---

## 测试账号 (Demo Credentials)

由于系统内置 Mock 引擎，无需启动后端即可直接登录体验：

| 角色 | 用户名 / ID | 密码 | 权限描述 |
| :--- | :--- | :--- | :--- |
| **管理员** | `admin` | `admin123` | 全局管理、数据大屏、日志监控、资源管理 |
| **医生** | `D01` | `123456` | 接诊台、查看队列、开具处方、病历查询 |
| **患者** | `P01` | `123456` | 自助挂号、查看个人病历、AI 问答 |

> *注：医生 ID 和患者 ID 可在管理员登录后的列表中查看更多。*

---

## 技术栈详情

*   **Core**: React 19, TypeScript
*   **Build**: Vite
*   **Styling**: Tailwind CSS, Lucide React (Icons)
*   **Charts**: Recharts
*   **State/Router**: React Router DOM, React Hooks
*   **AI SDK**: Google GenAI SDK

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
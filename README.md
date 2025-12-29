
# MedData Hub

<p align="center">
  <img src="./frontend/public/MedData_Hub.png" alt="MedData Hub Cover" width="100%" />
</p>

> **基于 React 19 + Python Flask 构建的全栈智能医院管理系统。**

<p align="center">
  <img src="https://img.shields.io/badge/React-19.0-blue?logo=react" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript" />
  <img src="https://img.shields.io/badge/Python-3.x-3776AB?logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/Flask-2.x-000000?logo=flask&logoColor=white" />
  <img src="https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-Enabled-2496ED?logo=docker&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-green" />
</p>

**MedData Hub** 是一个模拟现代化数字医院全流程的综合管理平台。项目采用前后端分离架构，集成了挂号分诊、电子病历、药房库存管理以及基于大模型的 AI 辅助诊断功能，并支持**全栈 Docker 容器化部署**。

---

## 核心特性 (Key Features)

### 前端交互 (Frontend)
*   **现代化架构**: 采用 React 19 + TypeScript 构建，利用客户端聚合模式优化数据交互。
*   **严格权限控制 (RBAC)**: 患者/医生/管理员三级权限体系，视图与操作完全隔离。
*   **AI 智能集成**:
    *   **影像诊断**: 集成多模态模型，支持 X 光/CT 片 AI 分析。
    *   **RAG 问答**: 基于医院数据的上下文增强对话助手。
*   **数据可视化**: 动态桑基图 (Sankey Diagram) 展示患者流转，运营数据大屏。

### 后端架构 (Backend)
*   **模块化单体 (Modular Monolith)**: 基于 Flask Blueprint 实现业务领域（Auth, Patient, Doctor 等）的物理隔离。
*   **复杂业务逻辑**:
    *   **事务脚本模式**: 确保病历写入与库存扣减的原子性。
    *   **高级 SQL 查询**: 实现相关子查询统计、双重 `NOT EXISTS` 筛选 VIP 患者等复杂逻辑。
*   **RESTful API**: 清晰的接口定义，屏蔽底层复杂的数据库表结构。

### 部署与运维 (Deployment)
*   **Docker 容器化**: 提供完整的 `docker-compose` 配置，一键拉起 Frontend (Nginx), Backend (Gunicorn), Database (MySQL)。
*   **环境适配**: 支持本地开发与容器化部署无缝切换，内置 Nginx 反向代理解决跨域问题。

---

## 项目文档 (Documentation)

本项目包含详尽的全栈架构与逻辑说明文档。

### 系统架构
*   **[前端架构设计](./docs/FRONTEND/FRONTEND_ARCHITECTURE.md)**: 技术选型、系统设计模式及核心依赖。
*   **[后端架构设计](./docs/BACKEND/BACKEND_ARCHITECTURE.md)**: 蓝图设计、应用工厂模式及核心设计模式说明。
*   **[Docker 容器化配置](./docs/DOCKER_CONFIG.md)**: 容器编排架构、网络拓扑及环境变量适配详解。
*   **[API 接口文档](./docs/BACKEND/API_DOCUMENTATION.md)**: 包含认证、挂号、病历、统计等全量接口说明。

### 前端逻辑与组件
*   **[前端核心逻辑](./docs/FRONTEND/SERVICES_LOGIC.md)**: 核心服务层、Auth 流程及 AI 适配器。
*   **UI 组件手册**:
    *   [核心基础 (Core)](./docs/FRONTEND/ui/CORE.md) | [临床业务 (Clinical)](./docs/FRONTEND/ui/CLINICAL.md)
    *   [患者服务 (Patient)](./docs/FRONTEND/ui/PATIENT.md) | [后台管理 (Admin)](./docs/FRONTEND/ui/ADMIN.md)

### 后端逻辑与模块
* **核心文档**：
  * [应用启动流程（App Bootstrap）](./docs/BACKEND/核心文档/BACKEND_APP_BOOTSTRAP.md)
  * [后端文档总览（Summary）](./docs/BACKEND/核心文档/BACKEND_MODULES_SUMMARY.md)
* **业务模块文档**：
  * [认证 Auth](./docs/BACKEND/业务模块/BACKEND_API_AUTH.md) | [患者 Patient](./docs/BACKEND/业务模块/BACKEND_API_PATIENT.md)
  * [医生 Doctor](./docs/BACKEND/业务模块/BACKEND_API_DOCTOR.md) | [挂号 Appointment](./docs/BACKEND/业务模块/BACKEND_API_APPOINTMENT.md)
  * [病历 Record](./docs/BACKEND/业务模块/BACKEND_API_RECORD.md) | [基础数据 Basic](./docs/BACKEND/业务模块/BACKEND_API_BASIC.md)
  * [多模态 Multimodal](./docs/BACKEND/业务模块/BACKEND_API_MULTIMODAL.md) | [统计 Stats](./docs/BACKEND/业务模块/BACKEND_API_STATS.md)
* **系统辅助文档**：
  * [工具层 Utils](./docs/BACKEND/系统辅助/BACKEND_UTILS.md) | [数据初始化 Data Init](./docs/BACKEND/系统辅助/BACKEND_DATA_INIT.md)
  * [文件系统与多模态设计](./docs/BACKEND/系统辅助/BACKEND_DATA_FILES_AND_MULTIMODAL.md)
---

## 快速开始 (Getting Started)

### 方式一：Docker 一键部署 (推荐) 

无需安装 Python/Node/MySQL 环境，只需安装 Docker Desktop。

#### 1. 启动服务
在项目根目录下运行：
```bash
docker compose up -d
```

#### 2. 初始化数据
首次启动后，会自动插入数据，如需手动插入演示数据（医生、患者、药品、统计数据等）：
```bash
# 插入基础业务数据
docker exec -it meddata-api python insert_data_python/insert_data.py

# 插入多模态统计数据
docker exec -it meddata-api python insert_data_python/insert_multimodal.py
```

#### 3. 访问应用
浏览器访问：`http://localhost:1234`

*   **管理员**: `admin` / `admin123`
*   **医生**: `DOC001` / `123456`
*   **患者**: `P0001` / `123456`

---

### 方式二：本地开发模式 (Manual Setup) 

适用于需要修改代码的开发场景。

#### 1. 环境准备
*   Node.js (v18+) & Yarn
*   Python (3.8+)
*   MySQL (8.0+)

#### 2. 后端启动 (Backend)
确保本地 MySQL 服务已启动，并创建好 `meddata_hub` 数据库。

```bash
cd backend
pip install -r requirements.txt

# 启动 Flask 服务 (默认端口 5000)
python run.py
```

#### 3. 前端启动 (Frontend)
项目已配置 Vite Proxy，自动转发 `/api` 请求至本地后端。

```bash
cd .. # 回到根目录
yarn 
yarn dev
```
访问 `http://localhost:3000` 进行开发调试。

---

## 技术栈详情 (Tech Stack)

### Frontend
*   **Core**: React 19, TypeScript
*   **Build**: Vite (configured with Proxy)
*   **Style**: Tailwind CSS, Lucide React
*   **State**: React Hooks, Context API
*   **AI**: Google GenAI SDK

### Backend
*   **Framework**: Python Flask (Blueprints, App Factory)
*   **Database**: MySQL (mysql-connector-python)
*   **Patterns**: Transaction Script, Singleton (DB Pool), Facade
*   **Utilities**: Flask-CORS, Python Logging

### DevOps
*   **Container**: Docker, Docker Compose
*   **Proxy**: Nginx (Reverse Proxy)
*   **Server**: Gunicorn (WSGI HTTP Server)

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
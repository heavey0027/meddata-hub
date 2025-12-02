# MedData Hub 后端架构文档

## 1. 项目概述
本项目是一个基于 **Python Flask** 框架开发的医疗数据管理系统（MedData Hub）后端服务。它提供了一套 RESTful API，用于处理医院的挂号、病历管理、患者管理、医生排班以及药品库存管理等核心业务。

系统采用轻量级单体架构，核心特点包括**数据库连接池管理**、**事务控制**以及**复杂 SQL 业务逻辑实现**。

## 2. 技术栈 (Tech Stack)

| 组件 | 技术选型 | 说明 |
| :--- | :--- | :--- |
| **编程语言** | Python 3.x | 后端核心逻辑 |
| **Web 框架** | Flask | 轻量级 Web 服务器网关接口 |
| **数据库** | MySQL | 关系型数据库存储 |
| **数据库驱动** | mysql-connector-python | 官方驱动，使用 **Connection Pooling** |
| **跨域处理** | Flask-CORS | 解决前后端分离开发时的跨域问题 |
| **日志系统** | Python Logging | 集成控制台输出与文件持久化 (`app.log`) |

## 3. 系统架构设计

### 3.1 架构分层
虽然代码主要集中在 `app.py` 中，但在逻辑上遵循以下分层设计：

1.  **接口层 (Controller Layer)**: 由 Flask 的 `@app.route` 装饰器定义，负责接收 HTTP 请求、解析 JSON 参数及返回响应。
2.  **业务逻辑层 (Service Layer)**: 嵌入在路由函数中，负责业务规则校验（如：库存检查、重复挂号校验、自动分配医生）。
3.  **数据访问层 (DAO Layer)**: 通过原生 SQL 语句与数据库交互，直接操作游标（Cursor）。

### 3.2 目录结构
```text
.
├── app.py           # 应用程序入口，包含路由、业务逻辑和日志配置
├── db_utils.py      # 数据库工具模块，负责连接池配置与连接获取
├── app.log          # 运行时产生的日志文件
└── ...
```

## 4. 核心模块详解

### 4.1 数据库连接管理 (`db_utils.py`)
为了提高并发性能，系统实现了数据库连接池机制：
*   **连接池名称**: `medpool`
*   **池大小**: 10个连接
*   **事务模式**: `autocommit=False`（默认关闭自动提交，强制手动控制事务，确保数据一致性）。
*   **容错处理**: 封装了 `get_db_connection()` 函数，包含异常捕获机制。

### 4.2 日志系统
系统配置了双向日志输出，便于开发调试与生产监控：
*   **Console Handler**: 输出到控制台，实时查看。
*   **File Handler**: 输出到 `app.log`，用于持久化存储。
*   **日志内容**: 记录请求入口、SQL 查询结果数量、关键业务操作（如挂号、注册）、异常报错。

### 4.3 认证与权限 (Authentication)
采用基于角色的简单认证机制：
*   **管理员 (Admin)**: 硬编码认证 (`admin/admin123`)，拥有全局查看权限。
*   **医生/患者**: 基于数据库表 (`doctors`/`patients`) 进行 ID 和密码比对。
*   **Token**: 登录成功后返回标识 Token（格式：`token-{id}-{role}`）。

## 5. 关键业务逻辑与 SQL 实现

本项目不仅仅是简单的 CRUD，还包含多种高级数据库操作模式：

### 5.1 复杂查询 (Read Operations)
*   **相关子查询 (Correlated Subquery)**:
    *   *场景*: 获取医生列表时。
    *   *逻辑*: 同时计算每位医生当前待处理（pending）的挂号数量。
*   **关系除法/全称量词 (Relational Division)**:
    *   *场景*: 获取患者列表时。
    *   *逻辑*: 识别 "VIP患者" —— 定义为去过所有科室挂号的患者（使用双重 `NOT EXISTS` 实现）。
*   **多表连接 (Multi-table JOIN)**:
    *   *场景*: 获取病历和挂号记录。
    *   *逻辑*: 关联 `patients`, `doctors`, `departments` 表以获取完整名称信息。

### 5.2 事务处理 (Write Operations)
*   **病历提交事务 (Atomic Transaction)**:
    *   *接口*: `POST /api/records`
    *   *流程*:
        1.  `conn.start_transaction()`
        2.  插入主表 `medical_records`。
        3.  循环检查药品库存（若库存不足抛出异常）。
        4.  插入子表 `prescription_details`。
        5.  若全过程无错则 `commit()`，否则 `rollback()`。
*   **挂号与自动分配**:
    *   *接口*: `POST /api/appointments`
    *   *逻辑*:
        1.  **合法性校验**: 检查该患者在该科室是否已有未完成的挂号。
        2.  **负载均衡**: 若未指定医生，通过 `GROUP BY` 和 `ORDER BY COUNT` 自动分配给该科室当前挂号数最少的医生。

## 6. API 接口清单

| 方法 | 路径 | 描述 | 关键参数 |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/departments` | 获取所有科室 | 无 |
| **GET** | `/api/doctors` | 获取医生列表 | 含待诊人数统计 |
| **GET** | `/api/medicines` | 获取药品列表 | 无 |
| **GET** | `/api/patients` | 获取患者列表 | 含 VIP 状态计算 |
| **GET** | `/api/records` | 获取所有病历 | 关联患者与医生名 |
| **GET** | `/api/prescription_details` | 获取处方明细 | 无 |
| **GET** | `/api/appointments` | 获取挂号记录 | `role`, `date`, `doctor_id` |
| **POST** | `/api/patients` | 注册新患者 | `id`, `name`, `password`... |
| **PUT** | `/api/patients/<id>` | 更新患者信息 | `phone`, `address`... |
| **POST** | `/api/records` | **提交病历(事务)** | `record` 对象, `details` 数组 |
| **POST** | `/api/appointments` | 提交挂号 | `patientId`, `departmentId` |
| **PUT** | `/api/appointments/<id>` | 更新挂号状态 | `status` |
| **POST** | `/api/login` | 用户登录 | `id`, `password`, `role` |

## 7. 部署与运行

*   **运行环境**: 本地主机 (`localhost`).
*   **端口**: `5000`.
*   **启动方式**: 运行 `app.py` 的 `__main__` 模块。
*   **数据库配置**: 需在 `db_utils.py` 中修改 `password` 字段以匹配本地 MySQL 环境。

---
*文档生成时间: 2025-12-2*

# 临床业务组件详解

---

## 目录：

*   **1 [医生接诊台 / 挂号监控中心 (DoctorConsultation)](#1-componentsdoctorconsultationtsx-医生接诊台--挂号监控中心)**
    *   功能：工作流分治（医生/管理员）、叫号接诊、病历撰写及处方开具。
    *   文件：`components/DoctorConsultation.tsx`
*   **2 [患者综合管理中心 (PatientList)](#2-componentspatientlisttsx-患者综合管理中心)**
    *   功能：全院患者档案管理、快速建档、历史病历管理与分页检索。
    *   文件：`components/PatientList.tsx`
*   **3 [患者档案与就诊记录 (PatientHistory)](#3-componentspatienthistorytsx-患者档案与就诊记录)**
    *   功能：患者个人中心、全量诊疗时间轴、个人资料维护及账号注销。
    *   文件：`components/PatientHistory.tsx`

---

## 1. `components/DoctorConsultation.tsx` (医生接诊台 / 挂号监控中心)

### 功能定位
*   **角色分流视图**：根据登录角色（医生或管理员）提供差异化的 UI 逻辑。
*   **医生工作台**：
    *   提供挂号队列切换、FIFO（先进先出）叫号。
    *   集成电子病历撰写（主诉/诊断/方案）与电子处方开具（药品检索/用法设定）。
*   **管理员监控**：
    *   提供实时 KPI 看板（挂号数/候诊数）与趋势图表分析。
    *   支持按日期筛选查看全院挂号明细。

### 业务逻辑
1.  **自动轮询机制**
    *   组件通过 `setInterval` 每 10 秒调用 `loadQueueOnly`，确保医生端候诊队列与管理员端统计数据的实时性。
2.  **叫号与接诊逻辑**
    *   `handleCallNext`：从激活队列提取首位记录，执行 `invalidateCache` 强制刷新数据，验证患者存在性并加载其历史病历，锁定就诊上下文。
3.  **诊疗事务处理**
    *   **暂存区管理**：开药时使用 `prescriptionBuffer` 维护未提交的处方列表。
    *   **提交事务 (`handleSubmit`)**：执行表单校验，同时调用病历保存与挂号状态更新（PUT）接口，确保业务闭环。
4.  **统计聚合**
    *   管理员模式下，实时计算 `allAppointments` 中的 Pending 与 Completed 比例，驱动 `recharts` 饼图与柱状图展示。

### 核心函数

| 函数名 | 作用 |
| :--- | :--- |
| `loadQueueOnly` | 核心加载器：根据角色和日期筛选挂号列表并分类存储。 |
| `handleCallNext` | 叫号执行器：包含防错逻辑、数据预加载及审计日志记录。 |
| `handleSubmit` | 流程终结器：组装病历/处方数据，执行 API 调用并重置工作台。 |
| `addPrescriptionItem` | 状态管理器：向处方暂存区添加药品条目。 |
| `getTodayStr` | 工具函数：格式化当前日期，用于默认筛选和记录。 |

### 数据流
1.  **输入**：`apiService.getAppointments` 获取挂号单 -> 状态分流至 `myQueue` 或 `deptQueue`。
2.  **交互**：医生填写诊断及处方 -> 更新本地 State (`diagnosis`, `prescriptionBuffer`)。
3.  **输出**：提交操作 -> 调用 `saveMedicalRecord` 与 `updateAppointmentStatus` -> `logger.addLog` 记录。

---

## 2. `components/PatientList.tsx` (患者综合管理中心)

### 功能定位
*   **全院档案概览**：基于分页机制展示全量患者核心信息。
*   **档案生命周期管理**：支持患者档案的创建、编辑、以及管理员权限下的级联删除。
*   **病历快开系统**：支持在列表页直接发起接诊，完成病历撰写与多药品处方开具（含库存扣减逻辑模拟）。
*   **病历回溯**：弹窗展示患者全量历史就诊记录。

### 业务逻辑
1.  **分页与检索**
    *   利用 `LIMIT` 和 `offset` 控制 API 请求范围。`filteredPatients` 负责处理搜索框输入的实时匹配。
2.  **档案保存策略**
    *   `handleSavePatient` 兼容新增与更新模式。新增时自动生成 ID (`P + 序列`) 并设置默认安全凭证。
3.  **复合病历提交**
    *   `handleSaveRecord` 将前端暂存的处方数组转换为后端关联表所需的结构，执行病历与处方的统一持久化。
4.  **删除保护**
    *   患者及病历删除均设置二次确认，并针对关联数据（病历/挂号）提供警告。

### 核心函数

| 函数名 | 作用 |
| :--- | :--- |
| `loadData` | 数据并发加载：同步获取分页患者、医生及药品名录。 |
| `handleSavePatient` | 档案维护器：处理患者信息的持久化及 ID 生成。 |
| `handleSaveRecord` | 业务提交核心：涉及多表关联构建，是组件中最复杂的业务逻辑点。 |
| `viewRecords` | 详情加载器：按需获取选定患者的历史病历视图。 |

### 数据流
1.  **读取**：`getPatients` 分页请求 -> State (`patients`) -> 表格 UI。
2.  **修改**：Modal 表单输入 -> API (`createPatient`/`updatePatient`) -> 本地列表同步。
3.  **提交**：处方 Buffer -> `saveMedicalRecord` -> 触发日志审计。

---

## 3. `components/PatientHistory.tsx` (患者档案与就诊记录)

### 功能定位
*   **双模式自适应**：
    *   **患者模式**：展示个人空间，支持资料修改与账号注销。
    *   **管理模式**：提供检索入口，支持按 ID 或手机号查询全院任意患者。
*   **诊疗时间轴**：倒序展示历史就诊记录，嵌套展示详细处方清单。
*   **资料维护**：支持姓名、联系方式等基础信息的在线更新。
*   **账号注销保护**：提供严格的二次确认流程，支持全链路数据清除。

### 业务逻辑
1.  **权限感知查询**
    *   挂载时判断 `role`：若为 `'patient'`，则锁定查询 ID 为自身；若为医生，则启用搜索框。
2.  **链式数据拉取 (`loadHistory`)**
    *   先通过 `findPatientByQuery` 确认患者身份，再调用 `getFullPatientDetails` 获取其所有关联病历与处方明细。
3.  **个人资料更新**
    *   `handleUpdateProfile` 封装了 API 调用与本地 UI 的乐观更新，并记录操作日志。
4.  **注销流程控制**
    *   注销不仅删除数据库记录，还需执行 `authService.logout` 清除会话并强制重定向。

### 核心函数

| 函数名 | 作用 |
| :--- | :--- |
| `loadHistory` | 核心调度器：串行执行身份查找与全量病历拉取。 |
| `handleSearch` | 检索处理器：支持多维度关键词匹配。 |
| `handleUpdateProfile` | 资料更新核心：负责校验、持久化及状态同步。 |
| `handleDeleteAccount` | 终结逻辑：处理数据抹除、会话清理及路由重定向。 |

### 数据流
1.  **读取**：查询动作 -> `findPatientByQuery` -> 获取 ID -> `getFullPatientDetails` -> 状态 `history`。
2.  **更新**：用户修改资料 -> `updatePatient` -> 更新本地 `patient` 对象 -> `logger.addLog`。
3.  **删除**：用户注销 -> `deletePatient` -> `logout` 清理。

### 依赖
*   **数据层**: `apiService` (find/update/delete 接口)。
*   **认证层**: `authService` (角色判断、会话清理)。
*   **UI支持**: `react-dom` (createPortal 用于顶层模态框), `lucide-react` (图标)。
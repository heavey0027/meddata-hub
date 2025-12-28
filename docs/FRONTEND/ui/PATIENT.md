
# 患者服务组件详解

---

## 目录：患者服务组件 (`components/`)

*   **1 [挂号大厅 (AppointmentHall)](#appointment-hall)**
    *   功能：自助挂号表单、患者信息自动填充、科室与医生联动选择。
    *   文件：`components/AppointmentHall.tsx`
*   **2 [患者预约记录 (MyAppointments)](#my-appointments)**
    *   功能：个人预约历史追踪、状态实时可视化、预约取消操作。
    *   文件：`components/MyAppointments.tsx`

---

## <a id="appointment-hall"></a>1. `components/AppointmentHall.tsx` (挂号大厅)

### 功能定位
*   **自助挂号服务**：提供标准化的挂号申请表单，采集患者基本信息、挂号科室、指定医生及病症描述。
*   **信息自动填充**：识别当前登录用户身份。若为已登录患者，系统会自动加载并锁定其档案信息，减少重复录入。
*   **医生联动筛选**：根据选定的科室动态过滤医生列表，支持指定专家或系统随机分配。
*   **挂号事务创建**：验证通过后生成挂号请求，并将其状态初始化为候诊状态。

### 业务逻辑
1.  **静默数据初始化**
    *   组件挂载时，并行请求科室列表与医生列表。
    *   **患者模式逻辑**：若检测到当前角色为 `patient`，立即调用 `findPatientByQuery` 获取详细档案（年龄、性别、电话等），并将其作为表单默认值，同时将这些字段设为只读。
2.  **联动过滤逻辑**
    *   监听科室选择框的变化。当用户选定某一科室时，界面会动态筛选出所属该科室的医生供用户选择。
3.  **表单验证与提交**
    *   `handleSubmit` 负责最终校验：确保姓名、联系电话、科室及病情主诉不为空。
    *   校验通过后，构造挂号对象并将 `status` 设为 `pending`。
4.  **反馈机制**
    *   提交成功后，重置除自动填充字段外的其他表单项，并向用户展示成功提示。

### 核心函数

| 函数名 | 作用 |
| :--- | :--- |
| `useEffect` | 生命周期调度：初始化基础数据，并针对患者角色执行档案预加载。 |
| `handleSubmit` | 业务提交处理器：执行表单校验、构建挂号实体并调用 API。 |
| `createAppointment` | 数据持久化接口：将挂号信息发送至后端/模拟数据库。 |
| `findPatientByQuery` | 档案查询工具：通过用户 ID 反向检索患者详细信息。 |

### 数据流
1.  **数据采集**：用户输入病情或从下拉菜单选择科室/医生。
2.  **实体构建**：在 `handleSubmit` 中整合用户输入与当前用户 Session 信息。
3.  **后端交互**：调用 `apiService.createAppointment` 执行 POST 请求。
4.  **UI 反馈**：根据 API 响应结果展示成功弹窗或错误警告。

### 依赖库
*   **Data**: `apiService` (getDepartments, getDoctors, createAppointment)。
*   **Auth**: `authService` (getCurrentUser)。
*   **Icons**: `lucide-react`。

---

## <a id="my-appointments"></a>2. `components/MyAppointments.tsx` (患者预约记录)

### 功能定位
*   **个人历史看板**：专为患者设计，仅展示与其本人关联的挂号记录。
*   **状态全生命周期追踪**：通过颜色编码和标签直观展示预约处于“候诊中”、“已完成”还是“已取消”。
*   **自助预约取消**：针对尚未接诊（Pending）的预约，提供撤销功能。
*   **数据倒序排列**：自动将最近创建的预约置于首位。

### 业务逻辑
1.  **数据隔离与安全**
    *   调用 `getAppointments` 时，强制注入当前登录用户的 `id` 作为过滤参数。这一逻辑在前端确保了数据访问的私密性。
2.  **前端排序处理**
    *   接收到原始数据后，通过 `createTime` 字段执行降序排列，保证列表的时效性展示。
3.  **状态映射逻辑**
    *   `getStatusBadge` 根据 `status` 字段值映射不同的样式类名：
        *   `pending`：黄色背景（提示等待中）。
        *   `completed`：绿色背景（提示流程结束）。
        *   `cancelled`：灰色背景（提示已作废）。
4.  **取消动作约束**
    *   在渲染表格行时进行条件判断：仅当状态为 `pending` 时显示取消按钮。
    *   `handleCancel` 包含二次确认交互，避免误操作。取消后调用 `updateAppointmentStatus` 并触发列表重新加载。

### 核心函数

| 函数名 | 作用 |
| :--- | :--- |
| `loadData` | 数据中心：负责拉取、排序并存储当前患者的预约记录。 |
| `handleCancel` | 交互控制器：处理取消请求的确认、API 发起及视图刷新。 |
| `getStatusBadge` | UI 转换器：将后台状态代码转换为具有语义化颜色的标签组件。 |

### 数据流
1.  **读取流**：`authService` (获取 ID) -> `apiService.getAppointments(filter)` -> State (`appointments`) -> 排序 -> UI 表格。
2.  **交互流**：用户触发取消 -> 弹出 Confirm -> 调用 `updateAppointmentStatus` (PUT) -> 执行 `loadData` 重刷列表。

### 依赖库
*   **Data**: `apiService` (getAppointments, updateAppointmentStatus)。
*   **Auth**: `authService` (getCurrentUser)。
*   **Icons**: `lucide-react` (Clock, CheckCircle, Ban)。
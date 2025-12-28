
# 管理员面板与可视化组件详解

---

## 目录：

*   **1 [仪表盘 (Dashboard)](#1-componentsdashboardtsx-仪表盘)**
    *   功能：核心 KPI 展示、科室接诊量图表、快捷导航。
    *   文件：`components/Dashboard.tsx`
*   **2 [运营数据分析大屏 (PatientStats)](#2-componentspatientstatstsx-运营数据分析大屏)**
    *   功能：半年度趋势折线图、挂号热度面积图、全流程桑基图 (Sankey)。
    *   文件：`components/PatientStats.tsx`
*   **3 [医院资源管理 (Resources)](#3-componentsresourcestsx-医院资源管理)**
    *   功能：资源模块集成（Tab 页）、科室管理、路由状态联动。
    *   文件：`components/Resources.tsx`
*   **4 [医生名录管理 (DoctorList)](#4-componentsdoctorlisttsx-医生名录管理)**
    *   功能：医生信息增删改查、多维度实时筛选、候诊状态监控。
    *   文件：`components/DoctorList.tsx`
*   **5 [药品库存管理 (MedicineInventory)](#5-componentsmedicineinventorytsx-药品库存管理)**
    *   功能：库存列表、低库存智能预警、药品检索与维护。
    *   文件：`components/MedicineInventory.tsx`
*   **6 [多模态数据中心 (MultimodalManager)](#6-componentsmultimodalmanagertsx-多模态数据中心)**
    *   功能：影像/音视频/文档上传、格式分类、多态智能预览。
    *   文件：`components/MultimodalManager.tsx`
*   **7 [系统日志监控 (SystemLogs)](#7-componentssystemlogstsx-系统日志监控)**
    *   功能：实时日志轮询、错误分级显示、JSON 元数据调试。
    *   文件：`components/SystemLogs.tsx`

---

## 1. `components/Dashboard.tsx` (仪表盘)

### 功能概述
*   **核心指标展示**：显示医院关键 KPI，包括患者总数、累计就诊次数、在职医生数量和药品种类。
*   **可视化图表**：
    *   **科室接诊量**：使用柱状图展示。
    *   **疾病诊断分布**：使用饼状图展示 Top 5 疾病数据。
*   **详情面板切换**：支持在“最近病历”、“药品库存预警”、“医生概览”三个维度间切换查看。
*   **快速导航**：提供从概览数据直接跳转到对应管理页面的入口。

### 内部逻辑
1.  **数据初始化**
    *   组件挂载时，通过 `useEffect` 调用 `getStats` 获取全局统计数据并存入 `stats` 状态。
2.  **标签页交互 (Tab Switching)**
    *   维护 `activeTab` 状态。用户点击切换标签后，界面下方的内容区域根据状态动态渲染对应的列表或图表。
3.  **路由导航策略**
    *   **`handleViewMore`**：根据当前 `activeTab` 决定跳转路径：
        *   `records` → 跳转至患者管理页面。
        *   `medicines` → 跳转至资源管理页面（自动定位到库存 Tab）。
        *   `doctors` → 跳转至资源管理页面（自动定位到医生 Tab）。
4.  **动态渲染**
    *   KPI 卡片组件 (`StatCard`) 根据传入的数据和图标类型进行标准化渲染。

### 核心函数

| 函数名 | 作用 |
| :--- | :--- |
| `useEffect` | 生命周期钩子，用于页面加载时获取统计数据。 |
| `handleViewMore` | 路由跳转控制器，根据当前上下文导航至详情页。 |
| `getButtonText` | 根据当前标签页状态返回动态的按钮文本（如“管理患者档案”）。 |
| `StatCard` | 子组件，负责渲染单个 KPI 指标卡片。 |

### 数据流
1.  **获取**：`apiService.getStats()` → 组件 State (`stats`)。
2.  **展示**：根据 `activeTab` 选择性渲染 `recharts` 图表或列表组件。
3.  **导航**：用户点击“查看更多” → 触发 `handleViewMore` → `useNavigate` 执行跳转。

### 依赖
*   **Data**: `apiService` (getStats)
*   **Routing**: `react-router-dom` (useNavigate)
*   **Icons**: `lucide-react`
*   **Charts**: `recharts` (BarChart, PieChart)

---

## 2. `components/PatientStats.tsx` (运营数据分析大屏)

### 功能概述
*   **半年度趋势分析**：双线折线图，对比“建档数”与“实际就诊人次”的走势。
*   **KPI 月度看板**：展示选定月份的核心指标，并计算环比增长率（红/绿箭头标识）。
*   **挂号热度分析**：面积图展示 00:00 - 23:00 的流量分布，支持日/月/年多维度筛选。
*   **全流程桑基图 (Sankey)**：定制化的阶梯式流向图，可视化“挂号 -> 科室 -> 诊断 -> 治疗”的转化路径。
*   **患者画像**：包含性别分布（饼图）、年龄结构（条形图）及疾病排名（柱状图）。

### 内部逻辑
1.  **多源数据聚合**
    *   初始化时并行请求：基础画像 (`getPatientDemographics`)、全流程数据 (`getSankeyData`) 和趋势数据 (`loadSixMonthTrend`)。
2.  **桑基图定制算法**
    *   **`getVerticalShift`**：核心布局算法。根据节点的 X 轴坐标（代表流程阶段），计算递增的 Y 轴偏移量 (0 -> 80 -> 160 -> 240)，强制形成“阶梯下沉”视觉效果。
    *   **SVG 重绘**：重写 `MyCustomNode` 和 `MyCustomLink`，计算贝塞尔曲线控制点以适配偏移后的节点。
3.  **时间维度切换**
    *   `handleScopeChange` 处理日/月/年/全部四种模式。切换时重置时间锚点，并触发 `getAppointmentStatistics` 重新计算热度。
4.  **趋势数据构建**
    *   `loadSixMonthTrend` 动态生成过去 6 个月的月份 Key，并发请求每月数据组装成图表格式。

### 核心函数

| 函数名 | 作用 |
| :--- | :--- |
| `loadSixMonthTrend` | 计算并获取半年度趋势数据，驱动折线图渲染。 |
| `transformSankeyData` | 将原始数据转换为 Sankey 组件所需的节点索引格式。 |
| `getVerticalShift` | 布局算法核心，决定桑基图每一列的下沉深度。 |
| `handleScopeChange` | 处理挂号热度图表的时间筛选逻辑。 |

### 数据流
1.  **KPI & 趋势**：`loadSixMonthTrend` → 6次 API 并发请求 → State (`sixMonthTrend`) → 双折线图。
2.  **热度分析**：用户选时间 → API (`getAppointmentStatistics`) → 数据补全 (0-23点) → 面积图。
3.  **桑基图**：API (`getSankeyData`) → `transformSankeyData` → SVG 计算 (`getVerticalShift`) → 阶梯渲染。

### 依赖
*   **Charts**: `recharts` (LineChart, AreaChart, Sankey, PieChart, BarChart)
*   **Data**: `apiService` (多维度统计接口)

---

## 3. `components/Resources.tsx` (医院资源管理)

### 功能概述
*   **资源集成中心**：通过 Tab 形式集成“医生管理”、“药品库存”和“科室信息”三个模块。
*   **路由联动**：支持外部页面通过路由参数直接定位到特定标签页。
*   **科室管理**：展示科室列表，提供管理员权限下的删除功能。
*   **组件复用**：直接嵌入 `DoctorList` 和 `MedicineInventory` 子组件。

### 内部逻辑
1.  **Tab 状态管理**
    *   `activeTab` 控制显示内容。
2.  **路由状态同步**
    *   利用 `useLocation` 监听路由 `state.initialTab`。若存在，组件加载时自动切换到指定 Tab。
3.  **科室删除保护**
    *   `handleDeleteDept` 执行删除前，先校验该科室下是否存在医生（模拟外键约束），若存在则拦截并提示。
4.  **子组件渲染**
    *   根据 Tab 状态条件渲染子组件或内置的科室表格。

### 核心函数

| 函数名 | 作用 |
| :--- | :--- |
| `setActiveTab` | 更新当前激活的标签页，触发 UI 重绘。 |
| `handleDeleteDept` | 处理科室删除，包含二次确认和 API 调用。 |
| `fetchDepts` | 异步获取科室列表并更新状态。 |

### 数据流
1.  **初始化**：路由 State → `activeTab`。
2.  **读取**：`apiService.getDepartments` → 科室表格 UI。
3.  **权限**：`authService.getCurrentUser` → 控制删除按钮显隐。
4.  **写入**：用户删除科室 → API 调用 → 状态更新。

### 依赖
*   **Routing**: `react-router-dom` (useLocation)
*   **Components**: `MedicineInventory`, `DoctorList`

---

## 4. `components/DoctorList.tsx` (医生名录管理)

### 功能概述
*   **名录展示**：表格化展示医生详情（姓名、科室、职称、候诊数）。
*   **组合筛选**：支持按姓名、科室、职称、专业等多维度实时过滤。
*   **权限控制**：仅管理员可看见操作列（编辑/删除）。
*   **候诊监控**：高亮显示候诊人数较多的医生。

### 内部逻辑
1.  **数据关联**
    *   同时加载医生和科室数据，前端将 `departmentId` 映射为科室名称。
2.  **前端实时筛选**
    *   `filteredDoctors` 变量基于 `filters` 状态实时计算，无需后端请求。
3.  **模态框编辑**
    *   使用 `createPortal` 将编辑窗口渲染至 `body` 层级。编辑前调用 `getDoctorById` 获取最新数据。

### 核心函数

| 函数名 | 作用 |
| :--- | :--- |
| `loadData` | 并发获取医生和科室数据。 |
| `handleFilterChange` | 更新筛选条件，触发列表重新过滤。 |
| `handleUpdate` | 提交编辑表单，更新后端数据。 |
| `handleDelete` | 执行删除操作，含二次确认。 |

### 数据流
1.  **读取**：API (`getDoctors`, `getDepartments`) → State → 计算属性 (`filteredDoctors`) → 表格。
2.  **筛选**：用户输入 → 更新 Filters State → UI 刷新。
3.  **写入**：Modal 输入 → API (`updateDoctor`) → 刷新列表。

---

## 5. `components/MedicineInventory.tsx` (药品库存管理)

### 功能概述
*   **库存列表**：展示药品详情及实时库存。
*   **智能预警**：当库存 < 100 时，自动高亮红色预警标签。
*   **实时搜索**：支持按名称或 ID 模糊搜索。
*   **数据维护**：管理员可进行增删改查。

### 内部逻辑
1.  **预警系统**
    *   渲染行时判断 `stock < 100`，动态应用红色样式。
2.  **权限渲染**
    *   检查 `role === 'admin'`，决定是否渲染操作列。
3.  **删除约束**
    *   删除前提示潜在的关联风险（如处方引用）。

### 核心函数

| 函数名 | 作用 |
| :--- | :--- |
| `loadData` | 异步加载药品列表。 |
| `handleDelete` | 处理删除逻辑。 |
| `handleEditClick` | 初始化编辑状态并打开 Modal。 |
| `filteredMedicines` | (逻辑块) 根据搜索词过滤列表。 |

### 数据流
1.  **读取**：API (`getMedicines`) → State (`medicines`)。
2.  **筛选**：搜索词 → 计算属性 → UI 表格。
3.  **状态反馈**：库存数值 → 逻辑判断 → 颜色样式 (红/绿)。

---

## 6. `components/MultimodalManager.tsx` (多模态数据中心)

### 功能概述
*   **多格式支持**：统一管理影像、音频、视频、文本、PDF 及文档。
*   **数据上传**：支持文件拖拽或文本输入，自动构建 FormData 并关联元数据。
*   **智能预览**：根据模态类型自动选择渲染器（图片查看器、播放器、PDF 阅读器）。

### 内部逻辑
1.  **数据分类**
    *   初始化获取列表，支持按“模态类型”筛选。
2.  **上传处理**
    *   `handleSubmit` 构建 `FormData`。区分文本域输入和二进制文件输入。
3.  **多态预览**
    *   `renderPreviewContent` 根据 `item.modality` 动态返回 JSX（`<img>`, `<video>`, `<iframe>` 等）。
4.  **路径解析**
    *   `getFileUrl` 兼容本地 Blob URL（预览时）和服务器静态资源 URL。

### 核心函数

| 函数名 | 作用 |
| :--- | :--- |
| `handleSubmit` | 构造 FormData 并提交上传。 |
| `renderPreviewContent` | 根据数据类型渲染对应的预览组件。 |
| `getFileUrl` | 解析文件的访问地址。 |

### 数据流
1.  **读取**：API (`getMultimodalData`) → 列表渲染。
2.  **上传**：用户文件 → FormData → API (`createMultimodalData`)。
3.  **预览**：用户点击 → 解析 URL → 动态组件渲染。

---

## 7. `components/SystemLogs.tsx` (系统日志监控)

### 功能概述
*   **实时监控**：每 2 秒轮询刷新日志。
*   **分级展示**：根据日志级别 (INFO/WARN/ERROR) 自动着色。
*   **详情透视**：支持查看完整的 JSON 元数据。
*   **管理**：支持筛选和一键清空。

### 内部逻辑
1.  **轮询机制**
    *   `useEffect` 中使用 `setInterval` 调用 `refreshLogs`。提供暂停/继续开关。
2.  **前端过滤**
    *   `filteredLogs` 基于状态实时计算。模块筛选列表由当前日志数据动态去重生成。
3.  **样式映射**
    *   `getLevelClass` 根据日志级别返回对应的 Tailwind CSS 类名。

### 核心函数

| 函数名 | 作用 |
| :--- | :--- |
| `refreshLogs` | 从 LocalStorage 服务拉取最新日志。 |
| `handleClear` | 清空日志并刷新。 |
| `getLevelClass` | 根据级别返回颜色样式类。 |

### 数据流
1.  **来源**：`logger.getLogs()`。
2.  **更新**：定时器 → State 更新 → UI 重绘。
3.  **交互**：点击行 → JSON 序列化 Metadata → Modal 展示。
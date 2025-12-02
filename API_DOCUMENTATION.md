# MedData Hub - 全栈开发实施手册 (后端开发标准)

**核心约定：**
1.  **通信协议**：RESTful API, JSON。
2.  **字段命名**：
    *   **前端 (JSON)**：统一使用 **小驼峰 (camelCase)**。
    *   **数据库**：统一使用 **蛇形 (snake_case)**。
    *   **后端职责**：负责在 API 层处理这两种命名风格的转换。
3.  **鉴权**：登录返回 Token，后续请求 Header 携带（视具体实现而定）。

---

## 1. 认证模块

### 登录
*   **Endpoint**: `POST /api/login`
*   **Payload**:
    ```json
    { "id": "DOC01", "password": "...", "role": "doctor" } // role: patient/doctor/admin
    ```
*   **Response**:
    ```json
    { "success": true, "token": "xyz...", "user": { "id": "...", "name": "...", "role": "..." } }
    ```

---

## 2. 基础数据 (Read-Only / Master Data)

前端初始化时会并行拉取。

| 资源 | Method & URL | Response JSON 关键字段 (CamelCase) | DB 对应关系 |
| :--- | :--- | :--- | :--- |
| **科室** | `GET /api/departments` | `id`, `name`, `location` | 1:1 映射 |
| **医生** | `GET /api/doctors` | `id`, `name`, `departmentId`, `title`, `specialty` | `departmentId` -> `department_id` |
| **药品** | `GET /api/medicines` | `id`, `name`, `price`, `stock`, `specification` | 1:1 映射 |

---

## 3. 患者管理

### 获取列表
*   **Endpoint**: `GET /api/patients`
*   **Response**: `[{ "id", "name", "gender", "age", "phone", "createTime", ... }]`
*   **注意**: 列表接口**禁止**返回密码字段。

### 注册/新增
*   **Endpoint**: `POST /api/patients`
*   **Payload**: `{"id": "...", "name": "...", "password": "...", "gender": "...", ...}`

### 更新信息
*   **Endpoint**: `PUT /api/patients/<id>`
*   **Payload**: `{"phone": "...", "address": "...", ...}`

---

## 4. 核心业务：挂号与排队

### 挂号 (提交)
*   **Endpoint**: `POST /api/appointments`
*   **Payload**:
    ```json
    {
      "patientName": "张三",
      "departmentId": "D01",
      "doctorId": "DOC01", // 可选
      "description": "头痛",
      "status": "pending"
    }
    ```
*   **逻辑**: 后端需生成唯一 `id` 和 `create_time`。

### 获取挂号列表
*   **Endpoint**: `GET /api/appointments`
*   **Response**: 包含 `status` ("pending", "completed", "cancelled")。建议 `JOIN` 科室名称。

### 更新状态 (接诊/完成)
*   **Endpoint**: `PUT /api/appointments/<id>`
*   **Payload**: `{ "status": "completed" }`
*   **场景**: 医生点击“完成诊疗”后，前端调用此接口将患者移出候诊队列。

---

## 5. 核心业务：电子病历 (Transactional)

### 历史病历查询
*   **Endpoint**: `GET /api/records`
*   **Query**: 支持按 `patientId` 过滤。
*   **逻辑**: 需 `JOIN` 患者表和医生表，返回 `patientName` 和 `doctorName`。
*   **Response**:
    ```json
    [{ "id": "R01", "patientName": "...", "doctorName": "...", "diagnosis": "...", "visitDate": "..." }]
    ```

### 获取处方明细
*   **Endpoint**: `GET /api/prescription_details`
*   **Query**: 按 `recordId` 过滤。
*   **Response**: `[{ "medicineId": "...", "dosage": "...", "usage": "...", "days": 3 }]`
    *   *注意*: DB字段为 `usage_info`，JSON为 `usage`。

### **提交诊疗结果 (核心写接口)**
*   **Endpoint**: `POST /api/records`
*   **场景**: 医生提交病历。后端需开启**数据库事务**。
*   **Payload**:
    ```json
    {
      "record": {
        "id": "R_TIMESTAMP",
        "patientId": "P001",
        "doctorId": "DOC01",
        "diagnosis": "高血压",
        "treatmentPlan": "...",
        "visitDate": "2024-01-01"
      },
      "details": [
        {
          "id": "PD_UUID",
          "medicineId": "MED01",
          "dosage": "1片",
          "usage": "每日一次", // 映射到 DB: usage_info
          "days": 7
        }
        // ...更多药品
      ]
    }
    ```
*   **后端处理**:
    1.  开启事务。
    2.  Insert `medical_records`。
    3.  Insert `prescription_details` (多条)。
    4.  (可选) Update `medicines` 扣减库存。
    5.  Commit 事务。


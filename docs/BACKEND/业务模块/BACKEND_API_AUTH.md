# BACKEND_API_AUTH.md
---
## 1. 模块概览

- **模块文件**：`app/api/auth.py`  
- **蓝图名称**：`auth_bp`  
- **主要职责**：  
  - 提供统一的**用户登录认证接口**；  
  - 处理不同角色的校验逻辑（管理员硬编码校验，医患查库校验）；  
  - **生成 JWT (JSON Web Token)**：登录成功后颁发包含用户身份与时效的 Token。

系统中使用的用户实体与数据库表对应关系：

- 患者 → 表：`patients`
- 医生 → 表：`doctors`
- 管理员 → **硬编码校验**（无需数据库表）

---

## 2. 路由与接口概览

### 2.1 登录接口：`POST /api/login`

- **蓝图**：`auth_bp`
- **路由定义位置**：`app/api/auth.py`

```python
@auth_bp.route('/api/login', methods=['POST'])
def login():
    ...
```

- **功能说明**：  
  接收用户提交的账号、密码和角色信息。
  - **管理员**：验证硬编码凭证（`admin`/`admin123`）。
  - **医/患**：查询对应数据库表验证凭证。
  - **结果**：认证通过后，生成一个有效期为 **1小时** 的 JWT，并返回用户基础信息。

---

## 3. 请求与响应设计

### 3.1 请求格式

- **HTTP 方法**：`POST`
- **URL**：`/api/login`
- **Header**：`Content-Type: application/json`
- **请求体 JSON**

```json
{
  "id": "用户编号（如 P001, DOC001, admin）",
  "password": "登录密码",
  "role": "patient | doctor | admin"
}
```

字段说明：

| 字段名    | 类型   | 是否必填 | 说明                                      |
|-----------|--------|----------|-------------------------------------------|
| `id`      | string | 是       | 用户 ID                                   |
| `password`| string | 是       | 登录密码                                  |
| `role`    | string | 是       | 角色标识：`patient` / `doctor` / `admin`  |

---

### 3.2 响应格式

#### 3.2.1 登录成功

```json
{
  "success": true,
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIj...",
  "user": {
    "id": "P001",
    "name": "张三",
    "role": "patient"
  }
}
```

- **token**: JWT 字符串，客户端需将其存储（如 localStorage）并在后续请求头中携带。
- **user**: 返回的基础用户信息，用于前端展示。

#### 3.2.2 登录失败：账号或密码错误

```json
{
  "success": false,
  "message": "账号或密码错误"
}
```
或
```json
{
  "success": false,
  "message": "管理员认证失败"
}
```

- HTTP 状态码：`401`

#### 3.2.3 服务器内部错误 / 参数错误

```json
{
  "success": false,
  "message": "服务器内部错误" 
}
```
- HTTP 状态码：`500` (内部错误) 或 `400` (无效角色)

---

## 4. 认证流程设计

以下是 `login()` 函数的业务逻辑流程：

1.  **解析请求**：获取 `id`, `password`, `role`。
2.  **管理员特殊处理**：
    - 若 `role == 'admin'`，检查是否匹配 `id='admin'` 且 `password='admin123'`。
    - 成功：跳转至 **步骤 4**。
    - 失败：返回 401。
3.  **数据库校验 (医/患)**：
    - 连接数据库。
    - 根据 role 选择表名 (`patients` 或 `doctors`)。
    - 执行 SQL：`SELECT id, name FROM table WHERE id=%s AND password=%s`。
    - 若查询到记录：跳转至 **步骤 4**。
    - 若未查询到：记录 Warning 日志，返回 401。
4.  **生成 Token (JWT)**：
    - 调用内部函数 `generate_jwt(user_id, role)`。
    - **Payload 内容**：
      - `user_id`: 用户 ID
      - `role`: 用户角色
      - `exp`: 过期时间戳（当前时间 + 1小时）
    - **签名算法**：`HS256`，使用配置中的 `SECRET_KEY` 进行签名。
5.  **返回响应**：
    - 构造包含 `token` 和 `user` 信息的 JSON 返回给客户端。

---

## 5. JWT 详情

- **算法**：HMAC SHA-256 (HS256)
- **密钥**：来源于 `app.utils.common.SECRET_KEY`。
- **有效期**：1 小时 (`datetime.timedelta(hours=1)`)。
- **Payload 结构**：

  ```python
  {
      'user_id': 'P001',
      'role': 'patient',
      'exp': 1715000000  # Unix Timestamp
  }
  ```

---

## 6. 与其他模块的关系

- **上游调用方**
  - 前端登录页面 (`/login`)。

- **下游依赖**
  - `app.utils.db`: 数据库连接。
  - `app.utils.common`: 获取 `SECRET_KEY`。

- **配合模块**
  - **后续鉴权**：系统中的其他受保护接口（如病历查询）应实现一个装饰器（Decorator），用于解析 HTTP Header 中的 Token，验证 `exp` 和签名，从而确认用户身份。

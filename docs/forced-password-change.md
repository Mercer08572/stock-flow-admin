# 管理员强制修改密码与全局拦截

本文梳理「初始化 admin 登录后强制修改密码，并在改密完成前拦截所有页面」这一条链路的完整实现，
覆盖状态源头、后端硬拦截、前端路由守卫，以及当前实现的边界与已知缺口。

## 1. 适用范围与结论

一句话结论：**后端用「会话快照 + 两条 SQL 翻转 + 中间件双开关」把强制改密做成不可绕过的硬约束；
前端用「守卫在鉴权之后按路由名白名单重定向」把它做成可感知的流程，并靠「先更新 store 里的 flag 再导航」
避免死循环，同时放行 `me` / 改密 / 登出三个接口以免把用户锁死。**

强制改密不是单点逻辑，而是三层防线：

| 层   | 载体                                        | 作用                                     | 能否绕过                         |
| ---- | ------------------------------------------- | ---------------------------------------- | -------------------------------- |
| 数据 | `admin_users.must_change_password` 列       | 唯一的真相来源                           | 需直接改库                       |
| 前端 | Vue Router 全局守卫 + Pinia `auth` store    | 体验层拦截：把用户按在改密页             | 能绕过（改前端状态、直接调 API） |
| 后端 | Gin 中间件 `AdminSession()` / `Protected()` | 安全层拦截：强制改密期间业务接口一律 403 | 不能                             |

「强制」的强度由后端决定，前端只负责把用户友好地导过去：即使前端守卫失效，业务接口依然返回 403，
不会真正泄漏数据。

阅读约定：`src/...` 指前端仓库 `stock-flow-admin/` 内路径，`../stock-flow/...` 指后端仓库路径。
后端部分只作为契约说明，不属于本仓库的修改范围。

## 2. 状态源头：`must_change_password`

### 2.1 列定义

- 迁移：`../stock-flow/migrations/202607140006_add_admin_login_safety_fields.up.sql:7`
- 聚合快照：`../stock-flow/sql/schema/schema.sql:588`，`must_change_password BOOLEAN NOT NULL DEFAULT TRUE`

### 2.2 状态只能由两条 SQL 翻转

| 时机           | SQL                                        | 写入值                                                                                     |
| -------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 初始化口令     | `../stock-flow/sql/queries/auth.sql:14-27` | `password_initialized = TRUE`、`must_change_password = TRUE`、`password_changed_at = NULL` |
| 管理员改密成功 | `../stock-flow/sql/queries/auth.sql:36-42` | `must_change_password = FALSE`、写入 `password_changed_at`                                 |

### 2.3 初始化链路

迁移只插入 `password_initialized = FALSE` 的占位管理员（占位 hash 无法登录），真实口令由运维执行
CLI 写入：`../stock-flow/cmd/admin/main.go:57` → `InitializeAdminPassword`，成功后打印
`password change is required at first login`（`../stock-flow/cmd/admin/main.go:65`）。

登录侧再挡一道：`Login`（`../stock-flow/internal/auth/service.go:116`）先检查 `password_initialized`，
未初始化一律返回 `ErrInvalidCredentials`。因此：

- 没 init 过的库，任何人都登录不了；
- init 之后第一次登录一定能进去，但只进得去改密页。

### 2.4 关键语义：状态是「会话快照」

`issueSession`（`../stock-flow/internal/auth/service.go:169-190`）把 `admin.MustChangePassword` **写进会话记录**。
此后 `Me()`（`../stock-flow/internal/auth/service.go:265`）与中间件读的都是会话里的快照，
不是每次回查数据库。因此前端拿到的 `must_change_password` 是「本次会话签发时的状态」。

## 3. 后端硬拦截

### 3.1 同一份鉴权逻辑，两个开关

`../stock-flow/internal/auth/middleware.go:45-51` 暴露同一实现的两个变体（`adminSession(allowPasswordChange bool)`）：

| 中间件                              | 对 `MustChangePassword` 的态度 | 挂在哪些路由                                                                                                                                       |
| ----------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AdminSession()`                    | 拦 → 403                       | `/auth/apps*` 等 API 应用管理接口（`../stock-flow/internal/auth/handler.go:92-93`）                                                                |
| `AdminSessionAllowPasswordChange()` | 放行                           | `/auth/admin/logout`、`/auth/admin/me`、`/auth/admin/password`（`../stock-flow/internal/auth/handler.go:86-90`）                                   |
| `Protected()`                       | 拦 → 403                       | 全部业务路由：units / categories / conversions / materials / skus / warehouses / inventory（`../stock-flow/internal/shared/http/router.go:61-69`） |

`/auth/admin/login` 完全不鉴权（`../stock-flow/internal/auth/handler.go:84`）。

「后端拦截所有页面」的确切含义就是上表第三行：前端某个页面即使漏了守卫，它发出的
`GET /api/v1/materials` 也一定拿不到数据。

### 3.2 拒绝的形态

被拦时走 `abortAuth` 的 `ErrPasswordChangeRequired` 分支（`../stock-flow/internal/auth/middleware.go:186-187`，
错误定义在 `../stock-flow/internal/auth/errors.go:13`）：**HTTP 403 + 业务码 1003**。

### 3.3 改密的完整语义

`ChangePassword`（`../stock-flow/internal/auth/service.go:206-246`）按顺序做六件事：

1. 用当前会话鉴权（因此改密页的会话必须有效）；
2. 校验当前密码；
3. 新密码不得与旧密码相同；
4. `validateNewPassword`：长度 12~128 个字符、且不得等于用户名（`../stock-flow/internal/auth/service.go:247`）；
5. 落库 `must_change_password = FALSE`；
6. `DeleteByAdminUserID` 删除该管理员**全部**会话（其它设备一起掉线）→ 重新 `issueSession` 并 `Set-Cookie`。

响应体与登录接口共用 `LoginResponse`（`../stock-flow/internal/auth/handler.go:144-162`），
所以前端拿到新身份后**不需要额外再调一次 `/me`**。

### 3.4 会话 Cookie

`../stock-flow/internal/auth/handler.go:443-454`：`HttpOnly = true`、`Path = /api/v1`、
`SameSite` 可配、`MaxAge` 跟随会话过期时间。浏览器侧不存任何 token。

## 4. 前端实现

### 4.1 类型与传输层

- `AdminIdentity.must_change_password`：`src/types/api.ts:17-21`；登录、`/me`、改密三个接口的响应都含它
  （`src/api/auth.ts:15-27`）。
- 会话靠 Cookie 而非 token：`src/api/client.ts:34` 固定 `credentials: 'include'`。

### 4.2 `auth` store 的状态机

`src/features/auth/auth.store.ts:8` 定义四态：`unknown | loading | authenticated | anonymous`。

```text
unknown ──bootstrap()──▶ loading ──me() 成功──▶ authenticated
                              └──me() 401────▶ anonymous（clearSession）
```

要点：

- `isAuthenticated` 严格判定 `sessionState === 'authenticated'`（`src/features/auth/auth.store.ts:17`），
  **不是**「admin 不为 null」。`unknown` 在守卫里等同未登录。
- `bootstrap()` 幂等：`if (this.sessionState !== 'unknown') return`（`src/features/auth/auth.store.ts:21`），
  一个页面生命周期只请求一次 `/auth/admin/me`。
- 只有 401 会 `clearSession()`，其它错误向上抛（`src/features/auth/auth.store.ts:27-30`）。

### 4.3 全局守卫

`src/router/index.ts:64-87` 的 `beforeEach` 按固定顺序做四件事：

```ts
router.beforeEach(async (to) => {
  const auth = useAuthStore(pinia) // ① 用导出的 pinia 实例：守卫在组件外执行，拿不到 inject

  if (to.meta.public) {
    // ② 白名单优先：/login 与 404 直接放行
    if (to.name === 'login' && auth.isAuthenticated) return { name: 'dashboard' }
    return true
  }

  try {
    await auth.bootstrap() // ③ 首次导航恢复会话（幂等）
  } catch {
    auth.clearSession()
  }

  if (!auth.isAuthenticated) {
    // ④ 未登录 → 登录页，保留原目标
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (auth.admin?.must_change_password && to.name !== 'change-password') {
    return { name: 'change-password' } // ⑤ 强制改密拦截
  }

  return true
})
```

| 步骤 | 位置                        | 必须理解的顺序细节                                                                                                            |
| ---- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| ①    | `src/router/index.ts:65`    | 守卫在组件外运行，必须显式传入 `src/stores/index.ts:3` 导出的 pinia 实例。                                                    |
| ②    | `src/router/index.ts:67-70` | 先于 ③：`/login` 与 404 不触发 `/me` 请求，也不被强制改密拦截。                                                               |
| ③    | `src/router/index.ts:72-76` | 该 `catch` 覆盖所有异常（含 500、断网）：一律 `clearSession()` 并当作未登录，属「宁可当未登录」的保守策略。                   |
| ④    | `src/router/index.ts:78-80` | `redirect` 用 `to.fullPath`；`LoginView` 只接受以 `/` 开头的字符串（`src/features/auth/LoginView.vue:28-31`），防开放重定向。 |
| ⑤    | `src/router/index.ts:82-84` | 放在鉴权之后，因为必须先把会话恢复出来才有 `auth.admin` 可读——这也是强制改密只能写在守卫、不能写在 store 的原因。             |

可访问性提醒：⑤ 的判定键是**硬编码的路由 name**（`change-password`），不同于 ② 那种 `meta.public`
声明式白名单。以后新增任何需要放行的路由，都要回来改这一行。

### 4.4 登录页的双保险

`LoginView` 在登录成功后自己再判一次（`src/features/auth/LoginView.vue:42-44`）：

```ts
await auth.login(form)
const destination = auth.admin?.must_change_password ? '/account/password' : redirectPath.value
await router.replace(destination)
```

它用的是**登录响应体**里的 `result.admin.must_change_password`（`src/features/auth/auth.store.ts:35-38`），
省掉「先跳工作台、再被守卫弹回」的中间态闪烁。守卫那一层则负责覆盖硬刷新、手输 URL 等所有其它入口——
两层互补，不是重复。

### 4.5 改密页的解锁顺序（顺序是生死线）

`src/features/auth/ChangePasswordView.vue:40-60`：

```ts
await auth.changePassword({ current_password, new_password }) // ① 服务端置 FALSE 并重签会话
message.success('密码已更新')
await router.replace({ name: 'dashboard' }) // ② 然后才导航
```

`auth.changePassword` 内部用接口返回的 admin 覆盖本地状态（`src/features/auth/auth.store.ts:44-49`）。
**不能把 ① 和 ② 调换**：若先导航后更新 store，跳转瞬间 `auth.admin.must_change_password` 仍为 `true`，
守卫会立刻把用户弹回改密页，形成「改了密码却过不去」的死循环。

### 4.6 「拦截所有页面」如何成立

`change-password` 是 `AdminShell` 的子路由（`src/router/index.ts:47-52`），因此改密期间**完整的后台外壳照常渲染**，
只是右侧内容区是改密表单。菜单点击走 `router.push`，于是：

- 点侧边栏菜单 → 触发 `beforeEach` → ⑤ 命中 → 被送回 `change-password`；
- 浏览器前进/后退 → 同样过 `beforeEach` → 同样被送回；
- 手输 URL → 同样过 `beforeEach` → 同样被送回。

真正的拦截点只有一个：**`beforeEach` 对每一次导航都生效**。侧边栏「高亮乱跳」的观感来自
`activeMenu` 直接取 `route.path`（`src/components/layout/AdminShell.vue:58`）——`push` 被守卫改写后路径始终停在改密页。

同时**必须放行「退出登录」**，否则用户会被锁死在单一页面。因此后端把 `logout` 与 `me`、`password`
一起放进 `AdminSessionAllowPasswordChange` 组，前端顶部用户菜单在改密页依然可用
（`src/components/layout/AdminShell.vue:52-56`、`src/components/layout/AdminShell.vue:66-82`）。
这是「拦截」设计中反直觉但必需的一环。

## 5. 端到端时序（首次初始化场景）

```text
① 运维执行 stock-flow-admin init
   → admin_users.must_change_password = TRUE, password_initialized = TRUE

② 浏览器打开 / → beforeEach → sessionState=unknown → GET /auth/admin/me
   → 401 → clearSession（anonymous）
   → 未登录 → replace /login?redirect=%2F

③ POST /auth/admin/login {admin, 初始密码}
   → 后端校验 password_initialized → issueSession（会话快照 must_change_password = TRUE）
   → 200 {admin:{must_change_password:true}} + Set-Cookie(HttpOnly, Path=/api/v1)
   → store.admin 写入，sessionState=authenticated
   → LoginView: destination = '/account/password' → router.replace

④ 改密页渲染在 AdminShell 内（侧边栏可见）
   → 点任意菜单 = push → beforeEach ⑤ 命中 → 弹回 /account/password
   → 此时仍可「退出登录」（该接口后端放行）

⑤ PUT /auth/admin/password {current_password, new_password}
   → 后端：校验 → 删全部旧会话 → must_change_password = FALSE → 签发新会话 + 新 Cookie
   → 200 {admin:{must_change_password:false}}
   → store 先更新 admin，再 replace({name:'dashboard'}) → 守卫 ⑤ 不再命中 → 放行

⑥ 之后每次导航仍走 beforeEach，但 bootstrap 因 sessionState 已非 unknown 直接返回
   → 稳态下零额外请求；只有硬刷新才会重新 GET /auth/admin/me 一次
```

## 6. 边界与已知缺口

以下均为当前代码的事实描述，标注了各自的影响面，供判断是否属于预期行为。

| #   | 缺口                                                                                                                       | 位置                                                                                                             | 影响                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | `redirect` 在强制改密链路上丢失：守卫 ⑤ 与 `LoginView` 都固定去 `/account/password`，改密成功后固定去工作台                | `src/router/index.ts:82-84`、`src/features/auth/LoginView.vue:43`、`src/features/auth/ChangePasswordView.vue:54` | 「首次登录直达深链接」的意图丢失，用户改完密需再点一次                                               |
| 2   | 404 路由在白名单内：处于强制改密状态时访问不存在的路径会看到 404 页                                                        | `src/router/index.ts:55-60`                                                                                      | 拦截范围缺口；无安全影响（404 页不发业务请求）                                                       |
| 3   | 前端密码规则弱于后端：只有 `min: 12`，缺 128 上限、「不得等于用户名」、「不得与旧密码相同」                                | `src/features/auth/ChangePasswordView.vue:30-33` vs `../stock-flow/internal/auth/service.go:206-247`             | 这三类错误只能由后端 400 返回英文原文 message 后展示，体验不一致                                     |
| 4   | 前端没有 403 / 1003 的全局拦截器：`ApiError` 只被当作普通错误文本渲染                                                      | `src/api/error.ts`、`src/api/client.ts:49-55`                                                                    | 一旦某个页面漏掉守卫，不会自愈回改密页，只会报错                                                     |
| 5   | 强制改密判定是硬编码 name 比对，无声明式 `meta` 标记                                                                       | `src/router/index.ts:82`                                                                                         | 新增相关路由容易漏改                                                                                 |
| 6   | 硬刷新 `/login` 时不会自动跳走：`public` 分支先于 `bootstrap()`，`sessionState` 仍是 `unknown`，`isAuthenticated` 为 false | `src/router/index.ts:67-70`                                                                                      | 已登录用户直接打开 `/login` 会看到登录表单                                                           |
| 7   | 该链路没有自动化测试：`tests/login.spec.ts` 只覆盖登录页渲染与空值校验，且造桩里 `ADMIN.must_change_password` 恒为 `false` | `tests/login.spec.ts`、`tests/support/api-mock.ts:11`                                                            | 「强制改密 + 导航弹回」无回归保护（守卫本身也没有单测）                                              |
| 8   | 会话是进程内存态：真实装配使用 `NewInMemorySessionStore()`                                                                 | `../stock-flow/internal/shared/http/router.go:84`                                                                | 后端重启即全员掉线；多副本部署时「改密踢掉所有会话」只在单实例内成立。这是「会话快照」语义的直接后果 |

## 7. 维护指引

改动这条链路时，以下位置必须一起核对：

1. **状态源头**：`../stock-flow/sql/queries/auth.sql` 两条 SQL 是唯一允许翻转该布尔值的地方，
   新增任何「重置密码」入口都要同步这两个语义（置 TRUE / 置 FALSE）。
2. **后端路由分组**：`../stock-flow/internal/auth/handler.go:83-95` 与
   `../stock-flow/internal/shared/http/router.go:61-69`——新接口必须明确表态是「严格」还是「放行」。
3. **前端守卫白名单**：`src/router/index.ts:82` 的 name 条件；新增放行路由要同步。
4. **前端解锁顺序**：任何改密入口都必须遵守「先更新 store，再导航」。
5. **契约**：`must_change_password` 属于 `AdminIdentity`（`src/types/api.ts:17-21`），
   后端契约变更时按 `AGENTS.md` 的约定先在后端 `make swagger`，再在前端 `pnpm api:generate` 核对业务类型。

## 8. 参考索引

| 文件                                           | 关键行    | 作用                                     |
| ---------------------------------------------- | --------- | ---------------------------------------- |
| `src/router/index.ts`                          | 64-87     | 全局守卫（白名单 / 恢复会话 / 强制改密） |
| `src/router/index.ts`                          | 47-52     | `change-password` 作为 shell 子路由      |
| `src/features/auth/auth.store.ts`              | 8-61      | 会话状态机与 `changePassword`            |
| `src/features/auth/LoginView.vue`              | 28-44     | `redirect` 校验与强制改密双保险          |
| `src/features/auth/ChangePasswordView.vue`     | 28-60     | 表单规则与「先更新、后导航」             |
| `src/components/layout/AdminShell.vue`         | 52-82     | 用户菜单（改密 / 登出）                  |
| `src/api/auth.ts`                              | 15-27     | 认证端点封装                             |
| `src/api/client.ts`                            | 30-58     | Cookie 携带与统一响应解包                |
| `../stock-flow/internal/auth/middleware.go`    | 45-140    | 三个中间件变体                           |
| `../stock-flow/internal/auth/middleware.go`    | 180-192   | 401 / 403 的响应映射                     |
| `../stock-flow/internal/auth/service.go`       | 169-246   | 会话签发快照与改密语义                   |
| `../stock-flow/internal/auth/handler.go`       | 83-95     | 认证路由分组与中间件绑定                 |
| `../stock-flow/internal/shared/http/router.go` | 58-69, 84 | 业务路由的硬拦截与内存会话装配           |
| `../stock-flow/sql/queries/auth.sql`           | 14-42     | 布尔值的两条翻转 SQL                     |
| `../stock-flow/cmd/admin/main.go`              | 57-65     | 初始化口令 CLI                           |

# 前端架构

## 依赖方向

```text
views/components -> feature stores and API modules -> api/client -> stock-flow API
        |                       |
        +------ shared types ---+
```

- 页面负责组合和交互，不处理 HTTP 协议细节。
- feature store 负责跨组件的业务状态和会话生命周期。
- endpoint wrapper 负责路径、请求参数和响应类型。
- `api/client.ts` 负责 URL、Cookie、统一响应解包和错误模型。

## 认证

管理员登录由后端设置 HttpOnly Cookie。前端只保留当前管理员身份和会话状态，不读取、复制或持久化 token。

路由进入受保护页面时：

1. 首次导航调用 `GET /auth/admin/me` 恢复会话。
2. `401` 清除内存态并跳转登录页，同时保留目标路径。
3. `must_change_password=true` 强制进入修改密码页。
4. 退出登录无论请求结果如何都会清理本地内存态。

强制改密与全局拦截的完整实现（状态源头、后端硬拦截、守卫逐条拆解与已知缺口）见
[forced-password-change.md](forced-password-change.md)。

## 应用外壳与多标签

登录后的页面统一渲染在 `src/components/layout/AdminShell.vue` 里：左侧菜单 + 顶栏 + 标签条 + 内容区。

**布局契约（固定 band + 单一滚动容器）**

- 外壳高度锁在 `100vh`/`100dvh`，顶栏与标签条是固定高度的 flex 项（`--shell-topbar-height`、
  `--shell-tabbar-height`），内容区 `.app-content` 是**全应用唯一的滚动容器**，窗口本身不滚动。
- 因此**不要**给这些 band 用 `position: sticky`：naive 的 `NLayout` 会额外渲染一层
  `.n-layout-scroll-container`（`overflow-x: hidden` 会被计算成 `overflow-y: auto`），
  sticky 的吸附基准会落到那一层而不是视口，导致 band 被下移、盖住页面头部按钮。
- 页面（`.page`）不要设视口相关的最小高度：内容区受限时，确定的高度会让 flex 列容器压缩子项
  （列表页表格被压扁且滚不动），而不是让内容区产生滚动。页面比内容区矮时露出的内容区背景与页面同色。
- `DataTable` 的最大高度算式需要减掉 `--shell-tabbar-height`，否则列表页会固定多出一条约标签条高度的滚动条。
- 路由的 `scrollBehavior` 重置的是 `.app-content` 的滚动位置（登录页/404 没有外壳，回退到窗口滚动）。

**多标签规则**

- 内容区按多标签（Tab）组织：工作台常驻第 0 位且不可关闭，其余页面按访问顺序追加、可单独关闭。
- 标签的唯一键是 `route.path`，标签集合恒等于「工作台 + 访问过的路由」；同一路由只占一个标签，
  重复进入（菜单、详情跳转、浏览器前进/后退、深链）都只是切回已有标签。
- **不缓存页面状态**（未启用 `KeepAlive`）：切换标签会重新挂载视图并重新取数，
  宁可多一次请求，也不让跨标签读到过期数据。
- 关闭当前页的标签时激活它左侧的标签（工作台保底）；关闭非当前页的标签不改变当前页面。
- 标签集合不持久化：刷新或深链后重建为「工作台 + 当前页」；退出登录时外壳卸载，标签随之清空。
- 标签规则（登记、去重、关闭后激活谁）集中在 `src/components/layout/shell-tabs.ts` 的纯函数里，
  单测见 `shell-tabs.test.ts`，端到端覆盖见 `tests/tabs.spec.ts`（含 band 固定与「短页面不多出滚动条」两条回归）。

**侧栏折叠**

- 侧栏（`NLayoutSider` + `NMenu`）可收窄为图标栏：`collapse-mode="width"` 让宽度真的从 232 → 64；
  Naive 的默认值 `transform` 是把侧栏移出屏幕，内容区不重排，不是这里要的效果。
- 折叠后**名称怎么还能被看到，交给 Naive 内建行为**：叶子项由 `MenuOption` 的 `NTooltip` 承担、
  分组由 `Submenu` 的 `NDropdown`（hover 触发）承担，两者都只在 `collapsed` 时启用。
  名称元素仍留在 DOM 里（被设成 `opacity: 0`），因此**不要**用可见性判断名称是否隐藏，断言请看 `opacity`。
- 折叠开关**钉在侧栏底部**（三段式：品牌固定 / 菜单滚动 / 开关固定），是外壳自绘的
  **原生 `<button class="sider-toggle">`**，带 `aria-label` 与 `:focus-visible` 焦点环。
  不用 `NButton`：它内部有「`1em` 图标尺寸 + 内容层居中 + 图标层固定宽度」三层规则，
  外部很难把图标精确对齐到菜单图标那一列；也不用 Naive 自带的 `show-trigger="bar"`：
  那个裸 `div` 没有 `role`/`tabindex`/`aria-label`，键盘不可达。
- 开关的取值全部来自对当前主题的实测（不靠猜）：行高 42px、图标 20px 落在 x=22..42
  （中心 32，与菜单图标同列）、文字起点 x=52（与菜单项文字同列）、非选中态图标与文字同为 `#bbb`、
  悬浮同为 `#fff`、悬浮不改背景；折叠态图标 24px 并与菜单图标一起居中在 64px 栏内。
  端到端断言直接比对「开关 vs 相邻非选中菜单项」的颜色/尺寸/中心与文字起点，防止样式漂移。
- 底部固定依赖 sider 的**原生滚动容器**（`.n-layout-sider-scroll-container`）：
  外壳把它设为不滚动的 flex 列，滚动交给菜单那一块。一旦改回 `:native-scrollbar="false"`，
  内容会被包进 `.n-scrollbar`，这些规则全部失效、开关会被菜单顶走。
- 侧栏只做**宽度过渡**，因此开关内部不能有「瞬时翻转的布局」，否则过渡期间会抖动。三条不变量
  （端到端用例 `宽度过渡期间：图标不跳动、文字不竖排、不冒横向滚动条` 逐帧采样锁定）：0. 尺寸不变的元素（品牌 logo、图标盒）必须 `flex: none`。默认的 `flex-shrink: 1`
  会把它们压扁：折叠栏只有 64px，而品牌区一行需要 `15 + 34 + 11 + 文字 + 20`，
  实测品牌标记被压成 20×34（正方形变形）。与之相对，**文字层**要保留 `overflow: hidden`
  （溢出非 visible 时自动最小尺寸才降为 0，文字才能先被压到 0 而不是去挤 logo）。
  1. 图标位置恒定——固定 24px 图标盒 + 固定 `padding-left: 20px`，图标中心恒在 x=32；
     不要用 `justify-content: center` 之类的状态切换，否则图标会先跳到中间再缩回左边。
     品牌区同理，但它**需要**随折叠把标记从「与菜单图标左对齐」移到「栏内居中」（20 → 15），
     所以改成过渡一个**连续量** `padding-left`，并且用与 sider 宽度过渡完全相同的
     时长与缓动（`var(--shell-collapse-duration)` + `var(--n-bezier)`）——
     两边不同步的话仍会被看成跳动。实测单帧位移从 14.4px 降到 0.9px，半程进度差 0.00~0.01。
     品牌文字同样要**常驻 DOM**（只做 `opacity` 过渡）：`display: none` 会把文字在过渡中途抽走。
  2. 文字不换行——`white-space: nowrap` + `overflow: hidden`，并且文字**常驻 DOM**、
     只做 `opacity` 过渡（用 `v-if` 会在过渡中途插入/移除文本，表现为文字被挤成竖排）。
  3. 时长只有一个来源——与折叠相关的四条过渡（品牌区位移、品牌标题淡出、开关配色、开关文字淡出）
     全部引用 `--shell-collapse-duration`（定义在 `.app-shell` 上）。它必须与 Naive 侧栏内部的
     `min/max-width` 过渡一致：Naive 没有导出任何时长变量（源码里就是写死的 `.3s var(--n-bezier)`），
     只能写同一个字面量；缓动则复用它的 `--n-bezier`。两边一旦不同，就会出现
     「栏宽还在动、标记已经走完」的错位感——`tests/sidebar.spec.ts` 会逐帧比对两者的进度（容差 ±20%），改错即失败。
  4. 不出现横向滚动条——**必须让子项能被压窄**：Naive 给 sider 内容区
     （`.n-layout-sider-scroll-container`）打了**内联** `overflow: auto`，内联样式优先于样式表，
     所以在那里写 `overflow: hidden` 是挡不住的；而列方向 flex 子项的 `min-width` 默认是 `auto`
     （= min-content，文字 + 图标宽度），容器还窄时子项拒绝收缩 → 溢出 → 滚动条一闪而过。
     修法：给品牌区 / 菜单 / 底部区都加 `min-width: 0` 并各自 `overflow: hidden`；
     菜单再显式写 `overflow: hidden auto`（只写 `overflow-y: auto` 会让 `overflow-x` 被算成 auto）。
     注意这个坑**只在展开方向出现**：收起时 collapsed 类立刻生效，菜单项自己先收成 64px，
     min-content 随之变小，所以不溢出——「只闪一个方向」正是它的特征。

> 改这段样式时留意：同名规则的**重复定义**很隐蔽——同优先级时后出现的规则生效，
> 若旧规则没删干净，新写的过渡会被它悄悄覆盖（表现为「改了没生效」）。
> 本项目已有端到端用例逐帧采样断言这些不变量（含品牌标记恒为 34×34 的「不得变形」断言），
> 改完跑 `pnpm test:e2e tests/sidebar.spec.ts` 即可确认。

- 折叠状态存在 `localStorage`（键 `stock-flow-admin:sidebar-collapsed`，只存一个布尔偏好、不涉及凭据）；
  读写与异常兜底在 `sidebar-collapsed.ts`（含单测），端到端覆盖见 `tests/sidebar.spec.ts`。
- 移动端不适用：侧栏整体由抽屉代替，抽屉内始终显示名称。

## API 错误

后端返回 `{ code, message, data, trace_id, timestamp }`。传输层将失败转换为 `ApiError`，同时保留 HTTP 状态、业务码和 trace ID。UI 展示可理解的消息；诊断或日志功能可以使用 trace ID，但不要向用户泄露请求体或凭据。

## 新增功能

1. 在 `tasks/` 建任务说明，列出后端 endpoint、验收标准和非目标。
2. 在 `src/features/<feature>/` 建页面、局部组件和必要的 store。
3. 在 `src/api/` 增加或扩展 endpoint wrapper。
4. 只把跨 feature 的模型放进 `src/types/`。
5. 在 `src/router/index.ts` 注册路由，并在管理端菜单增加入口。
6. 覆盖成功、空数据、加载、错误、401 和窄屏状态。
7. 运行 `pnpm check`，对 UI 变更运行 `pnpm test:e2e`。

## 数据表格

- 运营数据表统一使用 `src/components/common/DataTable.vue`（Naive UI DataTable 的适配层）。页面只声明 `DataTableColumn` 列描述，不直接调用底层表格库的列 API；更换表格实现时只改这个适配层。
- 列宽必须有显式 `width`（同时作为可拖拽缩小的下限，必要时再声明 `minWidth`），需要对齐的数字列使用 `align: 'right'`。
- 单元格需要格式化时使用 `render`；时间统一走 `formatDateTime`，CSV 文本走 `exportValue`。
- 远程分页、筛选和排序参数必须显式映射到后端，不在大数据集上伪装成本地全量操作。
- 数量字段保持后端 decimal string，不要转成 JavaScript `number` 后再参与计算。

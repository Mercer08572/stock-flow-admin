/**
 * 引用型下拉（仓库 / SKU / 分类 / 单位 …）的选项约定。
 *
 * `label` 固定为「编码 - 名称」，它同时是 `filterable` 的匹配文本，
 * 展示层不要改这个格式；需要分两行呈现时读 `code` / `name`，
 * 不要回头去拆 `label` 字符串（编码里本身可能包含 ` - `）。
 */
export interface ReferenceSelectOption<T extends string | number = number> {
  label: string
  value: T
  /** 编码：下拉选项的第二行；静态枚举没有这个字段 */
  code?: string
  /** 名称：下拉选项的主行；静态枚举没有这个字段 */
  name?: string
  disabled?: boolean
}

/**
 * 远程搜索的分页查询。
 *
 * `keyword` 为空表示「浏览模式」：按列表默认顺序翻页，而不是过滤。
 * `offset` 是**已加载条数**，不是页码：服务端 `List` 接口用的就是 offset。
 */
export interface ReferenceSelectQuery {
  keyword: string
  offset: number
  limit: number
}

/** 远程搜索的一页结果；`total` 是同一条件下的总记录数（不受 limit/offset 影响） */
export interface ReferenceSelectPage<T extends string | number = number> {
  options: ReferenceSelectOption<T>[]
  total: number
}

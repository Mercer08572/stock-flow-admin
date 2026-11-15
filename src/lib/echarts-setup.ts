import { BarChart, LineChart } from 'echarts/charts'
import {
  DatasetComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

/**
 * ECharts 按需注册。
 *
 * 只注册工作台用得到的图表与组件，避免把整个 echarts 打进首屏包；
 * 模块级执行一次，供两个统计图组件共享。
 */
use([
  CanvasRenderer,
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DatasetComponent,
])

import { api } from './client'

import type { HealthStatus } from '@/types/api'

export const healthApi = {
  get: () => api.get<HealthStatus>('/health'),
}

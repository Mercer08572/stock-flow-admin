import { api } from './client'

import type {
  APIApp,
  APIAppListResult,
  APISecret,
  APISecretListResult,
  CreateAPIAppInput,
  IssueAPISecretInput,
  IssuedAPISecret,
  ReissueAPISecretInput,
  UpdateAPIAppInput,
  UpdateAPISecretInput,
} from '@/types/api'

const appPath = (appId: number) => `/auth/apps/${appId}`
const secretPath = (appId: number, secretId: string) =>
  `${appPath(appId)}/secrets/${encodeURIComponent(secretId)}`

/**
 * API 应用与密钥管理。
 *
 * 密钥明文只在 `issueSecret` / `reissueSecret` 的响应中出现一次；
 * 其余接口（列表、更新、禁用、启用）都不会返回 `secret`。
 */
export const apiKeysApi = {
  listApps: (query: { status?: string; limit?: number; offset?: number }) =>
    api.get<APIAppListResult>('/auth/apps', query),
  getApp: (id: number) => api.get<APIApp>(appPath(id)),
  createApp: (body: CreateAPIAppInput) => api.post<APIApp>('/auth/apps', body),
  updateApp: (id: number, body: UpdateAPIAppInput) => api.put<APIApp>(appPath(id), body),
  deleteApp: (id: number) => api.delete<void>(appPath(id)),

  listSecrets: (appId: number) => api.get<APISecretListResult>(`${appPath(appId)}/secrets`),
  issueSecret: (appId: number, body: IssueAPISecretInput) =>
    api.post<IssuedAPISecret>(`${appPath(appId)}/secrets`, body),
  updateSecret: (appId: number, secretId: string, body: UpdateAPISecretInput) =>
    api.put<APISecret>(secretPath(appId, secretId), body),
  deleteSecret: (appId: number, secretId: string) => api.delete<void>(secretPath(appId, secretId)),
  blockSecret: (appId: number, secretId: string) =>
    api.post<APISecret>(`${secretPath(appId, secretId)}/block`),
  unblockSecret: (appId: number, secretId: string) =>
    api.post<APISecret>(`${secretPath(appId, secretId)}/unblock`),
  reissueSecret: (appId: number, secretId: string, body: ReissueAPISecretInput) =>
    api.post<IssuedAPISecret>(`${secretPath(appId, secretId)}/reissue`, body),
}

import { describe, expect, it } from 'vitest'

import {
  buildReservationQuery,
  closeReasonLabel,
  formatReservationSource,
  reservationStatusLabel,
  RESERVATION_PAGE_SIZE,
} from './reservation-list'

describe('buildReservationQuery', () => {
  it('sends no filters when they are empty', () => {
    expect(buildReservationQuery({ warehouseId: null, skuId: null, status: null }, 0)).toEqual({
      limit: RESERVATION_PAGE_SIZE,
      offset: 0,
    })
  })

  it('sends only the selected filters', () => {
    expect(buildReservationQuery({ warehouseId: 3, skuId: 7, status: 'closed' }, 100)).toEqual({
      warehouse_id: 3,
      sku_id: 7,
      status: 'closed',
      limit: RESERVATION_PAGE_SIZE,
      offset: 100,
    })
  })

  it('never sends a negative offset', () => {
    expect(
      buildReservationQuery({ warehouseId: null, skuId: null, status: null }, -100).offset,
    ).toBe(0)
  })

  it('uses the backend MaxListLimit as the page size', () => {
    expect(RESERVATION_PAGE_SIZE).toBe(100)
  })
})

describe('status labels', () => {
  it('maps reservation lifecycle statuses', () => {
    expect(reservationStatusLabel('active')).toBe('占用中')
    expect(reservationStatusLabel('closed')).toBe('已关闭')
    expect(reservationStatusLabel('unknown')).toBe('unknown')
  })

  it('maps every close reason and keeps a placeholder for null', () => {
    expect(closeReasonLabel('consumed')).toBe('已消耗')
    expect(closeReasonLabel('released')).toBe('已释放')
    expect(closeReasonLabel('mixed')).toBe('混合关闭')
    expect(closeReasonLabel('cancelled')).toBe('已取消')
    expect(closeReasonLabel('expired')).toBe('已过期')
    expect(closeReasonLabel(null)).toBe('-')
    expect(closeReasonLabel(undefined)).toBe('-')
  })
})

describe('formatReservationSource', () => {
  it('joins the available source identifiers', () => {
    expect(
      formatReservationSource({
        source_type: 'sales_order',
        source_id: '1',
        source_line_id: '2',
      }),
    ).toBe('sales_order / 1 / 2')
  })

  it('skips empty segments and falls back to a placeholder', () => {
    expect(
      formatReservationSource({
        source_type: 'sales_order',
        source_id: null,
        source_line_id: null,
      }),
    ).toBe('sales_order')
    expect(
      formatReservationSource({ source_type: null, source_id: null, source_line_id: null }),
    ).toBe('-')
  })
})

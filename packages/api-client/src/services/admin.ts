import { apiDelete, apiGet, apiPost } from '../client/http';
import type { ApiEnvelope } from '../client/types';

/** Admin catalog / vendor bulk import (tag 18) */
export const adminService = {
  importCatalogCsv: (vendorId: number | string, body: unknown) =>
    apiPost<ApiEnvelope>(`/v1/admin/vendors/${vendorId}/catalog-import`, body),
  importCatalogJson: (vendorId: number | string, body: unknown) =>
    apiPost<ApiEnvelope>(`/v1/admin/vendors/${vendorId}/catalog-import-json`, body),
  catalogSummary: (vendorId: number | string) =>
    apiGet<ApiEnvelope>(`/v1/admin/vendors/${vendorId}/catalog-summary`),
  deleteCatalog: (vendorId: number | string) =>
    apiDelete<ApiEnvelope>(`/v1/admin/vendors/${vendorId}/catalog`),
  bulkImportVendorsCsv: (body: unknown) =>
    apiPost<ApiEnvelope>('/v1/admin/vendor-bulk-import', body),
  bulkImportVendorsJson: (body: unknown) =>
    apiPost<ApiEnvelope>('/v1/admin/vendor-bulk-import-json', body),
};

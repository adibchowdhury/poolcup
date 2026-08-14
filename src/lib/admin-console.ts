import { createAdminSupabaseClient } from '@/src/lib/supabase/admin'
import { requireAdminUser } from '@/src/lib/admin-sync'

export async function requireAdminService() {
  const admin = await requireAdminUser()
  if (!admin) return null
  return {
    userId: admin.userId,
    service: createAdminSupabaseClient(),
  }
}

export type {
  AdminMetrics,
  AdminUserLookupRow,
  AdminUserDetail,
  AdminPoolLookupRow,
  AdminPoolDetail,
  AdminMatchLookupRow,
  AdminFailedWebhookRow,
  AdminAuditLogRow,
  AdminReportQueueRow,
  AdminReportType,
  AdminReportStatusFilter,
  AdminReportTypeFilter,
} from '@/src/lib/admin-console-shared'

export { ADMIN_NAV } from '@/src/lib/admin-console-shared'

export type TicketStatus = 'waiting' | 'called' | 'serving' | 'done' | 'skipped'

export interface Org {
  id: string
  name: string
  logo_url: string | null
  brand_color: string
  owner_id: string
  created_at: string
}

export interface Branch {
  id: string
  org_id: string
  slug: string
  name: string
  address: string | null
  prefix: string
  is_active: boolean
  created_at: string
}

export interface Service {
  id: string
  branch_id: string
  name: string
  avg_minutes: number
  sort_order: number
  is_active: boolean
}

export interface Operator {
  id: string
  branch_id: string
  name: string
  pin: string | null
  is_active: boolean
}

export interface Ticket {
  id: string
  branch_id: string
  service_id: string | null
  code: string
  seq: number
  status: TicketStatus
  visitor_name: string | null
  visitor_phone: string | null
  joined_at: string
  called_at: string | null
  done_at: string | null
}

export interface BranchLive {
  branch_id: string
  slug: string
  name: string
  is_active: boolean
  waiting_count: number
  current_code: string | null
  last_called_at: string | null
}

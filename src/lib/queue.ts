import { supabase } from './supabase'
import type { Branch, BranchLive, Operator, Service, Ticket } from './types'

/** Ziyarətçi növbəyə qoşulur — atomik RPC, yarış şəraiti yoxdur */
export async function joinQueue(opts: {
  branchId: string
  serviceId?: string | null
  name?: string | null
  phone?: string | null
}): Promise<Ticket> {
  const { data, error } = await supabase.rpc('join_queue', {
    p_branch_id: opts.branchId,
    p_service_id: opts.serviceId ?? null,
    p_name: opts.name ?? null,
    p_phone: opts.phone ?? null,
  })
  if (error) throw new Error(error.message)
  return data as Ticket
}

/** Operator: növbətini çağır (seçilən əməkdaşa bağlanır) */
export async function callNext(branchId: string, operatorId?: string | null): Promise<Ticket | null> {
  const { data, error } = await supabase.rpc('call_next', {
    p_branch_id: branchId,
    p_operator_id: operatorId ?? null,
  })
  if (error) {
    if (error.message.includes('gözləyən yoxdur')) return null
    throw new Error(error.message)
  }
  return data as Ticket
}

/** Geri çağır */
export async function recallTicket(ticketId: string): Promise<Ticket> {
  const { data, error } = await supabase.rpc('recall_ticket', { p_ticket_id: ticketId })
  if (error) throw new Error(error.message)
  return data as Ticket
}

/**
 * Çağırılmış biletin xidmətini tamamla (status → done).
 * 1) `finish_ticket` RPC (DB-də varsa — hər kəs üçün işləyir)
 * 2) fallback: birbaşa update — RLS org sahibinə icazə verir
 */
export async function finishTicket(ticketId: string): Promise<void> {
  const { error } = await supabase.rpc('finish_ticket', { p_ticket_id: ticketId })
  if (!error) return
  // RPC yoxdur / xəta → RLS ilə birbaşa update
  const { error: upd } = await supabase
    .from('tickets')
    .update({ status: 'done', done_at: new Date().toISOString() })
    .eq('id', ticketId)
    .in('status', ['called', 'serving'])
  if (upd) throw new Error(upd.message)
}

/** Nömrəni xidmətə / əməkdaşa yönləndir */
export async function redirectTicket(opts: {
  ticketId: string
  serviceId?: string | null
  operatorId?: string | null
  backToQueue?: boolean
}): Promise<Ticket> {
  const { data, error } = await supabase.rpc('redirect_ticket', {
    p_ticket_id: opts.ticketId,
    p_service_id: opts.serviceId ?? null,
    p_operator_id: opts.operatorId ?? null,
    p_back_to_queue: opts.backToQueue ?? false,
  })
  if (error) throw new Error(error.message)
  return data as Ticket
}

/** Filialın operatorları */
export async function getOperators(branchId: string): Promise<Operator[]> {
  const { data, error } = await supabase
    .from('operators')
    .select('*')
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as Operator[]
}

/** Filialı slug ilə tap */
export async function getBranchBySlug(slug: string): Promise<Branch | null> {
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as Branch | null
}

/** Xidmətləri getir */
export async function getServices(branchId: string): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .order('sort_order')
  if (error) throw new Error(error.message)
  return (data ?? []) as Service[]
}

/** Cari canlı vəziyyət (gözləmə zalı ekranı / panel) */
export async function getLive(branchId: string): Promise<BranchLive | null> {
  const { data, error } = await supabase
    .from('branch_live')
    .select('*')
    .eq('branch_id', branchId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as BranchLive | null
}

/** Gözləyənlərin siyahısı */
export async function getWaiting(branchId: string): Promise<Ticket[]> {
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('branch_id', branchId)
    .eq('status', 'waiting')
    .order('seq', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as Ticket[]
}

/** Son çağırılan (hazırda xidmətdə olan) */
export async function getCurrent(branchId: string): Promise<Ticket | null> {
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('branch_id', branchId)
    .in('status', ['called', 'serving'])
    .order('called_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as Ticket | null
}

/**
 * Real-time abunə: tickets cədvəlində dəyişiklik olanda cb çağırılır.
 * Ziyarətçi, panel və ekran hamısı bununla canlı yenilənir.
 */
export function subscribeBranch(branchId: string, cb: () => void) {
  const channel = supabase
    .channel(`branch:${branchId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tickets', filter: `branch_id=eq.${branchId}` },
      cb,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'queue_counters' },
      cb,
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

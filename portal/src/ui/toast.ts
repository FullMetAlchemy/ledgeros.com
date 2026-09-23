import { createContext, useContext } from 'react'

export type ToastKind = 'success' | 'error' | 'info'
export type PushToast = (kind: ToastKind, title: string, body?: string) => void

export const ToastContext = createContext<PushToast>(() => {})

export function useToast(): PushToast {
  return useContext(ToastContext)
}

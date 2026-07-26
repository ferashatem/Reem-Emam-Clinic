import { useLocation } from 'react-router-dom'

/**
 * The partners' screens are mounted under both /admin and /super-admin.
 * This keeps in-page links pointing at the tree the user actually came from.
 */
export function useBasePath(): '/admin' | '/super-admin' {
  const { pathname } = useLocation()
  return pathname.startsWith('/super-admin') ? '/super-admin' : '/admin'
}

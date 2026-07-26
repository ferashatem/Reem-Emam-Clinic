import { useCallback, useEffect, useRef, useState } from 'react'

interface LoaderState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

/**
 * Runs an async fetcher and tracks loading / error / retry in one place, so
 * every screen handles failures the same way instead of silently showing an
 * empty table. Late responses from a superseded call are discarded.
 *
 * `deps` are stringified into a key, so pass primitives (ids, dates) — the
 * fetcher itself is read from a ref and never needs to be memoised.
 */
export function useLoader<T>(fetcher: () => Promise<T>, deps: unknown[] = []): LoaderState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  // Declared before the fetching effect, so it always holds the latest closure
  // by the time that effect runs.
  const fetcherRef = useRef(fetcher)
  useEffect(() => { fetcherRef.current = fetcher })

  const runId = useRef(0)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const depsKey = deps.map(d => String(d)).join('|')

  useEffect(() => {
    const id = ++runId.current
    const live = () => mounted.current && id === runId.current

    // Fetching is exactly the "synchronise with an external system" case the
    // set-state-in-effect rule carves out; it just can't see it from here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)

    fetcherRef.current()
      .then(result => { if (live()) setData(result) })
      .catch((err: unknown) => {
        if (!live()) return
        console.error('useLoader:', err)
        setError(messageFor(err))
      })
      .finally(() => { if (live()) setLoading(false) })
  }, [depsKey, tick])

  const reload = useCallback(() => setTick(t => t + 1), [])

  return { data, loading, error, reload }
}

/** Turns Firebase / network errors into something a receptionist can act on. */
export function messageFor(err: unknown): string {
  const code = (err as { code?: string } | null)?.code ?? ''
  if (code.includes('permission-denied')) return 'مالكيش صلاحية للوصول لهذه البيانات'
  if (code.includes('unavailable') || code.includes('network')) return 'مفيش اتصال بالإنترنت — حاولي تاني'
  if (code.includes('not-found')) return 'البيانات المطلوبة مش موجودة'
  if (code.includes('already-exists')) return 'البيانات دي مسجلة قبل كده'
  if (code.includes('failed-precondition')) return 'حصل تعارض في البيانات — حدّثي الصفحة وحاولي تاني'
  const message = (err as { message?: string } | null)?.message
  return message && message.length < 120 ? message : 'حصل خطأ غير متوقع — حاولي تاني'
}

import { useEffect, useRef, type MouseEvent } from 'react'
import type { TicketStatus } from '@shared/types'
import { formatTicketNumber, parseTicketNumber } from '@shared/tickets/numbers'
import { boardIndexForQuery, unpackTicketCell } from '@shared/tickets/board'

const GAP = 6
const ASPECT = 1.15
const OVERSCAN = 2

const FILL = ['#ffffff', '#fff9c4', '#8cff4a', '#e53935']
const STROKE = ['#d7e0dc', '#f6e05e', '#5ed100', '#b71c1c']
const TEXT = ['#3d4a45', '#5c4a00', '#1b3d00', '#ffffff']

function columnsForWidth(width: number): number {
  if (width >= 768) return 10
  if (width >= 640) return 8
  return 5
}

function scrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null
  while (node) {
    const { overflowY } = getComputedStyle(node)
    if (overflowY === 'auto' || overflowY === 'scroll') return node
    node = node.parentElement
  }
  return null
}

function scrollCellIntoView(wrap: HTMLElement, index: number, cols: number, rowH: number): void {
  const row = Math.floor(index / cols)
  const scroller = scrollParent(wrap)
  const wrapRect = wrap.getBoundingClientRect()
  if (scroller) {
    const sRect = scroller.getBoundingClientRect()
    const cellTop = scroller.scrollTop + (wrapRect.top - sRect.top) + row * rowH
    const margin = Math.min(scroller.clientHeight * 0.28, 180)
    scroller.scrollTo({ top: Math.max(0, cellTop - margin), behavior: 'smooth' })
    return
  }
  const cellTop = window.scrollY + wrapRect.top + row * rowH
  window.scrollTo({ top: Math.max(0, cellTop - 140), behavior: 'smooth' })
}

export function TicketBoardCanvas({
  first,
  packed,
  statusFilter,
  query,
  onPick
}: {
  first: number
  packed: number[]
  statusFilter: TicketStatus | ''
  query: string
  onPick: (number: number, status: TicketStatus, isSettled: boolean) => void
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const layoutRef = useRef({ cols: 10, rowH: 48, cellW: 40, width: 800 })
  const scrolledKeyRef = useRef('')

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const scroller = scrollParent(wrap)
    let frame = 0

    const paint = () => {
      const width = wrap.clientWidth || 800
      const cols = columnsForWidth(width)
      const cellW = (width - GAP * (cols - 1)) / cols
      const cellH = cellW / ASPECT
      const rowH = cellH + GAP
      const rows = Math.max(1, Math.ceil(packed.length / cols))
      wrap.style.height = `${rows * rowH}px`
      layoutRef.current = { cols, rowH, cellW, width }

      const scrollKey = `${query}|${first}|${packed.length}|${cols}`
      if (scrollKey !== scrolledKeyRef.current) {
        scrolledKeyRef.current = scrollKey
        const hit = boardIndexForQuery(first, packed.length, query)
        if (hit != null) {
          requestAnimationFrame(() => scrollCellIntoView(wrap, hit, cols, rowH))
        }
      }

      const viewTop = scroller ? scroller.getBoundingClientRect().top : 0
      const viewH = scroller ? scroller.clientHeight : window.innerHeight
      const wrapRect = wrap.getBoundingClientRect()
      const scrolled = Math.max(0, viewTop - wrapRect.top)
      const startRow = Math.max(0, Math.floor(scrolled / rowH) - OVERSCAN)
      const visibleRows = Math.ceil(viewH / rowH) + OVERSCAN * 2
      const endRow = Math.min(rows, startRow + visibleRows)

      canvas.style.top = `${startRow * rowH}px`
      canvas.style.height = `${(endRow - startRow) * rowH}px`

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const cssH = Math.max(1, (endRow - startRow) * rowH)
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(cssH * dpr)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, cssH)
      ctx.font = '700 11px Outfit, ui-sans-serif, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const q = query.trim()
      const qNumber = parseTicketNumber(q)
      const statusIndex =
        statusFilter === 'SIN_VENDER'
          ? 0
          : statusFilter === 'EN_ABONOS'
            ? 1
            : statusFilter === 'CANCELADA'
              ? 2
              : statusFilter === 'PERDIDA'
                ? 3
                : -1

      const radius = 8
      for (let row = startRow; row < endRow; row++) {
        for (let col = 0; col < cols; col++) {
          const i = row * cols + col
          if (i >= packed.length) continue
          const cell = packed[i]
          const status = cell & 3
          const settled = (cell & 4) !== 0
          const number = first + i
          const dim =
            (statusIndex >= 0 && status !== statusIndex) ||
            (qNumber != null && number !== qNumber) ||
            (qNumber == null &&
              q.length > 0 &&
              !String(number).includes(q) &&
              !formatTicketNumber(number).includes(q))
          const x = col * (cellW + GAP)
          const y = (row - startRow) * rowH
          ctx.globalAlpha = dim ? 0.22 : 1
          ctx.beginPath()
          ctx.roundRect(x, y, cellW, cellH, radius)
          ctx.fillStyle = FILL[status]
          ctx.fill()
          ctx.lineWidth = qNumber === number ? 2.5 : 1
          ctx.strokeStyle = qNumber === number ? '#05411f' : STROKE[status]
          ctx.stroke()
          ctx.fillStyle = TEXT[status]
          ctx.fillText(formatTicketNumber(number), x + cellW / 2, y + cellH / 2)
          if (settled) {
            ctx.beginPath()
            ctx.arc(x + cellW - 7, y + 7, 3.2, 0, Math.PI * 2)
            ctx.fillStyle = '#123d2c'
            ctx.fill()
          }
          ctx.globalAlpha = 1
        }
      }
    }

    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(paint)
    }

    paint()
    const ro = new ResizeObserver(schedule)
    ro.observe(wrap)
    const target: Window | HTMLElement = scroller ?? window
    target.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
      target.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [first, packed, query, statusFilter])

  function onClick(e: MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const { cols, rowH, cellW } = layoutRef.current
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const col = Math.floor(x / (cellW + GAP))
    const localRow = Math.floor(y / rowH)
    if (col < 0 || col >= cols || x > col * (cellW + GAP) + cellW) return
    const canvasTop = parseFloat(canvas.style.top || '0')
    const row = Math.floor(canvasTop / rowH) + localRow
    const i = row * cols + col
    if (i < 0 || i >= packed.length) return
    const unpacked = unpackTicketCell(packed[i])
    onPick(first + i, unpacked.status, unpacked.isSettled)
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full cursor-pointer"
        onClick={onClick}
      />
    </div>
  )
}

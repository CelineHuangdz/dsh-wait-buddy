    // ---------------------------------------------------------------------
    // §6 Canvas drawing. Imperative painting shared by the full view and the
    // floating panel; never holds module-level DOM refs (D8).
    // ---------------------------------------------------------------------
    function drawGame(canvas, state) {
      if (canvas === null || canvas === undefined) return
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (width === 0 || height === 0) return
      const ctx = canvas.getContext('2d')
      if (ctx === null) return

      const backingW = Math.round(width * 2)
      const backingH = Math.round(height * 2)
      if (canvas.width !== backingW || canvas.height !== backingH) {
        canvas.width = backingW
        canvas.height = backingH
      }
      ctx.setTransform(2, 0, 0, 2, 0, 0)
      ctx.clearRect(0, 0, width, height)

      ctx.fillStyle = '#0d1624'
      ctx.fillRect(0, 0, width, height)

      const cellW = width / state.cols
      const cellH = height / state.rows

      ctx.fillStyle = 'rgba(255,255,255,0.05)'
      for (let y = 1; y < state.rows; y += 1) {
        for (let x = 1; x < state.cols; x += 1) {
          ctx.fillRect(x * cellW - 1, y * cellH - 1, 2, 2)
        }
      }

      const unit = Math.min(cellW, cellH)

      if (state.food !== null) {
        const fx = state.food.x * cellW + cellW / 2
        const fy = state.food.y * cellH + cellH / 2
        ctx.beginPath()
        ctx.arc(fx, fy, unit * 0.42, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(246,196,83,0.35)'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(fx, fy, unit * 0.27, 0, Math.PI * 2)
        ctx.fillStyle = '#f6c453'
        ctx.fill()
      }

      state.snake.forEach((segment, index) => {
        const insetX = Math.min(2, cellW * 0.12)
        const insetY = Math.min(2, cellH * 0.12)
        ctx.fillStyle =
          index === 0
            ? '#8ef7b0'
            : `rgba(63,206,122,${Math.max(0.45, 0.9 - index * 0.04)})`
        ctx.fillRect(
          segment.x * cellW + insetX,
          segment.y * cellH + insetY,
          cellW - insetX * 2,
          cellH - insetY * 2,
        )
      })

      const head = state.snake[0]
      const vector = DIR_VECTORS[state.dir]
      const hx = head.x * cellW + cellW / 2 + vector.x * unit * 0.14
      const hy = head.y * cellH + cellH / 2 + vector.y * unit * 0.14
      const px = -vector.y
      const py = vector.x
      const eye = Math.max(1.2, unit * 0.09)
      ctx.fillStyle = '#06240f'
      ctx.beginPath()
      ctx.arc(hx + px * unit * 0.18, hy + py * unit * 0.18, eye, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(hx - px * unit * 0.18, hy - py * unit * 0.18, eye, 0, Math.PI * 2)
      ctx.fill()
    }

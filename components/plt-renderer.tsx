"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Play, Pause, RotateCcw, ZoomIn, ZoomOut, MoveHorizontal } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"

interface PltRendererProps {
  data: {
    commands: string[]
    points: { x: number; y: number }[]
    textElements?: { text: string; x: number; y: number; size?: number }[]
    segments?: {
      name: string
      commands: string[]
      points: { x: number; y: number }[]
    }[]
    rawContent: string
    method?: string
  }
  onLog?: (message: string, type?: "info" | "warning" | "error" | "success") => void
}

// Componente para renderizar as miniaturas
interface SegmentThumbnailProps {
  segment: {
    name: string
    commands: string[]
    points: { x: number; y: number }[]
    transformedPoints?: { x: number; y: number }[]
  }
  isSelected: boolean
}

function SegmentThumbnail({ segment, isSelected }: SegmentThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !segment.transformedPoints || segment.transformedPoints.length === 0) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Limpar o canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Encontrar os limites dos pontos transformados
    let minX = Number.POSITIVE_INFINITY,
      minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY,
      maxY = Number.NEGATIVE_INFINITY

    segment.transformedPoints.forEach((point) => {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    })

    // Calcular a escala para ajustar ao tamanho do canvas
    const width = maxX - minX || 1
    const height = maxY - minY || 1
    const scaleX = (canvas.width - 8) / width
    const scaleY = (canvas.height - 8) / height
    const scale = Math.min(scaleX, scaleY)

    // Calcular o deslocamento para centralizar
    const offsetX = (canvas.width - width * scale) / 2
    const offsetY = (canvas.height - height * scale) / 2

    // Configurar o estilo
    ctx.strokeStyle = isSelected ? "#0066cc" : "#999999"
    ctx.lineWidth = 1.5
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    // Desenhar o segmento
    let penDown = false

    for (let i = 0; i < segment.transformedPoints.length; i++) {
      const command = segment.commands[i] || "PU"
      const point = segment.transformedPoints[i]

      if (!point) continue

      // Transformar o ponto para o canvas da miniatura
      const x = offsetX + (point.x - minX) * scale
      const y = offsetY + (point.y - minY) * scale

      if (command === "PD") {
        if (!penDown) {
          ctx.beginPath()
          ctx.moveTo(x, y)
          penDown = true
        } else {
          ctx.lineTo(x, y)
        }
      } else if (command === "PU") {
        if (penDown) {
          ctx.stroke()
          penDown = false
        }
        ctx.beginPath()
        ctx.moveTo(x, y)
      }
    }

    if (penDown) {
      ctx.stroke()
    }
  }, [segment, isSelected])

  return (
    <canvas
      ref={canvasRef}
      width={100}
      height={60}
      className={`border rounded-md ${isSelected ? "border-primary" : "border-gray-200"} bg-white`}
    />
  )
}

export default function PltRenderer({ data, onLog }: PltRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [renderProgress, setRenderProgress] = useState(0)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [activeTab, setActiveTab] = useState("visual")
  const [selectedSegments, setSelectedSegments] = useState<Record<string, boolean>>({})
  const [showAllSegments, setShowAllSegments] = useState(true)
  const [thumbnailsReady, setThumbnailsReady] = useState(false)
  const isDraggingRef = useRef(false)
  const lastPanPositionRef = useRef({ x: 0, y: 0 })
  const isInitializedRef = useRef(false)
  const renderedPointsRef = useRef<{
    points: { x: number; y: number }[]
    commands: string[]
    textElements?: { text: string; x: number; y: number; size?: number; transformedX?: number; transformedY?: number }[]
    segments?: {
      name: string
      commands: string[]
      points: { x: number; y: number }[]
      transformedPoints?: { x: number; y: number }[]
    }[]
    minX: number
    minY: number
    maxX: number
    maxY: number
    scale: number
    transformedPoints: { x: number; y: number }[]
  } | null>(null)

  // Referência para armazenar o estado da visualização quando mudamos de aba
  const visualStateRef = useRef({
    isAnimating: false,
    isComplete: false,
    renderProgress: 0,
    zoomLevel: 1,
    panOffset: { x: 0, y: 0 },
  })

  // Inicializar os segmentos selecionados
  useEffect(() => {
    if (data.segments && data.segments.length > 0) {
      const initialSegments: Record<string, boolean> = {}
      data.segments.forEach((segment) => {
        initialSegments[segment.name] = true
      })
      setSelectedSegments(initialSegments)
    }
  }, [data.segments])

  // Função para registrar logs - usando useCallback para evitar recriações
  const log = useCallback(
    (message: string, type: "info" | "warning" | "error" | "success" = "info") => {
      if (onLog) {
        setTimeout(() => {
          onLog(message, type)
        }, 0)
      }
    },
    [onLog],
  )

  // Função para desenhar uma grade de fundo
  const drawGrid = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      ctx.save()
      ctx.strokeStyle = "#e5e5e5"
      ctx.lineWidth = 0.5

      // Aplicar zoom e pan
      ctx.translate(panOffset.x, panOffset.y)
      ctx.scale(zoomLevel, zoomLevel)

      // Calcular o tamanho da grade com base no zoom
      const gridSize = 50 / zoomLevel
      const startX = -panOffset.x / zoomLevel
      const startY = -panOffset.y / zoomLevel
      const endX = (width - panOffset.x) / zoomLevel
      const endY = (height - panOffset.y) / zoomLevel

      // Linhas horizontais
      for (let y = Math.floor(startY / gridSize) * gridSize; y < endY; y += gridSize) {
        ctx.beginPath()
        ctx.moveTo(startX, y)
        ctx.lineTo(endX, y)
        ctx.stroke()
      }

      // Linhas verticais
      for (let x = Math.floor(startX / gridSize) * gridSize; x < endX; x += gridSize) {
        ctx.beginPath()
        ctx.moveTo(x, startY)
        ctx.lineTo(x, endY)
        ctx.stroke()
      }

      ctx.restore()
    },
    [zoomLevel, panOffset],
  )

  // Função para desenhar um segmento específico
  const drawSegment = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      segment: {
        name: string
        commands: string[]
        points: { x: number; y: number }[]
        transformedPoints?: { x: number; y: number }[]
      },
    ) => {
      if (!segment.transformedPoints || segment.transformedPoints.length === 0) return

      let penDown = false

      // Desenhar todos os pontos do segmento
      for (let i = 0; i < segment.transformedPoints.length; i++) {
        const command = segment.commands[i] || "PU"
        const point = segment.transformedPoints[i]

        if (!point) continue

        if (command === "PD") {
          if (!penDown) {
            ctx.beginPath()
            ctx.moveTo(point.x, point.y)
            penDown = true
          } else {
            ctx.lineTo(point.x, point.y)
          }
        } else if (command === "PU") {
          if (penDown) {
            ctx.stroke()
            penDown = false
          }
          ctx.beginPath()
          ctx.moveTo(point.x, point.y)
        }
      }

      if (penDown) {
        ctx.stroke()
      }
    },
    [],
  )

  // Função para desenhar o conteúdo atual no canvas
  const drawCanvas = useCallback(() => {
    if (!canvasRef.current || !data.points.length) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Limpar o canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Desenhar a grade
    drawGrid(ctx, canvas.width, canvas.height)

    // Se não temos pontos renderizados ou se estamos no início da animação, não desenhar nada
    if (!renderedPointsRef.current || (!isComplete && !isAnimating)) return

    const { commands, transformedPoints, textElements, segments } = renderedPointsRef.current

    // Aplicar zoom e pan
    ctx.save()
    ctx.translate(panOffset.x, panOffset.y)
    ctx.scale(zoomLevel, zoomLevel)

    // Configurar estilo de desenho
    ctx.strokeStyle = "#0066cc"
    ctx.lineWidth = 1.5 / zoomLevel
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    // Se temos segmentos e não estamos mostrando todos, desenhar apenas os selecionados
    if (segments && segments.length > 0 && !showAllSegments) {
      segments.forEach((segment) => {
        if (selectedSegments[segment.name]) {
          drawSegment(ctx, segment)
        }
      })
    } else {
      // Desenhar todos os pontos até o índice atual
      let penDown = false

      // Calcular o número de pontos a desenhar com base no progresso
      const pointsToDraw = isComplete
        ? transformedPoints.length
        : Math.floor((transformedPoints.length * renderProgress) / 100)

      for (let i = 0; i < pointsToDraw; i++) {
        const command = commands[i] || "PU"
        const point = transformedPoints[i]

        if (!point) continue

        if (command === "PD") {
          if (!penDown) {
            ctx.beginPath()
            ctx.moveTo(point.x, point.y)
            penDown = true
          } else {
            ctx.lineTo(point.x, point.y)
          }
        } else if (command === "PU") {
          if (penDown) {
            ctx.stroke()
            penDown = false
          }
          ctx.beginPath()
          ctx.moveTo(point.x, point.y)
        }
      }

      if (penDown) {
        ctx.stroke()
      }
    }

    // Desenhar textos se a renderização estiver completa
    if (isComplete && textElements && textElements.length > 0) {
      // Ajustar o tamanho da fonte com base no zoom
      const baseFontSize = 16 / zoomLevel

      textElements.forEach((textElement) => {
        if (textElement.transformedX !== undefined && textElement.transformedY !== undefined) {
          const fontSize = (textElement.size || baseFontSize) / zoomLevel

          // Estilo para destacar os textos
          ctx.font = `bold ${fontSize}px Arial`

          // Adicionar um contorno para melhorar a visibilidade
          ctx.strokeStyle = "#ffffff"
          ctx.lineWidth = 3 / zoomLevel
          ctx.strokeText(textElement.text, textElement.transformedX, textElement.transformedY)

          // Texto principal
          ctx.fillStyle = "#ff0000" // Vermelho para destacar
          ctx.fillText(textElement.text, textElement.transformedX, textElement.transformedY)
        }
      })
    }

    ctx.restore()
  }, [
    data.points,
    drawGrid,
    drawSegment,
    isAnimating,
    isComplete,
    panOffset,
    renderProgress,
    selectedSegments,
    showAllSegments,
    zoomLevel,
  ])

  // Função para limpar e reiniciar o canvas
  const resetCanvas = useCallback(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setRenderProgress(0)
    setIsComplete(false)
    renderedPointsRef.current = null
    setThumbnailsReady(false)

    // Desenhar uma grade de fundo para melhor visualização
    drawGrid(ctx, canvas.width, canvas.height)
    log("Canvas reiniciado", "info")
  }, [drawGrid, log])

  // Função para renderizar o desenho completo de uma vez
  const renderFullDrawing = useCallback(() => {
    if (!canvasRef.current || !data.points.length) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    log("Iniciando renderização completa", "info")
    setIsAnimating(true)
    setRenderProgress(0)
    setThumbnailsReady(false)

    const startTime = performance.now()
    log(`Renderização iniciada às ${new Date().toLocaleTimeString()}`, "info")

    // Limpar o canvas e desenhar a grade
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawGrid(ctx, canvas.width, canvas.height)

    // Encontrar os limites dos pontos para escalar corretamente
    let minX = Number.POSITIVE_INFINITY,
      minY = Number.POSITIVE_INFINITY,
      maxX = Number.NEGATIVE_INFINITY,
      maxY = Number.NEGATIVE_INFINITY

    data.points.forEach((point) => {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    })

    // Adicionar margem
    const margin = 40
    const width = canvas.width - 2 * margin
    const height = canvas.height - 2 * margin

    // Calcular escala
    const rangeX = maxX - minX || 1
    const rangeY = maxY - minY || 1
    const scaleX = width / rangeX
    const scaleY = height / rangeY
    const scale = Math.min(scaleX, scaleY) * 0.9 // 90% para ter uma margem extra

    log(`Dimensões do desenho: ${rangeX} x ${rangeY}, Escala: ${scale.toFixed(6)}`, "info")

    // Função para transformar coordenadas PLT para coordenadas do canvas
    const transformPoint = (x: number, y: number) => {
      return {
        x: margin + (x - minX) * scale,
        y: canvas.height - margin - (y - minY) * scale,
      }
    }

    // Pré-calcular todos os pontos transformados
    const transformedPoints = data.points.map((point) => transformPoint(point.x, point.y))

    // Transformar as coordenadas dos textos, se houver
    const transformedTextElements = data.textElements
      ? data.textElements.map((textElement) => ({
          ...textElement,
          transformedX: transformPoint(textElement.x, textElement.y).x,
          transformedY: transformPoint(textElement.x, textElement.y).y,
        }))
      : []

    // Transformar as coordenadas dos segmentos, se houver
    const transformedSegments = data.segments
      ? data.segments.map((segment) => ({
          ...segment,
          transformedPoints: segment.points.map((point) => transformPoint(point.x, point.y)),
        }))
      : []

    if (transformedTextElements.length > 0) {
      log(`Transformadas coordenadas para ${transformedTextElements.length} elementos de texto`, "info")
    }

    if (transformedSegments.length > 0) {
      log(`Transformadas coordenadas para ${transformedSegments.length} segmentos`, "info")
    }

    // Armazenar os dados de renderização para uso posterior (zoom, pan, etc.)
    renderedPointsRef.current = {
      points: data.points,
      commands: data.commands,
      textElements: transformedTextElements,
      segments: transformedSegments,
      minX,
      minY,
      maxX,
      maxY,
      scale,
      transformedPoints,
    }

    // Desenhar em lotes para não travar a UI
    const totalPoints = data.points.length
    const batchSize = 100
    let currentIndex = 0

    const drawNextBatch = () => {
      const endIndex = Math.min(currentIndex + batchSize, totalPoints)
      currentIndex = endIndex

      const progress = Math.round((currentIndex / totalPoints) * 100)
      setRenderProgress(progress)

      // Redesenhar o canvas com o progresso atual
      drawCanvas()

      // Registrar o progresso a cada 10%
      if (progress % 10 === 0 || progress === 100) {
        const elapsedTime = ((performance.now() - startTime) / 1000).toFixed(1)
        log(
          `Renderização: ${progress}% concluído (${currentIndex} de ${totalPoints} pontos) - ${elapsedTime}s decorridos`,
          "info",
        )
      }

      if (currentIndex < totalPoints) {
        // Continuar com o próximo lote
        setTimeout(drawNextBatch, 0)
      } else {
        // Finalizar a renderização
        const totalTime = ((performance.now() - startTime) / 1000).toFixed(1)
        log(`Renderização concluída em ${totalTime}s`, "success")
        setIsAnimating(false)
        setIsComplete(true)
        setThumbnailsReady(true)
      }
    }

    // Iniciar o desenho
    setTimeout(drawNextBatch, 0)
  }, [data, drawCanvas, drawGrid, log])

  // Iniciar a animação
  const startAnimation = useCallback(() => {
    if (isAnimating || isComplete) return
    renderFullDrawing()
  }, [isAnimating, isComplete, renderFullDrawing])

  // Pausar a animação (não implementado nesta versão simplificada)
  const pauseAnimation = useCallback(() => {
    log("Pausar não disponível nesta versão", "warning")
  }, [log])

  // Reiniciar a animação
  const restartAnimation = useCallback(() => {
    log("Reiniciando renderização", "info")
    setIsAnimating(false)
    setIsComplete(false)
    setRenderProgress(0)
    resetCanvas()
  }, [log, resetCanvas])

  // Função para aumentar o zoom
  const zoomIn = useCallback(() => {
    if (isAnimating) return
    setZoomLevel((prev) => {
      const newZoom = Math.min(prev * 1.5, 50) // Aumentei o limite máximo de zoom
      log(`Zoom aumentado para ${newZoom.toFixed(1)}x`, "info")
      return newZoom
    })
  }, [isAnimating, log])

  // Função para diminuir o zoom
  const zoomOut = useCallback(() => {
    if (isAnimating) return
    setZoomLevel((prev) => {
      const newZoom = Math.max(prev / 1.5, 0.01) // Diminuí o limite mínimo de zoom
      log(`Zoom diminuído para ${newZoom.toFixed(2)}x`, "info")
      return newZoom
    })
  }, [isAnimating, log])

  // Função para resetar o zoom e pan
  const resetView = useCallback(() => {
    if (isAnimating) return
    setPanOffset({ x: 0, y: 0 })
    setZoomLevel(1)
    log("Visualização resetada", "info")
  }, [isAnimating, log])

  // Função para alternar a seleção de um segmento
  const toggleSegment = useCallback((segmentName: string) => {
    setSelectedSegments((prev) => ({
      ...prev,
      [segmentName]: !prev[segmentName],
    }))
  }, [])

  // Função para alternar entre mostrar todos os segmentos ou apenas os selecionados
  const toggleShowAllSegments = useCallback(() => {
    setShowAllSegments((prev) => !prev)
  }, [])

  // Efeito para redesenhar o canvas quando o zoom ou pan mudam
  useEffect(() => {
    if (renderedPointsRef.current) {
      drawCanvas()
    }
  }, [zoomLevel, panOffset, drawCanvas, selectedSegments, showAllSegments])

  // Efeito para salvar o estado da visualização quando a aba muda
  useEffect(() => {
    // Quando saímos da aba de visualização, salvamos o estado atual
    if (activeTab !== "visual") {
      visualStateRef.current = {
        isAnimating,
        isComplete,
        renderProgress,
        zoomLevel,
        panOffset: { ...panOffset },
      }
    }

    // Quando voltamos para a aba de visualização, apenas redesenhamos o canvas
    // sem alterar nenhum estado
    if (activeTab === "visual") {
      // Pequeno atraso para garantir que o canvas esteja visível
      setTimeout(() => {
        drawCanvas()
      }, 50)
    }
  }, [activeTab, drawCanvas, isAnimating, isComplete, panOffset, renderProgress, zoomLevel])

  // Configurar eventos de mouse para pan
  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current

    const handleMouseDown = (e: MouseEvent) => {
      if (isAnimating) return
      isDraggingRef.current = true
      lastPanPositionRef.current = { x: e.clientX, y: e.clientY }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || isAnimating) return

      const dx = e.clientX - lastPanPositionRef.current.x
      const dy = e.clientY - lastPanPositionRef.current.y

      setPanOffset((prev) => ({
        x: prev.x + dx,
        y: prev.y + dy,
      }))

      lastPanPositionRef.current = { x: e.clientX, y: e.clientY }
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
    }

    // Adicionar suporte para zoom com a roda do mouse
    const handleWheel = (e: WheelEvent) => {
      if (isAnimating) return
      e.preventDefault()

      // Obter a posição do mouse relativa ao canvas
      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      // Calcular a posição do mouse antes do zoom (em coordenadas do mundo)
      const worldX = (mouseX - panOffset.x) / zoomLevel
      const worldY = (mouseY - panOffset.y) / zoomLevel

      // Determinar o fator de zoom com base na direção do scroll
      // Aumentei o fator para um zoom mais agressivo
      const zoomFactor = e.deltaY > 0 ? 0.8 : 1.25

      // Aplicar o novo nível de zoom
      setZoomLevel((prevZoom) => {
        const newZoom = Math.max(0.01, Math.min(50, prevZoom * zoomFactor))

        // Ajustar o deslocamento para manter o ponto sob o cursor
        setPanOffset((prevPan) => {
          const newPanX = mouseX - worldX * newZoom
          const newPanY = mouseY - worldY * newZoom
          return { x: newPanX, y: newPanY }
        })

        return newZoom
      })
    }

    canvas.addEventListener("mousedown", handleMouseDown)
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    canvas.addEventListener("wheel", handleWheel)

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown)
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
      canvas.removeEventListener("wheel", handleWheel)
    }
  }, [isAnimating, log, panOffset, zoomLevel])

  // Efeito para configurar o canvas inicialmente
  useEffect(() => {
    if (!canvasRef.current || isInitializedRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Ajustar o tamanho do canvas para o tamanho do contêiner
    const resizeCanvas = () => {
      if (isAnimating) return

      const container = canvas.parentElement
      if (container) {
        canvas.width = container.clientWidth
        canvas.height = 500 // Altura fixa ou você pode calcular baseado no contêiner
        resetCanvas()
      }
    }

    log("Canvas inicializado", "info")
    resizeCanvas()
    isInitializedRef.current = true

    const handleResize = () => {
      if (!isAnimating) {
        resizeCanvas()
        if (isComplete) {
          renderFullDrawing()
        }
      }
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [isAnimating, isComplete, log, renderFullDrawing, resetCanvas])

  // Efeito para iniciar automaticamente a renderização quando os dados mudam
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null

    if (data && data.points.length > 0 && !isAnimating && !isComplete) {
      log("Preparando para iniciar renderização automática", "info")

      // Pequeno atraso para garantir que o canvas esteja pronto
      timer = setTimeout(() => {
        renderFullDrawing()
      }, 500)
    }

    return () => {
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [data, isAnimating, isComplete, log, renderFullDrawing])

  // Função para lidar com a mudança de aba
  const handleTabChange = (value: string) => {
    setActiveTab(value)
  }

  // Renderizar o componente
  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* Painel lateral com os segmentos */}
      {data.segments && data.segments.length > 0 && (
        <div className="w-full md:w-72 bg-white border rounded-md p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">Partes do Desenho ({data.segments.length})</h3>
            <Button variant="outline" size="sm" onClick={toggleShowAllSegments} className="text-xs">
              {showAllSegments ? "Filtrar" : "Mostrar Todos"}
            </Button>
          </div>

          {data.segments.length === 0 ? (
            <div className="text-sm text-gray-500 p-4 text-center">Nenhuma parte identificada no arquivo</div>
          ) : (
            <div className="space-y-4">
              {data.segments.map((segment, index) => (
                <div key={index} className="border-b pb-3 last:border-0">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`segment-${index}`}
                      checked={selectedSegments[segment.name] || false}
                      onCheckedChange={() => toggleSegment(segment.name)}
                    />
                    <label
                      htmlFor={`segment-${index}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {segment.name}
                    </label>
                  </div>

                  {/* Mini visualização do segmento */}
                  <div className="mt-2">
                    {thumbnailsReady && renderedPointsRef.current && renderedPointsRef.current.segments ? (
                      <div className="relative">
                        <SegmentThumbnail
                          segment={renderedPointsRef.current.segments.find((s) => s.name === segment.name) || segment}
                          isSelected={selectedSegments[segment.name] || false}
                        />
                        {!selectedSegments[segment.name] && (
                          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                            <span className="text-xs text-gray-500 font-medium">Desativado</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-[60px] border rounded-md bg-gray-50 flex items-center justify-center">
                        <span className="text-xs text-gray-400">Carregando...</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Área principal */}
      <div className="flex-1">
        <Tabs defaultValue="visual" onValueChange={handleTabChange}>
          <TabsList className="mb-4">
            <TabsTrigger value="visual">Visualização</TabsTrigger>
            <TabsTrigger value="data">Dados</TabsTrigger>
            <TabsTrigger value="raw">Conteúdo Bruto</TabsTrigger>
          </TabsList>

          <TabsContent value="visual" className="mt-0">
            <Card>
              <CardContent className="p-4">
                <div className="flex justify-between mb-4">
                  <div className="space-x-2">
                    {!isAnimating ? (
                      <Button onClick={startAnimation} disabled={isComplete}>
                        <Play className="mr-2 h-4 w-4" />
                        {isComplete ? "Concluído" : "Iniciar Visualização"}
                      </Button>
                    ) : (
                      <Button onClick={pauseAnimation} variant="outline" disabled>
                        <Pause className="mr-2 h-4 w-4" />
                        Pausar
                      </Button>
                    )}
                    <Button onClick={restartAnimation} variant="outline" disabled={isAnimating}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reiniciar
                    </Button>
                  </div>

                  <div className="space-x-2">
                    <Button onClick={zoomIn} variant="outline" size="sm" disabled={isAnimating}>
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button onClick={zoomOut} variant="outline" size="sm" disabled={isAnimating}>
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <Button onClick={resetView} variant="outline" size="sm" disabled={isAnimating}>
                      <MoveHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="border rounded-md bg-white">
                  <canvas ref={canvasRef} className="w-full h-[500px] cursor-move" />
                </div>

                <div className="mt-2 text-sm text-muted-foreground">
                  {isComplete ? (
                    <p>
                      Visualização concluída. Use a roda do mouse para zoom (mantém o ponto sob o cursor). Arraste para
                      mover a visualização.
                    </p>
                  ) : isAnimating ? (
                    <p>Renderizando... ({renderProgress}% concluído)</p>
                  ) : (
                    <p>Clique em "Iniciar Visualização" para ver o desenho do arquivo PLT.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data" className="mt-0">
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Comandos ({data.commands.length})</h4>
                    <div className="max-h-[400px] overflow-y-auto border rounded-md p-2 bg-gray-50">
                      {data.commands.length > 0 ? (
                        data.commands.slice(0, 100).map((cmd, i) => (
                          <div key={i} className="text-sm font-mono py-0.5 border-b border-gray-100 last:border-0">
                            {i}: {cmd}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhum comando encontrado</p>
                      )}
                      {data.commands.length > 100 && (
                        <div className="text-sm text-muted-foreground mt-2 p-2 bg-gray-100 rounded">
                          Mostrando 100 de {data.commands.length} comandos
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Pontos ({data.points.length})</h4>
                    <div className="max-h-[400px] overflow-y-auto border rounded-md p-2 bg-gray-50">
                      {data.points.length > 0 ? (
                        data.points.slice(0, 100).map((point, i) => (
                          <div key={i} className="text-sm font-mono py-0.5 border-b border-gray-100 last:border-0">
                            {i}: ({point.x}, {point.y})
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhum ponto encontrado</p>
                      )}
                      {data.points.length > 100 && (
                        <div className="text-sm text-muted-foreground mt-2 p-2 bg-gray-100 rounded">
                          Mostrando 100 de {data.points.length} pontos
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="raw" className="mt-0">
            <Card>
              <CardContent className="p-4">
                <pre className="text-sm font-mono whitespace-pre-wrap bg-gray-50 p-4 rounded-md border max-h-[400px] overflow-y-auto">
                  {data.rawContent || "Nenhum conteúdo disponível"}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}


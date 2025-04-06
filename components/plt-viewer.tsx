"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  MoveHorizontal, 
  Ruler, 
  FileDown,
  Code,
  Maximize2,
  MinusCircle,
  PlusCircle,
  Eye,
  EyeOff,
  Layers
} from "lucide-react"
import { usePlt } from "@/contexts/plt-context"
import { jsPDF } from "jspdf"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"

interface ViewerState {
  scale: number
  rotation: number
  pan: { x: number; y: number }
  measuring: boolean
  measurePoints: { x: number; y: number }[]
}

interface Layer {
  id: string
  name: string
  visible: boolean
  color: string
  segments: number[]
}

export default function PltViewer() {
  const { pltData } = usePlt()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [viewerState, setViewerState] = useState<ViewerState>({
    scale: 1,
    rotation: 0,
    pan: { x: 0, y: 0 },
    measuring: false,
    measurePoints: []
  })
  const [selectedCommand, setSelectedCommand] = useState<string | null>(null)
  const [measurements, setMeasurements] = useState<string[]>([])
  const [layers, setLayers] = useState<Layer[]>([])

  // Função para calcular a escala inicial baseada no tamanho das peças
  const calculateInitialScale = useCallback(() => {
    if (!pltData?.segments || pltData.segments.length === 0) return 1

    // Encontrar os limites máximos e mínimos
    let minX = Infinity, minY = Infinity
    let maxX = -Infinity, maxY = -Infinity

    pltData.segments.forEach(segment => {
      segment.points.forEach(point => {
        minX = Math.min(minX, point.x)
        minY = Math.min(minY, point.y)
        maxX = Math.max(maxX, point.x)
        maxY = Math.max(maxY, point.y)
      })
    })

    const width = maxX - minX
    const height = maxY - minY
    
    // Calcular escala para caber no canvas com margem
    const scaleX = (1000 * 0.8) / width
    const scaleY = (800 * 0.8) / height
    
    return Math.min(scaleX, scaleY)
  }, [pltData])

  // Inicializar escala quando o PLT é carregado
  useEffect(() => {
    setViewerState(prev => ({
      ...prev,
      scale: calculateInitialScale(),
      pan: { x: 0, y: 0 } // Reset pan quando novo arquivo é carregado
    }))
  }, [pltData, calculateInitialScale])

  // Função para renderizar o PLT atualizada
  const renderPlt = useCallback(() => {
    if (!canvasRef.current || !pltData?.segments) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Limpar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()

    // Aplicar transformações
    ctx.translate(canvas.width/2 + viewerState.pan.x, canvas.height/2 + viewerState.pan.y)
    ctx.scale(viewerState.scale, viewerState.scale)
    ctx.rotate((viewerState.rotation * Math.PI) / 180)

    // Desenhar grid de referência
    const gridSize = 50 / viewerState.scale // Ajustar grid baseado na escala
    ctx.strokeStyle = '#eee'
    ctx.lineWidth = 0.5 / viewerState.scale
    
    const gridExtent = Math.max(canvas.width, canvas.height) / viewerState.scale
    for (let x = -gridExtent; x < gridExtent; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, -gridExtent)
      ctx.lineTo(x, gridExtent)
      ctx.stroke()
    }
    for (let y = -gridExtent; y < gridExtent; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(-gridExtent, y)
      ctx.lineTo(gridExtent, y)
      ctx.stroke()
    }

    // Desenhar peças considerando camadas
    pltData.segments.forEach((segment, index) => {
      // Verificar se o segmento pertence a uma camada visível
      const layer = layers.find(l => l.segments.includes(index))
      if (!layer?.visible) return

      ctx.beginPath()
      segment.points.forEach((point, i) => {
        if (i === 0) ctx.moveTo(point.x, point.y)
        else ctx.lineTo(point.x, point.y)
      })

      // Usar cor da camada
      ctx.strokeStyle = layer.color
      ctx.setLineDash(layer.id === 'markings' ? [5 / viewerState.scale, 5 / viewerState.scale] : [])
      ctx.lineWidth = 2 / viewerState.scale
      ctx.stroke()

      // Pontos inicial e final
      const pointSize = 3 / viewerState.scale
      
      ctx.beginPath()
      ctx.fillStyle = '#4CAF50'
      ctx.arc(segment.points[0].x, segment.points[0].y, pointSize, 0, Math.PI * 2)
      ctx.fill()

      ctx.beginPath()
      ctx.fillStyle = '#F44336'
      ctx.arc(segment.points[segment.points.length - 1].x, segment.points[segment.points.length - 1].y, pointSize, 0, Math.PI * 2)
      ctx.fill()
    })

    // Desenhar medições
    if (viewerState.measurePoints.length > 0) {
      ctx.beginPath()
      ctx.strokeStyle = '#9C27B0'
      ctx.setLineDash([5 / viewerState.scale, 5 / viewerState.scale])
      ctx.lineWidth = 2 / viewerState.scale
      viewerState.measurePoints.forEach((point, i) => {
        if (i === 0) ctx.moveTo(point.x, point.y)
        else ctx.lineTo(point.x, point.y)
      })
      ctx.stroke()
    }

    ctx.restore()
  }, [pltData, viewerState, layers])

  // Efeito para renderização inicial e quando houver mudanças
  useEffect(() => {
    renderPlt()
  }, [renderPlt])

  // Função para identificar e criar camadas a partir do PLT
  useEffect(() => {
    if (!pltData?.segments) return

    // Identificar camadas únicas baseado nos comandos
    const uniqueLayers = new Map<string, Layer>()
    
    pltData.segments.forEach((segment, index) => {
      // Identificar tipo de camada pelos comandos
      let layerId = 'default'
      let layerName = 'Geral'
      let layerColor = '#2196F3'

      if (segment.commands.some(cmd => cmd.startsWith('LT'))) {
        layerId = 'markings'
        layerName = 'Marcações'
        layerColor = '#FF9800'
      } else if (segment.commands.some(cmd => cmd.startsWith('SP'))) {
        const penCommand = segment.commands.find(cmd => cmd.startsWith('SP'))
        const penNumber = penCommand?.replace('SP', '') || '1'
        layerId = `pen${penNumber}`
        layerName = `Caneta ${penNumber}`
        // Cores diferentes para cada caneta
        const penColors = ['#2196F3', '#4CAF50', '#F44336', '#9C27B0', '#FF9800']
        layerColor = penColors[parseInt(penNumber) % penColors.length]
      }

      if (!uniqueLayers.has(layerId)) {
        uniqueLayers.set(layerId, {
          id: layerId,
          name: layerName,
          visible: true,
          color: layerColor,
          segments: []
        })
      }

      uniqueLayers.get(layerId)?.segments.push(index)
    })

    setLayers(Array.from(uniqueLayers.values()))
  }, [pltData])

  // Handlers de interação
  const handleZoom = (delta: number) => {
    setViewerState(prev => ({
      ...prev,
      scale: Math.max(0.1, Math.min(10, prev.scale + delta))
    }))
  }

  const handleRotate = () => {
    setViewerState(prev => ({
      ...prev,
      rotation: (prev.rotation + 90) % 360
    }))
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!viewerState.measuring) return

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = (e.clientX - rect.left - rect.width/2 - viewerState.pan.x) / viewerState.scale
    const y = (e.clientY - rect.top - rect.height/2 - viewerState.pan.y) / viewerState.scale

    setViewerState(prev => ({
      ...prev,
      measurePoints: [...prev.measurePoints, { x, y }]
    }))

    if (viewerState.measurePoints.length === 1) {
      const p1 = viewerState.measurePoints[0]
      const p2 = { x, y }
      const distance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
      setMeasurements(prev => [...prev, `Distância: ${distance.toFixed(2)}mm`])
      setViewerState(prev => ({ ...prev, measurePoints: [], measuring: false }))
    }
  }

  const exportPDF = () => {
    if (!canvasRef.current) return

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm"
    })

    const canvas = canvasRef.current
    const imageData = canvas.toDataURL('image/png')
    
    pdf.addImage(imageData, 'PNG', 10, 10, 280, 200)
    pdf.save('plt-visualization.pdf')
  }

  // Adicionar suporte a pan com mouse
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (viewerState.measuring) return
    
    setIsDragging(true)
    setDragStart({ x: e.clientX - viewerState.pan.x, y: e.clientY - viewerState.pan.y })
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || viewerState.measuring) return

    setViewerState(prev => ({
      ...prev,
      pan: {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      }
    }))
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  if (!pltData) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        Carregue um arquivo PLT para visualizar
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[300px,1fr] gap-4">
        {/* Painel de Camadas */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium flex items-center">
                <Layers className="h-4 w-4 mr-2" />
                Camadas
              </h3>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setLayers(layers.map(l => ({ ...l, visible: true })))}
              >
                Mostrar Todas
              </Button>
            </div>
            
            <Separator className="mb-4" />

            <div className="space-y-4">
              {layers.map(layer => (
                <div key={layer.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: layer.color }}
                    />
                    <span>{layer.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({layer.segments.length})
                    </span>
                  </div>
                  <Switch
                    checked={layer.visible}
                    onCheckedChange={(checked) => {
                      setLayers(layers.map(l => 
                        l.id === layer.id ? { ...l, visible: checked } : l
                      ))
                    }}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Conteúdo Principal */}
        <Card>
          <CardContent className="p-6">
            <Tabs defaultValue="viewer">
              <TabsList className="mb-4">
                <TabsTrigger value="viewer">Visualização</TabsTrigger>
                <TabsTrigger value="commands">Comandos</TabsTrigger>
                <TabsTrigger value="measurements">Medições</TabsTrigger>
              </TabsList>

              <TabsContent value="viewer">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-x-2">
                      <Button size="sm" onClick={() => handleZoom(0.1)}>
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                      <Button size="sm" onClick={() => handleZoom(-0.1)}>
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                      <Button size="sm" onClick={handleRotate}>
                        <RotateCw className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant={viewerState.measuring ? "default" : "outline"}
                        onClick={() => setViewerState(prev => ({ ...prev, measuring: !prev.measuring }))}
                      >
                        <Ruler className="h-4 w-4" />
                      </Button>
                    </div>

                    <Button size="sm" onClick={exportPDF}>
                      <FileDown className="h-4 w-4 mr-2" />
                      Exportar PDF
                    </Button>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <canvas
                      ref={canvasRef}
                      width={1000}
                      height={800}
                      className="w-full bg-white cursor-crosshair"
                      onClick={handleCanvasClick}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      style={{ cursor: viewerState.measuring ? 'crosshair' : isDragging ? 'grabbing' : 'grab' }}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="commands">
                <ScrollArea className="h-[400px] border rounded-lg p-4">
                  {pltData.segments.map((segment, index) => (
                    <div 
                      key={index}
                      className="py-2 border-b last:border-0 hover:bg-slate-50 cursor-pointer"
                      onClick={() => setSelectedCommand(segment.commands.join('; '))}
                    >
                      <div className="flex items-center justify-between">
                        <code className="text-sm">{segment.commands.join('; ')}</code>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-muted-foreground">
                            {segment.points.length} pontos
                          </span>
                          <Code className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="measurements">
                <ScrollArea className="h-[400px] border rounded-lg p-4">
                  {measurements.map((measurement, index) => (
                    <div key={index} className="py-2 border-b last:border-0">
                      <div className="flex items-center justify-between">
                        <span>{measurement}</span>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setMeasurements(prev => prev.filter((_, i) => i !== index))}
                        >
                          <MinusCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


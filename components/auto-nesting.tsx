"use client"

import { useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { usePlt } from "@/contexts/plt-context"
import { 
  Play, 
  Pause, 
  Settings2, 
  Layers,
  Timer,
  Maximize,
  MinusSquare,
  PlusSquare,
  Repeat,
  Shirt,
  Grid,
  Ruler,
  ArrowDownUp
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import NestingProcessModal from "./nesting-process-modal"
import jsPDF from 'jspdf'
import { NestingAlgorithm } from "./nesting-algorithm"

interface AutoNestingProps {
  onLog?: (message: string, type?: "info" | "warning" | "error" | "success") => void
}

interface FabricType {
  id: string
  name: string
  direction: "single" | "double"
}

interface PltPiece {
  name: string
  points: { x: number; y: number }[]
  commands: string[]
  bounds: {
    minX: number
    minY: number 
    maxX: number
    maxY: number
    width: number
    height: number
  }
}

interface NestingPiece extends PltPiece {
  rotation: number // 0, 90, 180, 270
  position: { x: number; y: number }
  size: "large" | "small"
  isEnabled: boolean
}

export default function AutoNesting({ onLog }: AutoNestingProps) {
  const { pltData, addLog } = usePlt()

  // Estados para configurações
  const [fabricWidth, setFabricWidth] = useState(1.58) // Largura do tecido em metros
  const [sizes, setSizes] = useState(["PP", "P", "M", "G", "GG"])
  const [nestingTime, setNestingTime] = useState(3) // Tempo em minutos
  const [targetEfficiency, setTargetEfficiency] = useState(85) // Porcentagem alvo
  const [isNesting, setIsNesting] = useState(false)
  const [showLargePiecesOnly, setShowLargePiecesOnly] = useState(false)
  const [keepNestedPieces, setKeepNestedPieces] = useState(true)

  // Estado para peças
  const [pieces, setPieces] = useState([
    { name: "Frente", size: "large", isEnabled: true },
    { name: "Costas", size: "large", isEnabled: true },
    { name: "Manga", size: "large", isEnabled: true },
    { name: "Bolso", size: "small", isEnabled: true },
    { name: "Gola", size: "small", isEnabled: true },
    { name: "Pala", size: "small", isEnabled: true },
  ])

  // Novos estados
  const [fabricType, setFabricType] = useState<FabricType>({
    id: "plain",
    name: "Tecido Plano",
    direction: "double"
  })
  
  const [selectedSizes, setSelectedSizes] = useState<string[]>(["P", "M", "G"])
  const [currentStep, setCurrentStep] = useState(1)
  const [nestingResult, setNestingResult] = useState<{
    efficiency: number
    fabricLength: number
    time: number
  } | null>(null)

  const [nestingCanvas, setNestingCanvas] = useState<HTMLCanvasElement | null>(null)

  // Adicionar estado para logs e modal
  const [isModalOpen, setIsModalOpen] = useState(false)

  function calculatePieceBounds(points: { x: number; y: number }[]): PltPiece["bounds"] {
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY

    points.forEach(point => {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    })

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    }
  }

  const processPltData = useCallback((data: any) => {
    if (!data || !data.segments || data.segments.length === 0) {
      addLog("Nenhum dado PLT válido encontrado", "error")
      return
    }

    // Processar cada segmento como uma peça
    const pieces: NestingPiece[] = data.segments.map(segment => {
      const bounds = calculatePieceBounds(segment.points)
      const isLarge = bounds.width > 5000 || bounds.height > 5000

      return {
        name: segment.name,
        points: segment.points,
        commands: segment.commands,
        bounds,
        rotation: 0,
        position: { x: 0, y: 0 },
        size: isLarge ? "large" : "small",
        isEnabled: true
      }
    })

    // Calcular os limites globais
    const globalBounds = calculatePieceBounds(
      pieces.flatMap(piece => piece.points)
    )

    pltData.pieces = pieces
    pltData.bounds = globalBounds
    setPieces(pieces.map(({ name, size, isEnabled }) => ({ name, size, isEnabled })))
    addLog(`Processadas ${pieces.length} peças do arquivo PLT`, "success")
  }, [pltData, addLog])

  // Primeiro, vamos adicionar algumas funções auxiliares para o encaixe

  // Função para verificar se duas peças se sobrepõem
  function checkOverlap(piece1: NestingPiece, piece2: NestingPiece): boolean {
    const r1 = {
      left: piece1.position.x,
      right: piece1.position.x + piece1.bounds.width,
      top: piece1.position.y,
      bottom: piece1.position.y + piece1.bounds.height
    }

    const r2 = {
      left: piece2.position.x,
      right: piece2.position.x + piece2.bounds.width,
      top: piece2.position.y,
      bottom: piece2.position.y + piece2.bounds.height
    }

    return !(r1.right < r2.left || 
             r1.left > r2.right || 
             r1.bottom < r2.top || 
             r1.top > r2.bottom)
  }

  // Função para encontrar uma posição válida para uma peça
  function findValidPosition(
    piece: NestingPiece, 
    placedPieces: NestingPiece[], 
    fabricWidth: number
  ): { x: number; y: number } | null {
    // Grid de posições possíveis (simplificado)
    const gridSize = 100 // Tamanho do grid em unidades PLT
    const maxY = Math.max(...placedPieces.map(p => p.position.y + p.bounds.height), 0)

    for (let y = 0; y <= maxY + gridSize; y += gridSize) {
      for (let x = 0; x <= fabricWidth * 1000; x += gridSize) { // Converter metros para unidades PLT
        const testPiece = {
          ...piece,
          position: { x, y }
        }

        // Verificar se a peça está dentro dos limites do tecido
        if (x + piece.bounds.width > fabricWidth * 1000) {
          continue
        }

        // Verificar sobreposição com outras peças
        let hasOverlap = false
        for (const placedPiece of placedPieces) {
          if (checkOverlap(testPiece, placedPiece)) {
            hasOverlap = true
            break
          }
        }

        if (!hasOverlap) {
          return { x, y }
        }
      }
    }

    return null
  }

  // Mover renderNestingResult para antes de startNesting
  const renderNestingResult = useCallback((canvas: HTMLCanvasElement) => {
    if (!pltData) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Limpar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Desenhar área do tecido
    ctx.strokeStyle = '#ccc'
    ctx.strokeRect(0, 0, canvas.width, canvas.height)

    // Escala para converter unidades PLT para pixels do canvas
    const scaleX = canvas.width / (fabricWidth * 1000)
    const maxY = Math.max(...pltData.pieces.filter(p => p.isEnabled).map(p => p.position.y + p.bounds.height))
    const scaleY = canvas.height / maxY

    // Desenhar peças encaixadas
    pltData.pieces.forEach(piece => {
      if (!piece.isEnabled) return

      ctx.strokeStyle = piece.size === 'large' ? '#0066cc' : '#00cc66'
      ctx.fillStyle = piece.size === 'large' ? '#e6f0ff' : '#e6fff0'
      ctx.lineWidth = 2

      // Desenhar pontos da peça na posição calculada
      ctx.beginPath()
      piece.points.forEach((point, i) => {
        const x = (piece.position.x + (point.x - piece.bounds.minX)) * scaleX
        const y = (piece.position.y + (point.y - piece.bounds.minY)) * scaleY

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    })
  }, [pltData, fabricWidth])

  // Adicione esta função auxiliar fora do componente
  function formatDate(date: Date): string {
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR')
  }

  // Função para gerar o PDF
  const generatePDF = useCallback((result: {
    efficiency: number
    fabricLength: number
    time: number
    pieces: any[]
  }) => {
    const pdf = new jsPDF()
    const pageWidth = pdf.internal.pageSize.getWidth()
    const margin = 20
    let y = 20

    // Cabeçalho
    pdf.setFontSize(20)
    pdf.text('FabricOptima - Relatório de Encaixe', pageWidth / 2, y, { align: 'center' })
    
    y += 20
    pdf.setFontSize(12)
    pdf.text(`Data: ${formatDate(new Date())}`, margin, y)
    
    // Informações do Tecido
    y += 15
    pdf.setFontSize(14)
    pdf.text('Configurações do Tecido', margin, y)
    
    y += 10
    pdf.setFontSize(12)
    pdf.text([
      `Tipo: ${fabricType.name}`,
      `Largura: ${fabricWidth}m`,
      `Sentido: ${fabricType.direction === 'double' ? 'Duplo' : 'Único'}`,
    ], margin, y)

    // Resultados
    y += 25
    pdf.setFontSize(14)
    pdf.text('Resultados do Encaixe', margin, y)
    
    y += 10
    pdf.setFontSize(12)
    pdf.text([
      `Eficiência: ${result.efficiency}%`,
      `Comprimento de tecido: ${result.fabricLength}m`,
      `Área total: ${(fabricWidth * result.fabricLength).toFixed(2)}m²`,
      `Tempo de processamento: ${result.time} minutos`,
    ], margin, y)

    // Peças Processadas
    y += 25
    pdf.setFontSize(14)
    pdf.text('Peças Processadas', margin, y)
    
    y += 10
    pdf.setFontSize(12)
    const largePieces = pieces.filter(p => p.size === 'large')
    const smallPieces = pieces.filter(p => p.size === 'small')

    pdf.text(`Peças Grandes (${largePieces.length})`, margin, y)
    y += 5
    largePieces.forEach(piece => {
      y += 5
      pdf.text(`- ${piece.name}`, margin + 5, y)
    })

    y += 10
    pdf.text(`Peças Pequenas (${smallPieces.length})`, margin, y)
    y += 5
    smallPieces.forEach(piece => {
      y += 5
      pdf.text(`- ${piece.name}`, margin + 5, y)
    })

    // Adicionar imagem do encaixe se disponível
    if (nestingCanvas) {
      y += 20
      pdf.text('Visualização do Encaixe', margin, y)
      y += 10
      
      const imgData = nestingCanvas.toDataURL('image/png')
      const imgWidth = pageWidth - (margin * 2)
      const imgHeight = (nestingCanvas.height * imgWidth) / nestingCanvas.width
      
      pdf.addImage(imgData, 'PNG', margin, y, imgWidth, imgHeight)
    }

    // Salvar o PDF
    const fileName = `encaixe-${formatDate(new Date()).replace(/[/: ]/g, '-')}.pdf`
    pdf.save(fileName)
    addLog(`PDF gerado com sucesso: ${fileName}`, "success")
  }, [fabricType, fabricWidth, pieces, nestingCanvas, addLog])

  // Agora definir startNesting
  const startNesting = useCallback(async () => {
    if (!pltData || !pltData.segments) {
      addLog("Nenhum arquivo PLT carregado", "error")
      return
    }

    try {
      setIsNesting(true)
      setCurrentStep(1)

      // Criar instância do algoritmo
      const algorithm = new NestingAlgorithm(
        fabricWidth * 1000, // Converter para milímetros
        pltData.segments,
        addLog
      )

      // Executar encaixe
      const result = await algorithm.performNesting()

      // Atualizar canvas com resultado
      const canvas = document.createElement('canvas')
      canvas.width = 1000
      canvas.height = 800
      const ctx = canvas.getContext('2d')

      if (ctx) {
        // Desenhar resultado
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Escalar para caber no canvas
        const scale = Math.min(
          canvas.width / result.bounds.width,
          canvas.height / result.bounds.height
        )

        result.pieces.forEach(piece => {
          ctx.beginPath()
          piece.points.forEach((point, i) => {
            const x = (point.x + piece.position.x) * scale
            const y = (point.y + piece.position.y) * scale
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          })
          ctx.closePath()
          
          // Cor baseada no tipo da peça
          ctx.fillStyle = piece.type === "large" ? '#f97316' : '#22c55e'
          ctx.fill()
          ctx.strokeStyle = '#000'
          ctx.stroke()
        })
      }

      setNestingCanvas(canvas)
      setNestingResult({
        efficiency: result.efficiency,
        fabricLength: result.bounds.height / 1000, // Converter para metros
        time: nestingTime
      })

      addLog("=== Processo de Encaixe Concluído ===", "success")
      addLog(`Eficiência alcançada: ${result.efficiency.toFixed(2)}%`, "success")
      addLog(`Comprimento de tecido: ${(result.bounds.height / 1000).toFixed(2)}m`, "success")

    } catch (error) {
      addLog(`Erro durante o encaixe: ${error}`, "error")
    } finally {
      setIsNesting(false)
    }
  }, [pltData, fabricWidth, nestingTime, addLog])

  // Função para alternar visibilidade de peças
  const togglePiece = useCallback((pieceName: string) => {
    setPieces(prev => prev.map(piece => 
      piece.name === pieceName 
        ? { ...piece, isEnabled: !piece.isEnabled }
        : piece
    ))
  }, [])

  // Função para mostrar apenas peças grandes
  const showOnlyLargePieces = useCallback(() => {
    setPieces(prev => prev.map(piece => ({
      ...piece,
      isEnabled: piece.size === "large"
    })))
    setShowLargePiecesOnly(true)
    addLog("Mostrando apenas peças grandes", "info")
  }, [addLog])

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-medium mb-4 flex items-center">
            <Shirt className="mr-2 h-5 w-5" />
            Encaixe Automático
          </h3>

          <Tabs defaultValue="config" className="space-y-4">
            <TabsList>
              <TabsTrigger value="config">
                <Settings2 className="h-4 w-4 mr-2" />
                Configurações
              </TabsTrigger>
              <TabsTrigger value="pieces">
                <Layers className="h-4 w-4 mr-2" />
                Peças
              </TabsTrigger>
              <TabsTrigger value="result" disabled={!nestingResult}>
                <Grid className="h-4 w-4 mr-2" />
                Resultado
              </TabsTrigger>
            </TabsList>

            <TabsContent value="config">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <Label>Tipo de Tecido</Label>
                    <Select 
                      value={fabricType.id}
                      onValueChange={(value) => {
                        const types: Record<string, FabricType> = {
                          plain: { id: "plain", name: "Tecido Plano", direction: "double" },
                          knit: { id: "knit", name: "Malha", direction: "single" },
                          stripe: { id: "stripe", name: "Listrado", direction: "single" },
                        }
                        setFabricType(types[value])
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="plain">Tecido Plano</SelectItem>
                        <SelectItem value="knit">Malha</SelectItem>
                        <SelectItem value="stripe">Listrado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Largura do Tecido (metros)</Label>
                    <div className="flex items-center space-x-2">
                      <Ruler className="h-4 w-4 text-muted-foreground" />
                      <Input 
                        type="number" 
                        value={fabricWidth}
                        onChange={(e) => setFabricWidth(Number(e.target.value))}
                        step={0.01}
                        min={0.1}
                        max={3}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Sentido do Tecido</Label>
                    <div className="flex items-center space-x-2 mt-2">
                      <Button
                        variant={fabricType.direction === "single" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFabricType(prev => ({ ...prev, direction: "single" }))}
                      >
                        <ArrowDownUp className="h-4 w-4 mr-2" />
                        Sentido Único
                      </Button>
                      <Button
                        variant={fabricType.direction === "double" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFabricType(prev => ({ ...prev, direction: "double" }))}
                      >
                        <ArrowDownUp className="h-4 w-4 mr-2" />
                        Sentido Duplo
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label>Tempo de Encaixe (minutos)</Label>
                    <div className="flex items-center space-x-2">
                      <Timer className="h-4 w-4 text-muted-foreground" />
                      <Slider
                        value={[nestingTime]}
                        onValueChange={(value) => setNestingTime(value[0])}
                        min={1}
                        max={10}
                        step={1}
                        className="flex-1"
                      />
                      <span className="min-w-[3ch] text-right">{nestingTime}</span>
                    </div>
                  </div>

                  <div>
                    <Label>Eficiência Alvo (%)</Label>
                    <div className="flex items-center space-x-2">
                      <Maximize className="h-4 w-4 text-muted-foreground" />
                      <Slider
                        value={[targetEfficiency]}
                        onValueChange={(value) => setTargetEfficiency(value[0])}
                        min={70}
                        max={100}
                        step={1}
                        className="flex-1"
                      />
                      <span className="min-w-[3ch] text-right">{targetEfficiency}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>Tamanhos</Label>
                    <div className="grid grid-cols-5 gap-2 mt-2">
                      {sizes.map((size) => (
                        <Button
                          key={size}
                          variant={selectedSizes.includes(size) ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setSelectedSizes(prev =>
                              prev.includes(size)
                                ? prev.filter(s => s !== size)
                                : [...prev, size]
                            )
                          }}
                        >
                          {size}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-4">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={showOnlyLargePieces}
                      disabled={showLargePiecesOnly}
                    >
                      <PlusSquare className="mr-2 h-4 w-4" />
                      Mostrar Apenas Peças Grandes
                    </Button>

                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => {
                        setPieces(prev => prev.map(p => ({ ...p, isEnabled: true })))
                        setShowLargePiecesOnly(false)
                      }}
                    >
                      <MinusSquare className="mr-2 h-4 w-4" />
                      Mostrar Todas as Peças
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pieces">
              <div className="space-y-2">
                {pieces.map((piece) => (
                  <div key={piece.name} className="flex items-center space-x-2">
                    <Checkbox
                      id={`piece-${piece.name}`}
                      checked={piece.isEnabled}
                      onCheckedChange={() => togglePiece(piece.name)}
                    />
                    <Label htmlFor={`piece-${piece.name}`} className="flex-1">
                      {piece.name}
                      {piece.size === "large" && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          Grande
                        </span>
                      )}
                    </Label>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="result">
              {nestingResult && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h4 className="text-green-700 font-medium mb-1">Eficiência</h4>
                      <p className="text-2xl font-bold text-green-800">{nestingResult.efficiency}%</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="text-blue-700 font-medium mb-1">Comprimento</h4>
                      <p className="text-2xl font-bold text-blue-800">{nestingResult.fabricLength}m</p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <h4 className="text-purple-700 font-medium mb-1">Tempo</h4>
                      <p className="text-2xl font-bold text-purple-800">{nestingResult.time} min</p>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4 bg-white">
                    <h4 className="font-medium mb-2">Visualização do Encaixe</h4>
                    <canvas
                      ref={(canvas) => {
                        if (canvas && nestingCanvas) {
                          const ctx = canvas.getContext('2d')
                          if (ctx) {
                            ctx.drawImage(nestingCanvas, 0, 0)
                          }
                        }
                      }}
                      width={1000}
                      height={800}
                      className="w-full border rounded"
                    />
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="keep-nested"
                checked={keepNestedPieces}
                onCheckedChange={(checked) => setKeepNestedPieces(checked as boolean)}
              />
              <Label htmlFor="keep-nested">Manter peças já encaixadas</Label>
            </div>

            <div className="space-x-2">
              <Button variant="outline" onClick={() => {
                setPieces(prev => prev.map(p => ({ ...p, isEnabled: true })))
                setShowLargePiecesOnly(false)
                setKeepNestedPieces(true)
                setNestingTime(3)
                setTargetEfficiency(85)
                addLog("Configurações resetadas", "info")
              }}>
                <Repeat className="mr-2 h-4 w-4" />
                Resetar
              </Button>

              <Button 
                onClick={startNesting} 
                disabled={isNesting || !pltData}
              >
                {isNesting ? (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    Encaixando...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Iniciar Encaixe
                  </>
                )}
              </Button>
            </div>
          </div>

          {isNesting && (
            <div className="mt-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Etapa {currentStep} de 4</span>
                  <span>
                    {[
                      "Encaixando peças grandes",
                      "Otimizando posições",
                      "Encaixando peças pequenas",
                      "Finalizando"
                    ][currentStep - 1]}
                  </span>
                </div>
                <Progress value={currentStep * 25} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <NestingProcessModal
        isOpen={isModalOpen}
        onOpenChange={(open) => {
          if (!isNesting) {
            setIsModalOpen(open)
          }
        }}
        currentStep={currentStep}
        logs={[]}
        canvas={nestingCanvas}
      />
    </div>
  )
} 
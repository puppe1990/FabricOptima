"use client"

import { useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
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

  const [pltData, setPltData] = useState<{
    pieces: NestingPiece[]
    bounds: PltPiece["bounds"]
  } | null>(null)

  const [nestingCanvas, setNestingCanvas] = useState<HTMLCanvasElement | null>(null)

  // Adicionar estado para logs e modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [processLogs, setProcessLogs] = useState<{
    time: string
    message: string
    type: "info" | "warning" | "error" | "success"
  }[]>([])

  // Função para log
  const log = useCallback((message: string, type: "info" | "warning" | "error" | "success" = "info") => {
    const now = new Date()
    const time = now.toLocaleTimeString()
    
    setProcessLogs(prev => [...prev, { time, message, type }])
    
    if (onLog) {
      onLog(message, type)
    }
  }, [onLog])

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
      log("Nenhum dado PLT válido encontrado", "error")
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

    setPltData({ pieces, bounds: globalBounds })
    setPieces(pieces.map(({ name, size, isEnabled }) => ({ name, size, isEnabled })))
    log(`Processadas ${pieces.length} peças do arquivo PLT`, "success")
  }, [log])

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

  // Agora definir startNesting
  const startNesting = useCallback(() => {
    if (!pltData) {
      log("Nenhum dado PLT carregado", "error")
      return
    }

    setIsNesting(true)
    setCurrentStep(1)
    setProcessLogs([]) // Limpar logs anteriores
    setIsModalOpen(true) // Abrir modal

    // Log inicial com todas as configurações
    log("=== Iniciando Processo de Encaixe Automático ===", "info")
    log("Configurações:", "info")
    log(`- Largura do tecido: ${fabricWidth}m`, "info")
    log(`- Tipo de tecido: ${fabricType.name}`, "info")
    log(`- Sentido: ${fabricType.direction === "double" ? "Duplo" : "Único"}`, "info")
    log(`- Tamanhos selecionados: ${selectedSizes.join(", ")}`, "info")
    log(`- Tempo definido: ${nestingTime} minutos`, "info")
    log(`- Eficiência alvo: ${targetEfficiency}%`, "info")
    log(`- Manter peças encaixadas: ${keepNestedPieces ? "Sim" : "Não"}`, "info")
    log("---", "info")

    // Criar canvas para visualização do encaixe
    const canvas = document.createElement('canvas')
    canvas.width = 1000
    canvas.height = 800
    setNestingCanvas(canvas)

    // Copiar peças para não modificar o estado original
    let workingPieces = [...pltData.pieces]
      .filter(p => p.isEnabled)
      .map(p => ({...p}))

    // Log das peças selecionadas
    log(`Total de peças para encaixe: ${workingPieces.length}`, "info")
    
    // Separar peças grandes e pequenas
    const largePieces = workingPieces.filter(p => p.size === "large")
    const smallPieces = workingPieces.filter(p => p.size === "small")
    
    log(`- Peças grandes: ${largePieces.length}`, "info")
    largePieces.forEach(p => log(`  * ${p.name} (${p.bounds.width.toFixed(0)}x${p.bounds.height.toFixed(0)})`, "info"))
    
    log(`- Peças pequenas: ${smallPieces.length}`, "info")
    smallPieces.forEach(p => log(`  * ${p.name} (${p.bounds.width.toFixed(0)}x${p.bounds.height.toFixed(0)})`, "info"))
    
    log("---", "info")

    // Array para armazenar peças já posicionadas
    const placedPieces: NestingPiece[] = []

    // Simular processo em etapas
    const simulateStep = async (step: number) => {
      setCurrentStep(step)
      switch(step) {
        case 1: {
          log("=== Etapa 1: Encaixando Peças Grandes ===", "info")
          
          for (const piece of largePieces) {
            log(`Processando peça: ${piece.name}`, "info")
            const position = findValidPosition(piece, placedPieces, fabricWidth)
            
            if (position) {
              piece.position = position
              placedPieces.push(piece)
              log(`✓ Peça "${piece.name}" posicionada em (${position.x.toFixed(0)}, ${position.y.toFixed(0)})`, "success")
            } else {
              log(`✗ Não foi possível posicionar a peça "${piece.name}"`, "warning")
            }
            
            // Atualizar visualização
            renderNestingResult(canvas)
            await new Promise(resolve => setTimeout(resolve, 500))
          }
          break
        }
        case 2: {
          log("=== Etapa 2: Otimizando Posições ===", "info")
          
          // Tentar compactar verticalmente
          let improved = true
          let iteration = 0
          while (improved && iteration < 10) {
            iteration++
            improved = false
            log(`Iniciando iteração ${iteration} de otimização`, "info")
            
            for (const piece of placedPieces) {
              const originalY = piece.position.y
              let newY = originalY
              
              // Tentar mover a peça para cima
              while (newY > 0) {
                piece.position.y = newY - 100
                let hasOverlap = false
                
                for (const other of placedPieces) {
                  if (other !== piece && checkOverlap(piece, other)) {
                    hasOverlap = true
                    break
                  }
                }
                
                if (hasOverlap) {
                  piece.position.y = newY
                  break
                }
                
                newY -= 100
                improved = true
              }
              
              if (originalY !== piece.position.y) {
                log(`Peça "${piece.name}" movida para cima em ${originalY - piece.position.y} unidades`, "info")
              }
            }
            
            // Atualizar visualização
            renderNestingResult(canvas)
            await new Promise(resolve => setTimeout(resolve, 500))
          }
          
          log(`Otimização concluída após ${iteration} iterações`, "success")
          break
        }
        case 3: {
          log("=== Etapa 3: Encaixando Peças Pequenas ===", "info")
          
          for (const piece of smallPieces) {
            log(`Processando peça: ${piece.name}`, "info")
            const position = findValidPosition(piece, placedPieces, fabricWidth)
            
            if (position) {
              piece.position = position
              placedPieces.push(piece)
              log(`✓ Peça "${piece.name}" posicionada em (${position.x.toFixed(0)}, ${position.y.toFixed(0)})`, "success")
            } else {
              log(`✗ Não foi possível posicionar a peça "${piece.name}"`, "warning")
            }
            
            // Atualizar visualização
            renderNestingResult(canvas)
            await new Promise(resolve => setTimeout(resolve, 500))
          }
          break
        }
        case 4: {
          log("=== Etapa 4: Finalizando e Calculando Resultados ===", "info")
          
          // Calcular resultados
          const maxY = Math.max(...placedPieces.map(p => p.position.y + p.bounds.height))
          const fabricLength = maxY / 1000 // Converter unidades PLT para metros
          const totalArea = fabricWidth * fabricLength
          const usedArea = placedPieces.reduce((sum, piece) => 
            sum + (piece.bounds.width * piece.bounds.height) / 1000000, 0)
          const efficiency = (usedArea / totalArea) * 100

          log("Resultados finais:", "success")
          log(`- Comprimento de tecido: ${fabricLength.toFixed(2)}m`, "success")
          log(`- Área total: ${totalArea.toFixed(2)}m²`, "success")
          log(`- Área utilizada: ${(usedArea/1000000).toFixed(2)}m²`, "success")
          log(`- Eficiência: ${efficiency.toFixed(1)}%`, "success")
          log(`- Peças posicionadas: ${placedPieces.length} de ${workingPieces.length}`, "success")

          setNestingResult({
            efficiency: Number(efficiency.toFixed(1)),
            fabricLength: Number(fabricLength.toFixed(2)),
            time: nestingTime
          })

          log("=== Processo de Encaixe Concluído ===", "success")
          setIsNesting(false)
          return
        }
      }

      setTimeout(() => simulateStep(step + 1), 1000)
    }

    simulateStep(1)
  }, [fabricWidth, fabricType, selectedSizes, nestingTime, targetEfficiency, pltData, log, renderNestingResult, keepNestedPieces])

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
    log("Mostrando apenas peças grandes", "info")
  }, [log])

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
                log("Configurações resetadas", "info")
              }}>
                <Repeat className="mr-2 h-4 w-4" />
                Resetar
              </Button>

              <Button 
                onClick={startNesting} 
                disabled={isNesting}
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
                  <span>{["Encaixando peças grandes", "Otimizando posições", "Encaixando peças pequenas", "Finalizando"][currentStep - 1]}</span>
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
        logs={processLogs}
        canvas={nestingCanvas}
      />
    </div>
  )
} 
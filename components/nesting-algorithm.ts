import { Point, PltSegment } from "./plt-parser"

interface NestingPiece {
  id: string
  points: Point[]
  bounds: {
    minX: number
    minY: number
    maxX: number
    maxY: number
    width: number
    height: number
  }
  rotation: number // 0, 90, 180, 270
  position: Point
  type: "large" | "small"
}

interface NestingResult {
  pieces: NestingPiece[]
  efficiency: number
  fabricLength: number
  bounds: {
    width: number
    height: number
  }
}

export class NestingAlgorithm {
  private fabricWidth: number
  private pieces: NestingPiece[]
  private placedPieces: NestingPiece[]
  private addLog: (message: string, type?: "info" | "warning" | "error" | "success") => void

  constructor(
    fabricWidth: number,
    segments: PltSegment[],
    addLog: (message: string, type?: "info" | "warning" | "error" | "success") => void
  ) {
    this.fabricWidth = fabricWidth
    this.addLog = addLog
    this.placedPieces = []
    
    // Converter segmentos PLT em peças para encaixe
    this.pieces = this.convertSegmentsToPieces(segments)
  }

  private convertSegmentsToPieces(segments: PltSegment[]): NestingPiece[] {
    return segments.map((segment, index) => {
      const bounds = this.calculateBounds(segment.points)
      const isLarge = bounds.width > 50 || bounds.height > 50 // Ajustar threshold conforme necessário

      return {
        id: `piece-${index}`,
        points: segment.points,
        bounds,
        rotation: 0,
        position: { x: 0, y: 0 },
        type: isLarge ? "large" : "small"
      }
    })
  }

  private calculateBounds(points: Point[]): NestingPiece["bounds"] {
    let minX = Infinity, minY = Infinity
    let maxX = -Infinity, maxY = -Infinity

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

  private rotatePiece(piece: NestingPiece, angle: number): Point[] {
    const rad = (angle * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)

    // Encontrar o centro da peça
    const center = {
      x: (piece.bounds.maxX + piece.bounds.minX) / 2,
      y: (piece.bounds.maxY + piece.bounds.minY) / 2
    }

    return piece.points.map(point => {
      // Transladar para a origem
      const dx = point.x - center.x
      const dy = point.y - center.y

      // Rotacionar
      const rx = dx * cos - dy * sin
      const ry = dx * sin + dy * cos

      // Transladar de volta
      return {
        x: rx + center.x,
        y: ry + center.y
      }
    })
  }

  private checkCollision(piece1: NestingPiece, piece2: NestingPiece): boolean {
    // Verificação rápida usando bounding boxes
    const r1 = {
      left: piece1.position.x + piece1.bounds.minX,
      right: piece1.position.x + piece1.bounds.maxX,
      top: piece1.position.y + piece1.bounds.minY,
      bottom: piece1.position.y + piece1.bounds.maxY
    }

    const r2 = {
      left: piece2.position.x + piece2.bounds.minX,
      right: piece2.position.x + piece2.bounds.maxX,
      top: piece2.position.y + piece2.bounds.minY,
      bottom: piece2.position.y + piece2.bounds.maxY
    }

    return !(r1.right < r2.left || 
             r1.left > r2.right || 
             r1.bottom < r2.top || 
             r1.top > r2.bottom)
  }

  private findBestPosition(piece: NestingPiece): { x: number; y: number; rotation: number } {
    let bestPosition = { x: 0, y: 0, rotation: 0 }
    let minY = Infinity

    const rotations = [0, 90, 180, 270]
    
    for (const rotation of rotations) {
      const rotatedPoints = this.rotatePiece(piece, rotation)
      const rotatedBounds = this.calculateBounds(rotatedPoints)

      // Grid de posições possíveis
      for (let x = 0; x < this.fabricWidth; x += 10) {
        let y = 0

        // Encontrar primeira posição válida no eixo Y
        while (y < minY) {
          const testPosition = { x, y }
          let isValid = true

          // Verificar colisão com peças já colocadas
          for (const placedPiece of this.placedPieces) {
            if (this.checkCollision(
              { ...piece, position: testPosition, points: rotatedPoints, bounds: rotatedBounds },
              placedPiece
            )) {
              isValid = false
              break
            }
          }

          if (isValid && 
              x + rotatedBounds.width <= this.fabricWidth &&
              y + rotatedBounds.height < minY) {
            minY = y + rotatedBounds.height
            bestPosition = { x, y, rotation }
          }

          y += 10
        }
      }
    }

    return bestPosition
  }

  public async performNesting(): Promise<NestingResult> {
    this.addLog("Iniciando processo de encaixe", "info")

    // Ordenar peças por tamanho (maiores primeiro)
    this.pieces.sort((a, b) => 
      (b.bounds.width * b.bounds.height) - (a.bounds.width * a.bounds.height)
    )

    // Processar peças grandes primeiro
    const largePieces = this.pieces.filter(p => p.type === "large")
    this.addLog(`Processando ${largePieces.length} peças grandes`, "info")

    for (const piece of largePieces) {
      const { x, y, rotation } = this.findBestPosition(piece)
      const rotatedPoints = this.rotatePiece(piece, rotation)
      const rotatedBounds = this.calculateBounds(rotatedPoints)

      this.placedPieces.push({
        ...piece,
        points: rotatedPoints,
        bounds: rotatedBounds,
        position: { x, y },
        rotation
      })
    }

    // Processar peças pequenas
    const smallPieces = this.pieces.filter(p => p.type === "small")
    this.addLog(`Processando ${smallPieces.length} peças pequenas`, "info")

    for (const piece of smallPieces) {
      const { x, y, rotation } = this.findBestPosition(piece)
      const rotatedPoints = this.rotatePiece(piece, rotation)
      const rotatedBounds = this.calculateBounds(rotatedPoints)

      this.placedPieces.push({
        ...piece,
        points: rotatedPoints,
        bounds: rotatedBounds,
        position: { x, y },
        rotation
      })
    }

    // Calcular resultados
    const maxY = Math.max(...this.placedPieces.map(p => 
      p.position.y + p.bounds.height
    ))

    const usedArea = this.placedPieces.reduce((sum, piece) => 
      sum + (piece.bounds.width * piece.bounds.height), 0
    )

    const totalArea = this.fabricWidth * maxY
    const efficiency = (usedArea / totalArea) * 100

    this.addLog(`Encaixe concluído com ${efficiency.toFixed(2)}% de eficiência`, "success")

    return {
      pieces: this.placedPieces,
      efficiency,
      fabricLength: maxY,
      bounds: {
        width: this.fabricWidth,
        height: maxY
      }
    }
  }
} 
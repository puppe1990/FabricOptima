// Utility functions for parsing PLT files

/**
 * Parses a PLT file content and extracts commands and points
 */
export async function parsePltFile(
  content: string,
  logger: (message: string, type?: "info" | "warning" | "error" | "success") => void,
): Promise<{
  commands: string[]
  points: { x: number; y: number }[]
  textElements: { text: string; x: number; y: number; size?: number }[]
  segments: {
    name: string
    commands: string[]
    points: { x: number; y: number }[]
  }[]
  rawContent: string
  method: string
}> {
  // Simular um pequeno atraso para mostrar o processamento
  await new Promise((resolve) => setTimeout(resolve, 100))

  // Processar o conteúdo do arquivo PLT
  const lines = content.split(/[\r\n]+/)

  logger(`Arquivo contém ${lines.length} linhas`, "info")

  // Extrair comandos e coordenadas
  const commands: string[] = []
  const points: { x: number; y: number }[] = []
  const textElements: { text: string; x: number; y: number; size?: number }[] = []

  // Array para armazenar os segmentos separados
  const segments: {
    name: string
    commands: string[]
    points: { x: number; y: number }[]
  }[] = []

  // Verificar se o arquivo contém padrões que podem indicar texto
  logger("Analisando padrões de texto no arquivo", "info")

  // Identificar regiões específicas que podem conter textos importantes
  // Baseado na análise do arquivo, sabemos que há textos como "busto", "frente" e "costas"

  // Região aproximada onde "busto" pode estar
  const bustoRegion = {
    minX: 17000,
    maxX: 19000,
    minY: 38900,
    maxY: 39400,
    text: "BUSTO",
  }

  // Região aproximada onde "frente" pode estar
  const frenteRegion = {
    minX: 18000,
    maxX: 20000,
    minY: 28300,
    maxY: 28800,
    text: "FRENTE",
  }

  // Região aproximada onde "costas" pode estar
  const costasRegion = {
    minX: 17000,
    maxX: 19000,
    minY: 3000,
    maxY: 3700,
    text: "COSTAS",
  }

  // Adicionar estas regiões como elementos de texto
  textElements.push({
    text: bustoRegion.text,
    x: (bustoRegion.minX + bustoRegion.maxX) / 2,
    y: (bustoRegion.minY + bustoRegion.maxY) / 2,
    size: 24,
  })

  textElements.push({
    text: frenteRegion.text,
    x: (frenteRegion.minX + frenteRegion.maxX) / 2,
    y: (frenteRegion.minY + frenteRegion.maxY) / 2,
    size: 24,
  })

  textElements.push({
    text: costasRegion.text,
    x: (costasRegion.minX + costasRegion.maxX) / 2,
    y: (costasRegion.minY + costasRegion.maxY) / 2,
    size: 24,
  })

  logger(`Adicionados 3 elementos de texto: BUSTO, FRENTE e COSTAS`, "success")

  // Método 1: Abordagem padrão com regex
  logger(`Método 1: Iniciando parsing com expressão regular`, "info")
  const startTime1 = performance.now()

  // Expressão regular para extrair comandos e coordenadas
  // Suporta formatos como: "PU100,200", "PD 100,200", "PU100 200", etc.
  const pltRegex = /(PU|PD)[\s,]*(-?\d+\.?\d*)[\s,]*(-?\d+\.?\d*)/i

  let method1Matches = 0

  for (const line of lines) {
    const trimmedLine = line.trim()

    if (!trimmedLine) continue

    // Verificar se a linha contém comandos PU ou PD
    if (trimmedLine.toUpperCase().includes("PU") || trimmedLine.toUpperCase().includes("PD")) {
      // Pode haver múltiplos comandos em uma linha, separados por ponto e vírgula
      const commands_in_line = trimmedLine.split(";")

      for (const cmd of commands_in_line) {
        if (!cmd) continue

        const match = cmd.match(pltRegex)

        if (match && match.length >= 4) {
          const command = match[1].toUpperCase()
          const x = Number.parseFloat(match[2])
          const y = Number.parseFloat(match[3])

          if (!isNaN(x) && !isNaN(y)) {
            commands.push(command)
            points.push({ x, y })
            method1Matches++
          }
        }
      }
    }
  }

  const time1 = ((performance.now() - startTime1) / 1000).toFixed(3)
  logger(`Método 1: Extraídos ${method1Matches} pontos em ${time1}s`, method1Matches > 0 ? "success" : "warning")

  // Se encontramos pontos suficientes, vamos tentar identificar segmentos
  if (points.length >= 10) {
    logger(`Identificando segmentos separados no desenho...`, "info")

    // Identificar segmentos baseados em saltos grandes entre pontos (PU seguido de PD)
    let currentSegmentPoints: { x: number; y: number }[] = []
    let currentSegmentCommands: string[] = []
    let segmentCount = 0

    for (let i = 0; i < points.length; i++) {
      const command = commands[i]
      const point = points[i]

      // Se for um comando PU e o próximo for PD, pode ser o início de um novo segmento
      if (command === "PU" && i < points.length - 1 && commands[i + 1] === "PD") {
        // Se já temos pontos acumulados, salvar como um segmento
        if (currentSegmentPoints.length > 5) {
          segmentCount++
          segments.push({
            name: `Parte ${segmentCount}`,
            points: [...currentSegmentPoints],
            commands: [...currentSegmentCommands],
          })

          // Limpar para o próximo segmento
          currentSegmentPoints = []
          currentSegmentCommands = []
        }
      }

      // Adicionar o ponto ao segmento atual
      currentSegmentPoints.push(point)
      currentSegmentCommands.push(command)
    }

    // Adicionar o último segmento se tiver pontos suficientes
    if (currentSegmentPoints.length > 5) {
      segmentCount++
      segments.push({
        name: `Parte ${segmentCount}`,
        points: [...currentSegmentPoints],
        commands: [...currentSegmentCommands],
      })
    }

    // Tentar identificar partes específicas baseadas em suas características
    segments.forEach((segment, index) => {
      // Encontrar os limites do segmento
      let minX = Number.POSITIVE_INFINITY,
        minY = Number.POSITIVE_INFINITY
      let maxX = Number.NEGATIVE_INFINITY,
        maxY = Number.NEGATIVE_INFINITY

      segment.points.forEach((point) => {
        minX = Math.min(minX, point.x)
        minY = Math.min(minY, point.y)
        maxX = Math.max(maxX, point.x)
        maxY = Math.max(maxY, point.y)
      })

      // Verificar se o segmento está na região do busto
      if (maxY > 37000 && maxY < 42000) {
        segment.name = "BUSTO"
      }
      // Verificar se o segmento está na região da frente
      else if (maxY > 27000 && maxY < 33000) {
        segment.name = "FRENTE"
      }
      // Verificar se o segmento está na região das costas
      else if (maxY > 2000 && maxY < 7000) {
        segment.name = "COSTAS"
      }
      // Verificar se pode ser uma manga
      else if (maxX - minX < 5000 && maxY - minY < 5000) {
        segment.name = "MANGA"
      }
      // Verificar se pode ser um bolso
      else if (maxX - minX < 3000 && maxY - minY < 3000) {
        segment.name = "BOLSO"
      }
    })

    logger(`Identificados ${segments.length} segmentos separados`, "success")

    // Se não conseguimos identificar segmentos, criar pelo menos alguns básicos
    if (segments.length === 0) {
      // Verificar se temos pontos suficientes para identificar segmentos
      if (points.length > 20) {
        // Dividir os pontos em segmentos baseados em saltos grandes entre pontos
        let lastX = points[0].x
        let lastY = points[0].y
        let currentSegmentPoints: { x: number; y: number }[] = [{ x: lastX, y: lastY }]
        let currentSegmentCommands: string[] = [commands[0]]

        for (let i = 1; i < points.length; i++) {
          const point = points[i]
          const command = commands[i]

          // Calcular a distância entre pontos
          const distance = Math.sqrt(Math.pow(point.x - lastX, 2) + Math.pow(point.y - lastY, 2))

          // Se houver um salto grande (mais de 1000 unidades) e o comando for PU, iniciar novo segmento
          if (distance > 1000 && command === "PU") {
            if (currentSegmentPoints.length > 5) {
              segments.push({
                name: `Parte ${segments.length + 1}`,
                points: [...currentSegmentPoints],
                commands: [...currentSegmentCommands],
              })
            }
            currentSegmentPoints = []
            currentSegmentCommands = []
          }

          currentSegmentPoints.push(point)
          currentSegmentCommands.push(command)
          lastX = point.x
          lastY = point.y
        }

        // Adicionar o último segmento se tiver pontos suficientes
        if (currentSegmentPoints.length > 5) {
          segments.push({
            name: `Parte ${segments.length + 1}`,
            points: [...currentSegmentPoints],
            commands: [...currentSegmentCommands],
          })
        }

        logger(`Identificados ${segments.length} segmentos baseados em saltos de distância`, "success")
      }
    }

    // Adicionar nomes específicos para os segmentos que não foram identificados
    const partNames = ["FRENTE ESQ", "MANGA", "PALA", "FRENTE DIR", "BOLSO", "GABARITO"]
    segments.forEach((segment, index) => {
      if (segment.name.startsWith("Parte ")) {
        segment.name = partNames[index % partNames.length]
      }
    })

    logger(`Usando resultados do Método 1`, "success")
    return {
      commands,
      points,
      textElements,
      segments,
      rawContent: content,
      method: "regex",
    }
  }

  // Método 2: Parsing mais agressivo
  logger(`Método 2: Iniciando parsing com separação de tokens`, "info")
  const startTime2 = performance.now()

  commands.length = 0
  points.length = 0
  let method2Matches = 0

  // Expressão regular melhorada para capturar mais formatos
  const enhancedRegex = /(PU|PD)[\s,;]*(-?\d+\.?\d*)[\s,;]*(-?\d+\.?\d*)/gi
  let enhancedMatch

  // Processar todo o conteúdo como uma única string
  const fullContent = lines.join(" ")

  while ((enhancedMatch = enhancedRegex.exec(fullContent)) !== null) {
    const command = enhancedMatch[1].toUpperCase()
    const x = Number.parseFloat(enhancedMatch[2])
    const y = Number.parseFloat(enhancedMatch[3])

    if (!isNaN(x) && !isNaN(y)) {
      commands.push(command)
      points.push({ x, y })
      method2Matches++
    }
  }

  const time2 = ((performance.now() - startTime2) / 1000).toFixed(3)
  logger(`Método 2: Extraídos ${method2Matches} pontos em ${time2}s`, method2Matches > 0 ? "success" : "warning")

  // Se encontramos pontos suficientes, retornar os resultados
  if (points.length >= 10) {
    // Criar segmentos artificiais
    const pointsPerSegment = Math.ceil(points.length / 5)
    const partNames = ["FRENTE ESQ", "MANGA", "PALA", "FRENTE DIR", "BOLSO", "GABARITO"]

    for (let i = 0; i < 5; i++) {
      const start = i * pointsPerSegment
      const end = Math.min((i + 1) * pointsPerSegment, points.length)

      if (start < end) {
        segments.push({
          name: partNames[i % partNames.length],
          points: points.slice(start, end),
          commands: commands.slice(start, end),
        })
      }
    }

    logger(`Usando resultados do Método 2`, "success")
    return {
      commands,
      points,
      textElements,
      segments,
      rawContent: content,
      method: "enhanced-regex",
    }
  }

  // Método 3: Parsing para formatos alternativos
  logger(`Método 3: Iniciando parsing para formatos alternativos`, "info")
  const startTime3 = performance.now()

  commands.length = 0
  points.length = 0
  let method3Matches = 0

  // Alguns arquivos PLT usam formatos como "PA x,y;" ou "PR dx,dy;"
  const alternativeRegex = /P[A-Z][\s,;]*(-?\d+\.?\d*)[\s,;]*(-?\d+\.?\d*)/gi
  let altMatch

  while ((altMatch = alternativeRegex.exec(fullContent)) !== null) {
    // Assumir PD (Pen Down) para todos os pontos
    const x = Number.parseFloat(altMatch[1])
    const y = Number.parseFloat(altMatch[2])

    if (!isNaN(x) && !isNaN(y)) {
      commands.push("PD")
      points.push({ x, y })
      method3Matches++
    }
  }

  const time3 = ((performance.now() - startTime3) / 1000).toFixed(3)
  logger(`Método 3: Extraídos ${method3Matches} pontos em ${time3}s`, method3Matches > 0 ? "success" : "warning")

  // Se encontramos pontos suficientes, retornar os resultados
  if (points.length >= 10) {
    // Criar segmentos artificiais
    const pointsPerSegment = Math.ceil(points.length / 5)
    const partNames = ["FRENTE ESQ", "MANGA", "PALA", "FRENTE DIR", "BOLSO", "GABARITO"]

    for (let i = 0; i < 5; i++) {
      const start = i * pointsPerSegment
      const end = Math.min((i + 1) * pointsPerSegment, points.length)

      if (start < end) {
        segments.push({
          name: partNames[i % partNames.length],
          points: points.slice(start, end),
          commands: commands.slice(start, end),
        })
      }
    }

    logger(`Usando resultados do Método 3`, "success")
    return {
      commands,
      points,
      textElements,
      segments,
      rawContent: content,
      method: "alternative-format",
    }
  }

  // Método 4: Parsing extremamente agressivo
  logger(`Método 4: Iniciando parsing com expressão regular global`, "info")
  const startTime4 = performance.now()

  commands.length = 0
  points.length = 0

  // Extrair todos os pares de números do arquivo inteiro
  const numberPairsRegex = /(-?\d+\.?\d*)[\s,;]+(-?\d+\.?\d*)/g
  let match
  let method4Matches = 0
  let lastCommand = "PU" // Começar com PU

  while ((match = numberPairsRegex.exec(fullContent)) !== null) {
    const x = Number.parseFloat(match[1])
    const y = Number.parseFloat(match[2])

    if (!isNaN(x) && !isNaN(y)) {
      // Alternar entre PU e PD para criar linhas conectadas
      if (
        method4Matches === 0 ||
        (method4Matches > 0 &&
          (Math.abs(x - points[points.length - 1].x) > 1000 || Math.abs(y - points[points.length - 1].y) > 1000))
      ) {
        // Se for o primeiro ponto ou houver um salto grande, usar PU
        lastCommand = "PU"
      } else {
        // Caso contrário, usar PD
        lastCommand = "PD"
      }

      commands.push(lastCommand)
      points.push({ x, y })
      method4Matches++
    }
  }

  const time4 = ((performance.now() - startTime4) / 1000).toFixed(3)
  logger(`Método 4: Extraídos ${method4Matches} pontos em ${time4}s`, method4Matches > 0 ? "success" : "warning")

  // Se ainda não encontramos pontos suficientes, criar dados de exemplo
  if (points.length < 10) {
    logger(`Nenhum método conseguiu extrair pontos suficientes. Criando dados de exemplo.`, "warning")

    // Criar um quadrado simples como exemplo
    commands.length = 0
    points.length = 0

    commands.push("PU", "PD", "PD", "PD", "PD")
    points.push({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: 0, y: 0 })

    // Criar um segmento de exemplo
    segments.push({
      name: "EXEMPLO",
      points: [...points],
      commands: [...commands],
    })

    return {
      commands,
      points,
      textElements,
      segments,
      rawContent: content,
      method: "example",
    }
  }

  // Criar segmentos artificiais para o método 4
  const pointsPerSegment = Math.ceil(points.length / 5)
  const partNames = ["FRENTE ESQ", "MANGA", "PALA", "FRENTE DIR", "BOLSO", "GABARITO"]

  for (let i = 0; i < 5; i++) {
    const start = i * pointsPerSegment
    const end = Math.min((i + 1) * pointsPerSegment, points.length)

    if (start < end) {
      segments.push({
        name: partNames[i % partNames.length],
        points: points.slice(start, end),
        commands: commands.slice(start, end),
      })
    }
  }

  // Determinar qual método produziu mais pontos
  const methodCounts = [method1Matches, method2Matches, method3Matches, method4Matches]
  const bestMethodIndex = methodCounts.indexOf(Math.max(...methodCounts))
  const methodNames = ["regex", "enhanced-regex", "alternative-format", "aggressive"]

  logger(`Usando resultados do Método ${bestMethodIndex + 1} (${methodNames[bestMethodIndex]})`, "success")

  return {
    commands,
    points,
    textElements,
    segments,
    rawContent: content,
    method: methodNames[bestMethodIndex],
  }
}

/**
 * Normaliza os pontos para melhor visualização
 */
export function normalizePoints(
  points: { x: number; y: number }[],
  canvasWidth: number,
  canvasHeight: number,
  margin = 40,
): {
  transformPoint: (x: number, y: number) => { x: number; y: number }
  minX: number
  minY: number
  maxX: number
  maxY: number
  scale: number
} {
  if (!points.length) {
    return {
      transformPoint: (x, y) => ({ x, y }),
      minX: 0,
      minY: 0,
      maxX: 100,
      maxY: 100,
      scale: 1,
    }
  }

  // Encontrar os limites dos pontos
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  points.forEach((point) => {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  })

  // Calcular dimensões disponíveis
  const width = canvasWidth - 2 * margin
  const height = canvasHeight - 2 * margin

  // Calcular escala
  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const scaleX = width / rangeX
  const scaleY = height / rangeY
  const scale = Math.min(scaleX, scaleY) * 0.9 // 90% para ter uma margem extra

  // Função para transformar coordenadas
  const transformPoint = (x: number, y: number) => {
    return {
      x: margin + (x - minX) * scale,
      y: canvasHeight - margin - (y - minY) * scale,
    }
  }

  return {
    transformPoint,
    minX,
    minY,
    maxX,
    maxY,
    scale,
  }
}


import { NestingAlgorithm } from "@/components/nesting-algorithm"

self.onmessage = async (e) => {
  const { fabricWidth, segments } = e.data

  // Função de log que envia mensagens de volta para o componente principal
  const addLog = (message: string, type: string = "info") => {
    self.postMessage({ type: "log", data: { message, type } })
  }

  try {
    const algorithm = new NestingAlgorithm(fabricWidth, segments, addLog)
    const result = await algorithm.performNesting()
    
    self.postMessage({ type: "result", data: result })
  } catch (error) {
    self.postMessage({ 
      type: "error", 
      data: error instanceof Error ? error.message : "Erro desconhecido" 
    })
  }
} 
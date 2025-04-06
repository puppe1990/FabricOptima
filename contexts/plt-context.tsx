"use client"

import { createContext, useContext, useState, ReactNode } from "react"
import { parsePltFile } from "@/components/plt-parser"

interface PltContextType {
  pltData: any
  setPltData: (data: any) => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  loadPltFile: (file: File) => Promise<void>
  addLog: (message: string, type?: "info" | "warning" | "error" | "success") => void
  logs: { time: string; message: string; type: "info" | "warning" | "error" | "success" }[]
}

const PltContext = createContext<PltContextType | undefined>(undefined)

export function PltProvider({ children }: { children: ReactNode }) {
  const [pltData, setPltData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [logs, setLogs] = useState<{
    time: string
    message: string
    type: "info" | "warning" | "error" | "success"
  }[]>([])

  const addLog = (message: string, type: "info" | "warning" | "error" | "success" = "info") => {
    const now = new Date()
    const time = now.toLocaleTimeString()
    console.log(`Adding log: ${time} - ${message}`) // Debug
    setLogs(prev => [...prev, { time, message, type }])
  }

  const loadPltFile = async (file: File) => {
    setIsLoading(true)
    setLogs([])
    addLog(`Iniciando carregamento do arquivo ${file.name}`, "info")

    try {
      const reader = new FileReader()
      
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string
          addLog(`Arquivo carregado, iniciando processamento`, "info")
          
          const parsedData = await parsePltFile(content, addLog)
          setPltData(parsedData)
          
          addLog(`Arquivo processado com sucesso`, "success")
        } catch (err) {
          addLog(`Erro ao processar arquivo: ${err}`, "error")
          setPltData(null)
        }
        setIsLoading(false)
      }

      reader.onerror = (err) => {
        addLog(`Erro ao ler arquivo: ${err}`, "error")
        setPltData(null)
        setIsLoading(false)
      }

      reader.readAsText(file)
    } catch (err) {
      addLog(`Erro inesperado: ${err}`, "error")
      setPltData(null)
      setIsLoading(false)
    }
  }

  return (
    <PltContext.Provider value={{ 
      pltData, 
      setPltData, 
      isLoading, 
      setIsLoading,
      loadPltFile,
      addLog,
      logs
    }}>
      {children}
    </PltContext.Provider>
  )
}

export function usePlt() {
  const context = useContext(PltContext)
  if (context === undefined) {
    throw new Error('usePlt must be used within a PltProvider')
  }
  return context
} 
"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, FileUp, AlertCircle, CheckCircle2, Terminal, Copy, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import PltRenderer from "./plt-renderer"
import { parsePltFile } from "./plt-parser"
import { usePlt } from "@/contexts/plt-context"

export default function PltViewer() {
  const { pltData, addLog } = usePlt()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<{ time: string; message: string; type: "info" | "warning" | "error" | "success" }[]>(
    [],
  )
  const [showLogs, setShowLogs] = useState(false)

  // Função para adicionar logs
  const addLogContext = (message: string, type: "info" | "warning" | "error" | "success" = "info") => {
    const now = new Date()
    const timeString = now.toLocaleTimeString("pt-BR", { hour12: false })
    setLogs((prev) => [...prev, { time: timeString, message, type }])

    // Também enviar para o console
    switch (type) {
      case "warning":
        console.warn(`[${timeString}] ${message}`)
        break
      case "error":
        console.error(`[${timeString}] ${message}`)
        break
      case "success":
        console.log(`%c[${timeString}] ${message}`, "color: green")
        break
      default:
        console.log(`[${timeString}] ${message}`)
    }
  }

  // Função para copiar logs para a área de transferência
  const copyLogs = () => {
    const logText = logs.map((log) => `[${log.time}] ${log.message}`).join("\n")
    navigator.clipboard
      .writeText(logText)
      .then(() => {
        addLogContext("Logs copiados para a área de transferência", "success")
      })
      .catch((err) => {
        addLogContext(`Erro ao copiar logs: ${err}`, "error")
      })
  }

  // Limpar logs
  const clearLogs = () => {
    setLogs([])
    addLogContext("Logs limpos", "info")
  }

  // Modifique a função onDrop para garantir que o arquivo seja processado corretamente
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0]
      setFile(selectedFile)
      setError(null)
      setLogs([])
      addLogContext(`Arquivo selecionado: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(2)} KB)`, "info")

      // Forçar um pequeno atraso para garantir que a UI seja atualizada
      setTimeout(() => {
        loadPltFile(selectedFile)
      }, 50)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/plt": [".plt"],
      "application/octet-stream": [".plt"],
      "text/plain": [".plt", ".txt"],
    },
    maxFiles: 1,
  })

  const loadPltFile = async (file: File) => {
    setLoading(true)
    setProgress(0)
    setPltData(null)
    setShowLogs(true)

    try {
      addLogContext(`Iniciando carregamento do arquivo ${file.name}`, "info")

      // Simular o progresso de carregamento
      const simulateProgress = () => {
        let currentProgress = 0
        const interval = setInterval(() => {
          currentProgress += Math.random() * 10
          if (currentProgress > 95) {
            clearInterval(interval)
            currentProgress = 95
          }
          setProgress(Math.min(currentProgress, 95))
        }, 200)
        return interval
      }

      const progressInterval = simulateProgress()

      // Ler o arquivo
      const reader = new FileReader()
      const startTime = performance.now()

      reader.onload = async (e) => {
        const loadTime = ((performance.now() - startTime) / 1000).toFixed(2)
        clearInterval(progressInterval)
        setProgress(100)
        addLogContext(`Arquivo carregado em ${loadTime}s`, "success")

        try {
          // Processar o conteúdo do arquivo PLT
          const content = e.target?.result as string
          addLogContext(`Tamanho do conteúdo: ${content.length} caracteres`, "info")

          // Analisar o conteúdo
          const lines = content.split(/[\r\n]+/)
          addLogContext(`Número de linhas: ${lines.length}`, "info")

          // Mostrar amostra do conteúdo
          const sampleLines = lines.slice(0, Math.min(5, lines.length))
          addLogContext(`Amostra do conteúdo:`, "info")
          sampleLines.forEach((line, i) => {
            addLogContext(`  Linha ${i + 1}: ${line.length > 100 ? line.substring(0, 100) + "..." : line}`, "info")
          })

          // Processar o arquivo
          const parseStartTime = performance.now()
          addLogContext(`Iniciando processamento do arquivo PLT...`, "info")
          const parsedData = await parsePltFile(content, addLogContext)
          const parseTime = ((performance.now() - parseStartTime) / 1000).toFixed(2)

          if (parsedData.points.length === 0) {
            addLogContext(`Não foi possível extrair pontos do arquivo após ${parseTime}s de processamento`, "error")
            setError("Não foi possível extrair pontos do arquivo. Verifique se é um arquivo PLT válido.")
            setLoading(false)
            return
          }

          // Estatísticas dos dados extraídos
          const puCount = parsedData.commands.filter((cmd) => cmd === "PU").length
          const pdCount = parsedData.commands.filter((cmd) => cmd === "PD").length

          addLogContext(`Processamento concluído em ${parseTime}s`, "success")
          addLogContext(`Total de pontos extraídos: ${parsedData.points.length}`, "success")
          addLogContext(
            `Comandos PU (Pen Up): ${puCount} (${((puCount / parsedData.commands.length) * 100).toFixed(1)}%)`,
            "info",
          )
          addLogContext(
            `Comandos PD (Pen Down): ${pdCount} (${((pdCount / parsedData.commands.length) * 100).toFixed(1)}%)`,
            "info",
          )

          // Informações sobre segmentos, se houver
          if (parsedData.segments && parsedData.segments.length > 0) {
            addLogContext(`Segmentos identificados: ${parsedData.segments.length}`, "success")
            parsedData.segments.forEach((segment, i) => {
              // Calcular os limites do segmento para melhor identificação
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

              const width = maxX - minX
              const height = maxY - minY

              addLogContext(
                `  Segmento ${i + 1}: "${segment.name}" com ${segment.points.length} pontos (${width.toFixed(0)}x${height.toFixed(0)})`,
                "info",
              )
            })
          } else {
            addLogContext("Nenhum segmento identificado no arquivo", "warning")
          }

          // Analisar os limites dos pontos
          let minX = Number.POSITIVE_INFINITY,
            minY = Number.POSITIVE_INFINITY,
            maxX = Number.NEGATIVE_INFINITY,
            maxY = Number.NEGATIVE_INFINITY
          parsedData.points.forEach((point) => {
            minX = Math.min(minX, point.x)
            minY = Math.min(minY, point.y)
            maxX = Math.max(maxX, point.x)
            maxY = Math.max(maxY, point.y)
          })

          addLogContext(`Limites dos pontos: X(${minX} a ${maxX}), Y(${minY} a ${maxY})`, "info")
          addLogContext(`Dimensões: ${maxX - minX} x ${maxY - minY}`, "info")

          setPltData(parsedData)
          setLoading(false)
          addLogContext(`Pronto para renderizar`, "success")
        } catch (err) {
          console.error("Erro ao processar arquivo PLT:", err)
          addLogContext(`Erro ao processar o arquivo: ${err}`, "error")
          setError("Erro ao processar o arquivo PLT. Verifique se o formato é válido.")
          setLoading(false)
        }
      }

      reader.onerror = (err) => {
        console.error("Erro ao ler arquivo:", err)
        clearInterval(progressInterval)
        addLogContext(`Erro ao ler o arquivo: ${err}`, "error")
        setError("Erro ao ler o arquivo. Tente novamente.")
        setLoading(false)
      }

      reader.readAsText(file)
    } catch (err) {
      console.error("Erro inesperado:", err)
      addLogContext(`Erro inesperado: ${err}`, "error")
      setError("Ocorreu um erro inesperado. Tente novamente.")
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
              isDragActive ? "border-primary bg-primary/10" : "border-gray-300 hover:border-primary"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-gray-500" />
            <p className="text-lg mb-2">
              {isDragActive
                ? "Solte o arquivo aqui..."
                : "Arraste e solte um arquivo PLT aqui, ou clique para selecionar"}
            </p>
            <p className="text-sm text-muted-foreground">Suporta arquivos PLT e TXT com formato PLT</p>

            <Button variant="outline" className="mt-4">
              <FileUp className="mr-2 h-4 w-4" />
              Selecionar Arquivo
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-medium mb-4">Carregando arquivo...</h3>
            <Progress value={progress} className="h-2 mb-2" />
            <p className="text-sm text-muted-foreground">{progress.toFixed(0)}% concluído</p>

            <div className="mt-4 space-y-2">
              <div className="flex items-center">
                <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
                <span>Lendo arquivo</span>
              </div>

              {progress > 30 && (
                <div className="flex items-center">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
                  <span>Analisando estrutura</span>
                </div>
              )}

              {progress > 60 && (
                <div className="flex items-center">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
                  <span>Processando comandos</span>
                </div>
              )}

              {progress > 90 && (
                <div className="flex items-center">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
                  <span>Preparando visualização</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Console de logs */}
      {logs.length > 0 && (
        <Collapsible open={showLogs} onOpenChange={setShowLogs}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <Terminal className="h-5 w-5 mr-2" />
                  <h3 className="text-lg font-medium">Log de Processamento</h3>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={copyLogs}>
                    <Copy className="h-4 w-4 mr-1" />
                    Copiar
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearLogs}>
                    Limpar
                  </Button>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      {showLogs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </div>

              <CollapsibleContent>
                <div className="bg-gray-900 text-gray-100 rounded-md p-3 font-mono text-sm max-h-[300px] overflow-y-auto">
                  {logs.map((log, i) => (
                    <div
                      key={i}
                      className={`py-0.5 ${
                        log.type === "error"
                          ? "text-red-400"
                          : log.type === "warning"
                            ? "text-yellow-400"
                            : log.type === "success"
                              ? "text-green-400"
                              : "text-gray-300"
                      }`}
                    >
                      <span className="text-gray-500">[{log.time}]</span> {log.message}
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </CardContent>
          </Card>
        </Collapsible>
      )}

      {pltData && !loading && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-medium mb-4">Visualização do Arquivo PLT</h3>
            <PltRenderer data={pltData} onLog={addLogContext} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}


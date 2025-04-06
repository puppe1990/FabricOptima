"use client"

import { useEffect, useRef } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"

interface NestingProcessModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  currentStep: number
  logs: { time: string; message: string; type: "info" | "warning" | "error" | "success" }[]
  canvas: HTMLCanvasElement | null
}

export default function NestingProcessModal({
  isOpen,
  onOpenChange,
  currentStep,
  logs,
  canvas
}: NestingProcessModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Atualizar o canvas quando houver mudanças
  useEffect(() => {
    if (canvasRef.current && canvas) {
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
        ctx.drawImage(canvas, 0, 0)
      }
    }
  }, [canvas])

  // Rolar para o último log automaticamente
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [logs])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <div className="flex-1 flex flex-col md:flex-row gap-4">
          {/* Área de visualização */}
          <div className="flex-1">
            <h3 className="font-medium mb-2">Visualização do Encaixe</h3>
            <div className="border rounded-lg p-2 bg-white">
              <canvas
                ref={canvasRef}
                width={1000}
                height={800}
                className="w-full h-auto"
              />
            </div>
          </div>

          {/* Área de logs */}
          <div className="w-full md:w-96">
            <h3 className="font-medium mb-2">Log do Processo</h3>
            <ScrollArea className="h-[calc(80vh-200px)] border rounded-lg p-2">
              {logs.map((log, i) => (
                <div
                  key={i}
                  className={`py-1 text-sm ${
                    log.type === "error"
                      ? "text-red-600"
                      : log.type === "warning"
                        ? "text-yellow-600"
                        : log.type === "success"
                          ? "text-green-600"
                          : "text-gray-600"
                  }`}
                >
                  <span className="text-gray-400 mr-2">[{log.time}]</span>
                  {log.message}
                </div>
              ))}
              <div ref={logsEndRef} />
            </ScrollArea>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-2">
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
      </DialogContent>
    </Dialog>
  )
} 
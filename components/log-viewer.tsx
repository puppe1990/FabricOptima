"use client"

import { usePlt } from "@/contexts/plt-context"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Terminal, ChevronUp, ChevronDown } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function LogViewer() {
  const { logs } = usePlt()
  const [isExpanded, setIsExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Garantir que o componente só renderize no cliente
  useEffect(() => {
    setMounted(true)
  }, [])

  // Adicionar log para debug
  useEffect(() => {
    console.log("Logs atualizados:", logs)
  }, [logs])

  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [logs, isExpanded])

  if (!mounted) {
    return null
  }

  return (
    <Card className="fixed bottom-4 right-4 w-96 shadow-lg">
      <CardContent className="p-0">
        <div 
          className="p-3 bg-slate-50 border-b flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center">
            <Terminal className="h-4 w-4 mr-2" />
            <span className="font-medium">Log de Processamento</span>
            {logs.length > 0 && (
              <span className="ml-2 text-xs bg-slate-200 px-2 py-0.5 rounded-full">
                {logs.length}
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
        </div>

        {isExpanded && (
          <ScrollArea className="h-[300px] p-3">
            <div className="space-y-1">
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
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
} 
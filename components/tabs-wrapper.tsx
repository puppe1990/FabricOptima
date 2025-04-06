"use client"

import { useState, useEffect } from "react"
import { usePlt } from "@/contexts/plt-context"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileSearch, Layers } from "lucide-react"
import PltViewer from "@/components/plt-viewer"
import AutoNesting from "@/components/auto-nesting"

export default function TabsWrapper() {
  const [activeTab, setActiveTab] = useState("viewer")
  const { pltData } = usePlt()

  // Mudar para a aba de visualização quando o arquivo for carregado
  useEffect(() => {
    if (pltData) {
      setActiveTab("viewer")
    }
  }, [pltData])

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 gap-4 p-1 bg-slate-100 rounded-lg">
          <TabsTrigger 
            value="viewer" 
            className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md rounded-md transition-all"
          >
            <FileSearch className="h-5 w-5 mr-2" />
            Visualização do Arquivo PLT
          </TabsTrigger>
          <TabsTrigger 
            value="nesting"
            className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md rounded-md transition-all"
          >
            <Layers className="h-5 w-5 mr-2" />
            Encaixe Automático
          </TabsTrigger>
        </TabsList>

        <TabsContent value="viewer" className="mt-6">
          <div className="bg-slate-50 rounded-lg p-6">
            <PltViewer />
          </div>
        </TabsContent>

        <TabsContent value="nesting" className="mt-6">
          <div className="bg-slate-50 rounded-lg p-6">
            <AutoNesting />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
} 
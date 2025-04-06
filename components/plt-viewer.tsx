"use client"

import { Card, CardContent } from "@/components/ui/card"
import PltRenderer from "./plt-renderer"
import { usePlt } from "@/contexts/plt-context"

export default function PltViewer() {
  const { pltData } = usePlt()

  if (!pltData) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        Carregue um arquivo PLT para visualizar
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-medium mb-4">Visualização do Arquivo PLT</h3>
          <PltRenderer data={pltData} />
        </CardContent>
      </Card>
    </div>
  )
}


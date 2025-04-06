"use client"

import { useDropzone } from "react-dropzone"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileUp, Upload } from "lucide-react"
import { usePlt } from "@/contexts/plt-context"

export default function PltUpload() {
  const { loadPltFile, isLoading, addLog } = usePlt()

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        addLog("Arquivo selecionado para upload", "info")
        await loadPltFile(acceptedFiles[0])
      }
    },
    accept: {
      "application/plt": [".plt"],
      "application/octet-stream": [".plt"],
      "text/plain": [".plt", ".txt"],
    },
    maxFiles: 1,
    disabled: isLoading
  })

  return (
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

          <Button variant="outline" className="mt-4" disabled={isLoading}>
            <FileUp className="mr-2 h-4 w-4" />
            {isLoading ? "Carregando..." : "Selecionar Arquivo"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
} 
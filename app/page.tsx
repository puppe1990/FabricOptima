import TabsWrapper from "@/components/tabs-wrapper"
import PltUpload from "@/components/plt-upload"
import LogViewer from "@/components/log-viewer"
import { Layers } from "lucide-react"
import { PltProvider } from "@/contexts/plt-context"

export default function Home() {
  return (
    <PltProvider>
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
        <div className="container mx-auto py-10 px-4">
          {/* Header com logo e título */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center p-2 mb-4">
              <Layers className="h-10 w-10 text-indigo-600" />
            </div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">
              Fabric<span className="text-indigo-600">Optima</span>
            </h1>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Sistema inteligente de otimização e encaixe de modelagens para a indústria têxtil
            </p>
          </div>

          {/* Upload do arquivo PLT */}
          <div className="mb-6">
            <PltUpload />
          </div>
          
          <TabsWrapper />

          {/* Footer */}
          <footer className="text-center mt-10 text-slate-600 text-sm">
            <p>FabricOptima © 2024 - Otimização inteligente para a indústria têxtil</p>
          </footer>
        </div>

        {/* Log Viewer flutuante */}
        <LogViewer />
      </main>
    </PltProvider>
  )
}


import PltViewer from "@/components/plt-viewer"
import AutoNesting from "@/components/auto-nesting"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileSearch, Layers } from "lucide-react"

export default function Home() {
  return (
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
        
        <div className="bg-white rounded-xl shadow-lg p-6">
          <Tabs defaultValue="viewer" className="space-y-6">
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

        {/* Footer */}
        <footer className="text-center mt-10 text-slate-600 text-sm">
          <p>FabricOptima © 2024 - Otimização inteligente para a indústria têxtil</p>
        </footer>
      </div>
    </main>
  )
}


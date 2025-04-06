import PltViewer from "@/components/plt-viewer"
import AutoNesting from "@/components/auto-nesting"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileSearch, Layers } from "lucide-react"

export default function Home() {
  return (
    <main className="container mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Sistema de Modelagem</h1>
      
      <Tabs defaultValue="viewer" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="viewer" className="text-lg">
            <FileSearch className="h-5 w-5 mr-2" />
            Visualização do Arquivo PLT
          </TabsTrigger>
          <TabsTrigger value="nesting" className="text-lg">
            <Layers className="h-5 w-5 mr-2" />
            Encaixe Automático
          </TabsTrigger>
        </TabsList>

        <TabsContent value="viewer" className="mt-6">
          <PltViewer />
        </TabsContent>

        <TabsContent value="nesting" className="mt-6">
          <AutoNesting />
        </TabsContent>
      </Tabs>
    </main>
  )
}


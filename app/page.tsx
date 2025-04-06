import PltViewer from "@/components/plt-viewer"

export default function Home() {
  return (
    <main className="container mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Visualizador de Arquivos PLT</h1>
      <PltViewer />
    </main>
  )
}


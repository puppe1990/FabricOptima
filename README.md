# FabricOptime

A modern web application for viewing and interacting with PLT (plotter) files, built with Next.js and TypeScript.
<img width="1688" alt="Screenshot 2025-04-06 at 20 00 37" src="https://github.com/user-attachments/assets/d31ff655-b773-419f-8fb7-bdceb3a29cc5" />

## Features

- 📁 Drag-and-drop PLT file upload
- 🔍 Interactive zoom and pan controls
- 🎨 Canvas-based rendering
- ⚡ Real-time parsing and visualization
- 🌓 Dark/light theme support
- 📱 Responsive design
- 🎯 Interactive grid overlay
- ▶️ Animation support for drawing visualization
- 📊 Segment selection and management
- 📝 Detailed logging system

## Tech Stack

- [Next.js](https://nextjs.org/) - React framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Radix UI](https://www.radix-ui.com/) - UI primitives
- [shadcn/ui](https://ui.shadcn.com/) - Component library
- [React Dropzone](https://react-dropzone.js.org/) - File upload handling

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/plt-viewer.git
cd plt-viewer
```

2. Install dependencies:

```bash
npm install
```

3. Run the development server:

```bash
npm run dev
```


plt-viewer/
├── components/
│ ├── plt-viewer.tsx # Main viewer component
│ ├── plt-renderer.tsx # Canvas rendering logic
│ └── plt-parser.ts # PLT file parsing utility
├── styles/ # Tailwind and custom CSS
├── public/ # Static assets
└── pages/ # Next.js pages

```

## Key Components

### PltViewer
- Main component handling file uploads
- Manages viewing experience and state
- Implements logging system
- Error handling and validation

### PltRenderer
- Canvas-based rendering engine
- Zoom and pan functionality
- Grid overlay system
- Animation support
- Segment selection tools

### PltParser
- PLT file content parsing
- Command and coordinate extraction
- Text element handling
- Multiple parsing method support

## UI Components

The application utilizes a comprehensive set of UI components built with Radix UI and styled using Tailwind CSS:
- Buttons and tooltips
- Context menus
- Sliding panels (sheets)
- Input controls
- Progress indicators
- Alert systems

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[Add your license here]

## Acknowledgments

- [Next.js](https://nextjs.org/)
- [Radix UI](https://www.radix-ui.com/)
- [shadcn/ui](https://ui.shadcn.com/)

import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import SavedScrapesList from "./components/SavedScrapeList";

function App() {
  return (
    <BrowserRouter>
<div className="flex h-screen bg-slate-50 text-slate-900">
  {/* Sidebar */}
  <nav className="w-44 border-r border-slate-200 bg-white p-3 flex flex-col overflow-hidden">
    <div className="mb-4">
      <h2 className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
        微博抓取
      </h2>
    </div>
    <Link 
      to="/" 
      className="flex items-center justify-center py-1.5 px-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg shadow-lg hover:-translate-y-0.5 transition-all text-xs"
    >
      + New
    </Link>
    <div className="mt-4 flex-1 min-h-0 overflow-hidden">
      <SavedScrapesList />
    </div>
  </nav>

  {/* Main Content */}
  <main className="flex-1 overflow-y-auto p-8">
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/dashboard/:postId" element={<Dashboard />} />
    </Routes>
  </main>
</div>
</BrowserRouter>
  );
}

export default App;

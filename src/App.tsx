import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { Sidebar } from "./components/Sidebar";
import { CatalogPage } from "./pages/CatalogPage";
import { PresetsPage } from "./pages/PresetsPage";
import { PresetEditorPage } from "./pages/PresetEditorPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { BenchmarksPage } from "./pages/BenchmarksPage";
import { LocalAiPage } from "./pages/LocalAiPage";
import { PacksPage } from "./pages/PacksPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<CatalogPage />} />
            <Route path="/presets" element={<PresetsPage />} />
            <Route path="/presets/:id" element={<PresetEditorPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/benchmarks" element={<BenchmarksPage />} />
            <Route path="/ai" element={<LocalAiPage />} />
            <Route path="/packs" element={<PacksPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
      <Toaster theme="dark" position="bottom-right" />
    </BrowserRouter>
  );
}

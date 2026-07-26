import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { Toaster } from "sonner";
import { ThemeProvider } from "./components/ThemeProvider";
import { Sidebar } from "./components/Sidebar";
import { CatalogPage } from "./pages/CatalogPage";
import { PresetsPage } from "./pages/PresetsPage";
import { PresetEditorPage } from "./pages/PresetEditorPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { BenchmarksPage } from "./pages/BenchmarksPage";
import { LocalAiPage } from "./pages/LocalAiPage";
import { PacksPage } from "./pages/PacksPage";
import { SettingsPage } from "./pages/SettingsPage";

function LegacyPresetRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/library/${id}` : "/library"} replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-auto min-h-0">
            <Routes>
              <Route path="/" element={<CatalogPage />} />
              <Route path="/library" element={<PresetsPage />} />
              <Route path="/library/:id" element={<PresetEditorPage />} />
              <Route path="/presets" element={<Navigate to="/library" replace />} />
              <Route path="/presets/:id" element={<LegacyPresetRedirect />} />
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
    </ThemeProvider>
  );
}

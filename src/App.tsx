import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import Visitor from './pages/Visitor'
import Operator from './pages/Operator'
import Display from './pages/Display'
import Dashboard from './pages/Dashboard'
import Auth from './pages/Auth'

export default function App() {
  // HashRouter — GitHub Pages-də server tərəfli rewrite olmadan işləyir
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/q/:slug" element={<Visitor />} />
        <Route path="/panel" element={<Operator />} />
        <Route path="/panel/:slug" element={<Operator />} />
        <Route path="/display/:slug" element={<Display />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/dashboard/*" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

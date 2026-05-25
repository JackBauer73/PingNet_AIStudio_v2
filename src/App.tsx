import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Dashboard from './pages/organizer/Dashboard';
import Players from './pages/organizer/Players';
import Pools from './pages/organizer/Pools';
import Tables from './pages/organizer/Tables';
import Bracket from './pages/organizer/Bracket';
import Scores from './pages/organizer/Scores';
import Archives from './pages/organizer/Archives';
import PrintQR from './pages/organizer/PrintQR';
import TableView from './pages/player/TableView';
import Landing from './pages/player/Landing';
import OrganizerLayout from './components/layout/OrganizerLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Temporary placeholders
import Settings from './pages/organizer/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        {/* Public Player Route */}
        <Route path="/table/:tableNumber" element={<TableView />} />
        
        {/* Auth Route */}
        <Route path="/login" element={<Login />} />

        {/* Print Route (standalone) */}
        <Route 
          path="/organizer/print" 
          element={
            <ProtectedRoute>
              <PrintQR />
            </ProtectedRoute>
          } 
        />
        
        {/* Organizer Routes Protected */}
        <Route 
          path="/organizer" 
          element={
            <ProtectedRoute>
              <OrganizerLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="players" element={<Players />} />
          <Route path="checkin" element={<Players />} />
          <Route path="checkin/:tournamentId" element={<Players />} />
          <Route path="pools" element={<Pools />} />
          <Route path="tables" element={<Tables />} />
          <Route path="bracket" element={<Bracket />} />
          <Route path="scores" element={<Scores />} />
          <Route path="archives" element={<Archives />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        
        {/* Public Landing & Register Route */}
        <Route path="/" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  );
}

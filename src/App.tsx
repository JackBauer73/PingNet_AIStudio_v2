import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Dashboard from './pages/organizer/Dashboard';
import Operations from './pages/organizer/Operations';
import Tables from './pages/organizer/Tables';
import Scores from './pages/organizer/Scores';
import Archives from './pages/organizer/Archives';
import PrintQR from './pages/organizer/PrintQR';
import CheckInScan from './pages/organizer/CheckInScan';
import Feedback from './pages/organizer/Feedback';
import TableView from './pages/player/TableView';
import Accueil from './pages/player/Accueil';
import Tournois from './pages/player/Tournois';
import Tutoriel from './pages/player/Tutoriel';
import LiveScores from './pages/player/LiveScores';
import Board from './pages/board/Board';
import PlayerSpace from './pages/player/PlayerSpace';
import PlayerValidation from './pages/player/PlayerValidation';
import PoolStandingsPage from './pages/player/PoolStandingsPage';
import OrganizerLayout from './components/layout/OrganizerLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import FeedbackWidget from './components/feedback/FeedbackWidget';
import SuperadminDashboard from './pages/superadmin/SuperadminDashboard';

// Temporary placeholders
import Settings from './pages/organizer/Settings';
import Splash from '../Splash';

export default function App() {
  return (
    <>
      <Splash />
      <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        {/* Public Player Route */}
        <Route path="/table/:tableNumber" element={<TableView />} />
        <Route path="/board" element={<Board />} />
        
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

        {/* Superadmin Route (standalone) */}
        <Route 
          path="/superadmin" 
          element={
            <ProtectedRoute adminOnly>
              <SuperadminDashboard />
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
          <Route path="players" element={<Operations />} />
          <Route path="checkin" element={<Operations />} />
          <Route path="checkin/:tournamentId" element={<Operations />} />
          <Route path="pools" element={<Operations />} />
          <Route path="tables" element={<Tables />} />
          <Route path="bracket" element={<Operations />} />
          <Route path="scores" element={<Scores />} />
          <Route path="archives" element={<Archives />} />
          <Route path="feedback" element={<Feedback />} />
          <Route path="settings" element={<Settings />} />
          <Route path="checkin-scan/:dayNumber" element={<CheckInScan />} />
        </Route>
        
        {/* Public Player Space */}
        <Route path="/player/:token" element={<PlayerSpace />} />
        <Route path="/player/:token/validate/:matchId" element={<PlayerValidation />} />
        <Route path="/player/:token/pool/:poolId" element={<PoolStandingsPage />} />
        
        {/* Public Landing & Register Route */}
        <Route path="/" element={<Accueil />} />
        <Route path="/tournois" element={<Tournois />} />
        <Route path="/tutoriel" element={<Tutoriel />} />
        <Route path="/live-scores" element={<LiveScores />} />
      </Routes>
      <FeedbackWidget />
    </BrowserRouter>
    </>
  );
}

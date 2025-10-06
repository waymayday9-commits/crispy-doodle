import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ConfirmationProvider } from './context/ConfirmationContext';
import { Sidebar } from './components/Layout/Sidebar';
import { Dashboard } from './components/Views/Dashboard';
import { Tournaments } from './components/Views/Tournaments';
import { Analytics } from './components/Views/Analytics';
import { TournamentManager } from './components/Views/TournamentManager';
import { UserManagement } from './components/Views/UserManagement';
import { DatabaseView } from './components/Views/Database';
import { Inventory } from './components/Views/Inventory';
import { Settings } from './components/Views/Settings';
import { PersonalStats } from './components/Views/PersonalStats';
import { PartsDatabase } from './components/Views/PartsDatabase';
import { TeamManager } from './components/Views/TeamManager';
import { CommunityManager } from './components/Views/CommunityManager';
import { ClaimRequests } from './components/Views/ClaimRequests';
import { TournamentDetails } from './components/Views/TournamentDetails';
import { TeamDetails } from './components/Views/TeamDetails';
import { BBXDatabaseUpdate } from './components/Views/BBXDatabaseUpdate';
import { Navigation } from './components/Layout/Navigation';
import { TournamentLogs } from './components/Views/TournamentLogs';

function AppContent() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [selectedLogsId, setSelectedLogsId] = useState<string | null>(null);

   // 🧭 Listen for navigation to personal stats
    React.useEffect(() => {
      const handleNavigate = () => {
        setCurrentView('personal-stats');
      };
      window.addEventListener('navigateToPersonalStats', handleNavigate);
      return () => window.removeEventListener('navigateToPersonalStats', handleNavigate);
    }, []);

  const renderCurrentView = () => {
    if (currentView === 'tournament-logs' && selectedLogsId) {
      return (
        <TournamentLogs 
          tournamentId={selectedLogsId} 
          onBack={() => {
            setCurrentView('tournaments');
            setSelectedLogsId(null);
          }} 
        />
      );
    }

    if (currentView === 'tournament-dashboard' && selectedTournamentId) {
      return (
        <TournamentDashboard 
          tournamentId={selectedTournamentId} 
          onBack={() => {
            setCurrentView('tournament-manager');
            setSelectedTournamentId(null);
          }} 
        />
      );
    }

    switch (currentView) {
      case 'dashboard': return <Dashboard onViewChange={setCurrentView} />;
      case 'tournaments': return <Tournaments onOpenLogs={(tournamentId: string) => {
        setSelectedLogsId(tournamentId);
        setCurrentView('tournament-logs');
      }} />;
      case 'inventory': return <Inventory />;
      case 'analytics': return <Analytics />;
      case 'parts-database': return <PartsDatabase />;
      case 'team-manager': return <TeamManager />;
      case 'community-manager': return <CommunityManager />;
      case 'claim-requests': return <ClaimRequests />;
      case 'personal-stats':
        const storedPlayer = localStorage.getItem('targetPlayer');
        return <PersonalStats targetPlayer={storedPlayer || ''} />;
      case 'tournament-manager': return <TournamentManager onOpenDashboard={(tournamentId: string) => {
        setSelectedTournamentId(tournamentId);
        setCurrentView('tournament-dashboard');
      }} />;
      case 'user-management': return <UserManagement />;
      case 'database': return <DatabaseView />;
      case 'settings': return <Settings />;
      case 'bbx-database-update': return <BBXDatabaseUpdate />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Component - Show on all pages */}
      <Navigation currentView={currentView} onViewChange={setCurrentView} />
      
      <div className="w-full">
        <main className="flex-1 w-full">
          {renderCurrentView()}
        </main>
      </div>
    </div>
  );
}

function TournamentDetailsRoute() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();

  if (!tournamentId) {
    return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Invalid tournament ID</div>;
  }

  return (
    <TournamentDetails
      tournamentId={tournamentId}
      onBack={() => navigate('/tournaments')}
    />
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ConfirmationProvider>
          <Routes>
            <Route path="/tournament/:tournamentId" element={<TournamentDetailsRoute />} />
            <Route path="/*" element={<AppContent />} />
          </Routes>
        </ConfirmationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
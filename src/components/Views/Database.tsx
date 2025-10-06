import React, { useState, useEffect } from 'react';
import { Database, Users, Trophy, Calendar, BarChart3, Download, RefreshCw, CreditCard as Edit, Trash2, Eye, Search, ChevronRight, ArrowLeft, X, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useConfirmation } from '../../context/ConfirmationContext';

interface TableInfo {
  name: string;
  records: number;
  icon: React.ReactNode;
  description: string;
  color: string;
}

interface RegistrationWithBeyblades {
  registration_id: string;
  tournament_id: string;
  tournament_name?: string;
  player_name: string;
  team?: string;
  team_with_player?: string;
  payment_mode: string;
  registered_at: string;
  status: string;
  beyblades: Array<{
    beyblade_id: string;
    beyblade_name: string;
    blade_line: string;
    parts: any[];
  }>;
}

export function DatabaseView() {
  const { user } = useAuth();
  const { confirm, alert } = useConfirmation();
  const [selectedTable, setSelectedTable] = useState<string>('tournaments');
  const [selectedTournament, setSelectedTournament] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tableData, setTableData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [viewingRegistration, setViewingRegistration] = useState<RegistrationWithBeyblades | null>(null);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Reset state when switching tables
  React.useEffect(() => {
    setSelectedTournament(null);
    setViewingRegistration(null);
    setEditingRow(null);
    setEditData({});
    setSearchTerm('');
    setCurrentPage(1);
  }, [selectedTable]);

  const isAdmin = user?.role === 'admin' || user?.role === 'developer';

  const fetchTableCounts = async () => {
    try {
      const [profilesRes, tournamentsRes, matchResultsRes, registrationsRes] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('tournaments').select('*', { count: 'exact', head: true }),
        supabase.from('match_results').select('*', { count: 'exact', head: true }),
        supabase.from('tournament_registrations').select('*', { count: 'exact', head: true })
      ]);

      setTables([
        { 
          name: 'users', 
          records: profilesRes.count || 0, 
          icon: <Users size={20} />, 
          description: 'User accounts and profiles',
          color: 'from-blue-500 to-blue-600'
        },
        { 
          name: 'tournaments', 
          records: tournamentsRes.count || 0, 
          icon: <Trophy size={20} />, 
          description: 'Tournament information',
          color: 'from-yellow-500 to-orange-500'
        },
        { 
          name: 'matches', 
          records: matchResultsRes.count || 0, 
          icon: <Calendar size={20} />, 
          description: 'Match results and schedules',
          color: 'from-green-500 to-emerald-500'
        },
        { 
          name: 'registrations', 
          records: registrationsRes.count || 0, 
          icon: <Table size={20} />, 
          description: 'Tournament registrations with Beyblades',
          color: 'from-purple-500 to-violet-500'
        }
      ]);

      // Also fetch tournaments for the registration view
      const { data: tournamentData } = await supabase
        .from('tournaments')
        .select('id, name')
        .order('name');
      
      setTournaments(tournamentData || []);
    } catch (error) {
      console.error('Error fetching table counts:', error);
    }
  };

  const fetchTableData = async (tableName: string, tournamentId?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      let data: any[] = [];
      
      if (tableName === 'registrations' && tournamentId) {
        const { data: registrationData, error } = await supabase
          .from('tournament_registration_details')
          .select('*')
          .eq('tournament_id', tournamentId)
          .order('registered_at', { ascending: false });

        if (error) throw error;

        const groupedData: { [key: string]: RegistrationWithBeyblades } = {};
        
        registrationData?.forEach((row: any) => {
          if (!groupedData[row.registration_id]) {
            groupedData[row.registration_id] = {
              registration_id: row.registration_id,
              tournament_id: row.tournament_id,
              tournament_name: tournaments.find(t => t.id === row.tournament_id)?.name || 'Unknown Tournament',
              player_name: row.player_name,
              team: row.team,
              team_with_player: row.team_with_player,
              payment_mode: row.payment_mode,
              registered_at: row.registered_at,
              status: row.status,
              beyblades: []
            };
          }

          if (row.beyblade_id) {
            const existingBeyblade = groupedData[row.registration_id].beyblades
              .find(b => b.beyblade_id === row.beyblade_id);
            
            if (!existingBeyblade) {
              groupedData[row.registration_id].beyblades.push({
                beyblade_id: row.beyblade_id,
                beyblade_name: row.beyblade_name,
                blade_line: row.blade_line,
                parts: row.beyblade_parts || []
              });
            }
          }
        });

        data = Object.values(groupedData);
      } else if (tableName === 'registrations' && !tournamentId) {
        data = tournaments;
      } else {
        let supabaseTableName = tableName;
        if (tableName === 'registrations') {
          supabaseTableName = 'tournament_registrations';
        } else if (tableName === 'users') {
          supabaseTableName = 'profiles';
        } else if (tableName === 'matches') {
          supabaseTableName = 'match_results';
        }
        
        const { data: fetchedData, error } = await supabase
          .from(supabaseTableName)
          .select('*')
          .order(
            tableName === 'tournaments' ? 'tournament_date' : 
            tableName === 'matches' ? 'submitted_at' : 
            'created_at', 
            { ascending: false }
          );

        if (error) {
          console.error(`❌ DATABASE: Error fetching ${tableName}:`, error);
          throw error;
        }
        
        data = fetchedData || [];
      }

      if (tableName !== 'registrations' || tournamentId) {
        data.sort((a, b) => {
          const aValue = Object.values(a).find(val => typeof val === 'string') as string || '';
          const bValue = Object.values(b).find(val => typeof val === 'string') as string || '';
          return aValue.localeCompare(bValue);
        });
      }

      setTableData(data);
    } catch (error) {
      console.error('Error fetching table data:', error);
      setError(`Failed to load ${tableName} data. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchTableCounts(),
      fetchTableData(selectedTable, selectedTournament || undefined)
    ]);
    setIsRefreshing(false);
  };

  const handleExport = (tableName: string) => {
    const dataStr = JSON.stringify(tableData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tableName}_export_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleEdit = (row: any) => {
    setEditingRow(row.id || row.registration_id || row.tournament_id);
    setEditData({ ...row });
  };

  const handleSave = async () => {
    if (!editingRow || !isAdmin) return;

    try {
      let supabaseTableName = selectedTable;
      if (selectedTable === 'registrations') {
        supabaseTableName = 'tournament_registrations';
      } else if (selectedTable === 'users') {
        supabaseTableName = 'profiles';
      } else if (selectedTable === 'matches') {
        supabaseTableName = 'match_results';
      }
      
      const { error } = await supabase
        .from(supabaseTableName)
        .update(editData)
        .eq('id', editingRow);

      if (error) {
        console.error('Update error:', error);
        if (error.code === '42501' || error.message.includes('RLS')) {
          await alert('Permission Denied', 'You need admin or developer role to edit records.');
        } else {
          await alert('Update Failed', `Failed to update record: ${error.message}`);
        }
        return;
      }

      setEditingRow(null);
      setEditData({});
      await fetchTableData(selectedTable);
    } catch (error) {
      console.error('Error updating row:', error);
      await alert('Update Failed', `Failed to update record: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm(
      'Delete Record',
      'Are you sure you want to delete this record? This action cannot be undone.'
    );
    
    if (!confirmed) {
      return;
    }

    try {
      let supabaseTableName = selectedTable;
      if (selectedTable === 'registrations') {
        supabaseTableName = 'tournament_registrations';
      } else if (selectedTable === 'users') {
        supabaseTableName = 'profiles';
      } else if (selectedTable === 'matches') {
        supabaseTableName = 'match_results';
      }
      
      const { error } = await supabase
        .from(supabaseTableName)
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Delete error:', error);
        if (error.code === '42501' || error.message.includes('RLS')) {
          alert('Permission denied. You need admin or developer role to delete records.');
        } else {
          alert(`Failed to delete record: ${error.message}`);
        }
        return;
      }

      await Promise.all([
        fetchTableCounts(),
        fetchTableData(selectedTable, selectedTournament || undefined)
      ]);
    } catch (error) {
      console.error('Error deleting row:', error);
      await alert('Delete Failed', `Failed to delete record: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    }
  };

  const handleTournamentSelect = (tournamentId: string) => {
    setSelectedTournament(tournamentId);
    fetchTableData('registrations', tournamentId);
  };

  const handleBackToTournaments = () => {
    setSelectedTournament(null);
    fetchTableData('registrations');
  };

  const handleViewRegistration = (registration: RegistrationWithBeyblades) => {
    setViewingRegistration(registration);
  };

  useEffect(() => {
    fetchTableCounts();
  }, []);

  useEffect(() => {
    if (selectedTable === 'registrations') {
      setSelectedTournament(null);
      fetchTableData(selectedTable);
    } else {
      fetchTableData(selectedTable);
    }
  }, [selectedTable]);

  // Filter and paginate data
  const filteredData = tableData.filter(item => {
    if (!searchTerm) return true;
    
    const searchableText = Object.values(item)
      .filter(value => typeof value === 'string')
      .join(' ')
      .toLowerCase();
    
    return searchableText.includes(searchTerm.toLowerCase());
  });

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const renderTableContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">
              Loading {selectedTable === 'registrations' && selectedTournament ? 'registration' : selectedTable} data...
            </p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-500 text-2xl">⚠️</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Data</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => fetchTableData(selectedTable, selectedTournament || undefined)}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    if (tableData.length === 0) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Database size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Data Available</h3>
            <p className="text-gray-500">
              No data available for {selectedTable === 'registrations' && selectedTournament ? 'this tournament' : selectedTable}
            </p>
          </div>
        </div>
      );
    }

    if (selectedTable === 'registrations' && !selectedTournament) {
      // Show tournament selection
      return (
        <div className="p-6">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-violet-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy size={32} className="text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Select Tournament</h3>
            <p className="text-gray-600">Choose a tournament to view its registrations and participant details</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tableData.map((tournament) => (
              <button
                key={tournament.id}
                onClick={() => handleTournamentSelect(tournament.id)}
                className="group text-left p-6 bg-white border-2 border-gray-200 rounded-xl hover:border-purple-300 hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900 group-hover:text-purple-700 transition-colors">
                    {tournament.name}
                  </h4>
                  <ChevronRight size={20} className="text-gray-400 group-hover:text-purple-500 transition-colors" />
                </div>
                <p className="text-sm text-gray-600 mb-2">{tournament.location}</p>
                <p className="text-sm text-gray-500">
                  {new Date(tournament.tournament_date).toLocaleDateString()}
                </p>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                    tournament.status === 'upcoming' ? 'bg-blue-100 text-blue-800' :
                    tournament.status === 'active' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {tournament.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (selectedTable === 'registrations' && selectedTournament) {
      // Show registrations for selected tournament
      return (
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={handleBackToTournaments}
              className="flex items-center space-x-2 text-purple-600 hover:text-purple-800 font-medium transition-colors"
            >
              <ArrowLeft size={20} />
              <span>Back to Tournaments</span>
            </button>
            <h3 className="text-xl font-semibold text-gray-900">
              {tournaments.find(t => t.id === selectedTournament)?.name || 'Tournament'} Registrations
            </h3>
          </div>
          
          <div className="space-y-4">
            {(tableData as RegistrationWithBeyblades[]).map((registration) => (
              <div key={registration.registration_id} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all duration-200">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                        {(registration.team_with_player || registration.player_name).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">
                          {registration.team_with_player || registration.player_name}
                        </h3>
                        {registration.team && (
                          <p className="text-sm text-gray-600">Team: {registration.team}</p>
                        )}
                        <p className="text-sm text-gray-600">{registration.tournament_name}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Registered:</span>
                        <p className="font-medium">{new Date(registration.registered_at).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Payment:</span>
                        <p className="font-medium capitalize">{registration.payment_mode?.replace('_', ' ') || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      registration.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                      registration.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {registration.status}
                    </span>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleViewRegistration(registration)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => handleEdit(registration)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(registration.registration_id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Beyblades:</span>
                    <span className="text-sm text-gray-600">
                      {registration.beyblades.length} registered
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {registration.beyblades.length > 0 ? (
                      registration.beyblades.map((beyblade, index) => (
                        <span key={index} className="inline-block bg-white px-3 py-1 rounded-full text-xs font-medium text-gray-700 border">
                          {beyblade.beyblade_name}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-500 italic">No Beyblades registered</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="p-6">
        {/* Search and Pagination Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-4 sm:space-y-0">
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${selectedTable}...`}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
            />
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              Showing {paginatedData.length} of {filteredData.length} records
            </span>
            {totalPages > 1 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {paginatedData.length > 0 && paginatedData[0] && Object.keys(paginatedData[0]).map((key) => (
                    <th key={key} className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      {key.replace(/_/g, ' ')}
                    </th>
                  ))}
                  {isAdmin && (
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {paginatedData.map((row: any, index) => (
                  <tr key={row.id || index} className="hover:bg-gray-50 transition-colors">
                    {Object.entries(row).map(([key, value], cellIndex) => (
                      <td key={cellIndex} className="px-6 py-4 text-sm text-gray-900">
                        {editingRow === (row.id || row.registration_id || row.tournament_id) && isAdmin ? (
                          <input
                            type="text"
                            value={editData[key] || ''}
                            onChange={(e) => setEditData({...editData, [key]: e.target.value})}
                            className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <div className="max-w-xs">
                            {typeof value === 'object' && value !== null 
                              ? (
                                <div className="bg-gray-100 rounded-md px-2 py-1 text-xs font-mono">
                                  {JSON.stringify(value).length > 50 
                                    ? JSON.stringify(value).substring(0, 50) + '...'
                                    : JSON.stringify(value)
                                  }
                                </div>
                              )
                              : value instanceof Date 
                              ? value.toLocaleString()
                              : (
                                <span className={key.includes('email') ? 'font-mono text-blue-600' : ''}>
                                  {String(value || '')}
                                </span>
                              )
                            }
                          </div>
                        )}
                      </td>
                    ))}
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {editingRow === (row.id || row.registration_id || row.tournament_id) ? (
                            <>
                              <button
                                onClick={handleSave}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Save Changes"
                              >
                                <Save size={16} />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingRow(null);
                                  setEditData({});
                                }}
                                className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                                title="Cancel"
                              >
                                <X size={16} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEdit(row)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit Record"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => handleDelete(row.id || row.registration_id || row.tournament_id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Record"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 pt-28 pb-8">
        {/* Header */}
        <div className="page-header">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
            <div>
              <h1 className="page-title flex items-center">
                <Database size={32} className="mr-3 text-blue-600" />
                Database Management
              </h1>
              <p className="page-subtitle">Monitor and manage application data from Supabase</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
              >
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
              <button
                onClick={() => handleExport(selectedTable)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <Download size={16} />
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Tables Sidebar */}
          <div className="xl:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 flex items-center">
                  <Database size={20} className="mr-2 text-gray-700" />
                  Database Tables
                </h2>
              </div>
              
              <div className="p-4 space-y-2">
                {tables.map((table) => (
                  <button
                    key={table.name}
                    onClick={() => setSelectedTable(table.name)}
                    className={`w-full text-left p-4 rounded-xl transition-all duration-200 group ${
                      selectedTable === table.name
                        ? 'bg-gradient-to-r ' + table.color + ' text-white shadow-lg transform scale-105'
                        : 'hover:bg-gray-50 border border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${
                          selectedTable === table.name 
                            ? 'bg-white/20' 
                            : 'bg-gray-100 group-hover:bg-gray-200'
                        } transition-colors`}>
                          {React.cloneElement(table.icon as React.ReactElement, {
                            className: selectedTable === table.name ? 'text-white' : 'text-gray-600'
                          })}
                        </div>
                        <span className={`font-semibold capitalize ${
                          selectedTable === table.name ? 'text-white' : 'text-gray-900'
                        }`}>
                          {table.name}
                        </span>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs font-bold ${
                        selectedTable === table.name 
                          ? 'bg-white/20 text-white' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {table.records}
                      </div>
                    </div>
                    <p className={`text-xs ${
                      selectedTable === table.name ? 'text-white/80' : 'text-gray-600'
                    }`}>
                      {table.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Database Stats */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 mt-6 overflow-hidden">
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 flex items-center">
                  <BarChart3 size={20} className="mr-2 text-gray-700" />
                  Database Stats
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Total Records</span>
                  <span className="text-2xl font-bold text-gray-900">
                    {tables.reduce((sum, table) => sum + table.records, 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Active Tables</span>
                  <span className="text-2xl font-bold text-gray-900">{tables.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Database</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-green-600 font-bold">Supabase</span>
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-100">
                  <div className="text-xs text-gray-500 text-center">
                    Last updated: {new Date().toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="xl:col-span-3">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Table Header */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 capitalize flex items-center">
                      {tables.find(t => t.name === selectedTable)?.icon && 
                        React.cloneElement(tables.find(t => t.name === selectedTable)!.icon as React.ReactElement, {
                          className: 'mr-2 text-gray-700',
                          size: 24
                        })
                      }
                      {selectedTable === 'registrations' && selectedTournament 
                        ? `${tournaments.find(t => t.id === selectedTournament)?.name || 'Tournament'} Registrations`
                        : selectedTable === 'registrations' 
                        ? 'Tournament Selection'
                        : `${selectedTable} Management`
                      }
                    </h2>
                    <p className="text-gray-600 mt-1">
                      {tables.find(t => t.name === selectedTable)?.description}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                      {selectedTable === 'registrations' && !selectedTournament
                        ? `${tournaments.length} tournaments`
                        : `${filteredData.length} records`
                      }
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Table Content */}
              {renderTableContent()}
            </div>
          </div>
        </div>

        {/* Registration Details Modal */}
        {viewingRegistration && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 to-violet-500 px-6 py-4 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold">Registration Details</h2>
                    <p className="text-purple-100">{viewingRegistration.player_name}</p>
                  </div>
                  <button
                    onClick={() => setViewingRegistration(null)}
                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                {/* Player Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Player Name</label>
                      <p className="text-xl font-bold text-gray-900">{viewingRegistration.player_name}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Tournament</label>
                      <p className="text-lg text-gray-900">{viewingRegistration.tournament_name}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Payment Mode</label>
                      <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium capitalize">
                        {viewingRegistration.payment_mode.replace('_', ' ')}
                      </span>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        viewingRegistration.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                        viewingRegistration.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {viewingRegistration.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Registration Date */}
                <div className="bg-gray-50 rounded-xl p-4 mb-8">
                  <div className="flex items-center space-x-2">
                    <Calendar size={16} className="text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">Registered on:</span>
                    <span className="text-sm text-gray-900 font-semibold">
                      {new Date(viewingRegistration.registered_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Beyblades Section */}
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center">
                      <Trophy size={24} className="mr-2 text-yellow-500" />
                      Registered Beyblades
                    </h3>
                    <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
                      {viewingRegistration.beyblades.length} Beyblades
                    </span>
                  </div>
                  
                  {viewingRegistration.beyblades.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-xl">
                      <Trophy size={48} className="mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-500 font-medium">No Beyblades registered</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {viewingRegistration.beyblades
                        .sort((a, b) => (a.beyblade_order || 0) - (b.beyblade_order || 0))
                        .map((beyblade, index) => (
                        <div key={beyblade.beyblade_id} className="border-2 border-gray-200 rounded-xl p-6 hover:border-purple-300 transition-colors">
                          <div className="flex justify-between items-center mb-4">
                            <div>
                              <h4 className="font-bold text-lg text-gray-900">{beyblade.beyblade_name}</h4>
                              <span className="inline-block bg-gradient-to-r from-blue-500 to-purple-500 text-white px-3 py-1 rounded-full text-sm font-medium mt-2">
                                {beyblade.blade_line} Line
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="w-12 h-12 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                {beyblade.beyblade_order || index + 1}
                              </div>
                            </div>
                          </div>
                          
                          {beyblade.parts.length > 0 ? (
                            <div className="space-y-3">
                              <h5 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Parts Configuration</h5>
                              <div className="grid grid-cols-1 gap-2">
                                {beyblade.parts.map((part, partIndex) => (
                                  <div key={partIndex} className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex justify-between items-center">
                                    <div>
                                      <div className="font-semibold text-gray-900 text-sm">{part.part_type}</div>
                                      <div className="text-gray-600 text-xs">{part.part_name}</div>
                                    </div>
                                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                      <span className="text-blue-600 text-xs font-bold">{partIndex + 1}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-4 bg-gray-50 rounded-lg">
                              <p className="text-gray-500 text-sm">No parts configured</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PlusCircle, Users, Clock, LogOut, Edit3, Lock, Power, Trash2 } from 'lucide-react';

export default function AdminDashboard() {
  const [surveys, setSurveys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchSurveys = () => {
    fetch('/api/surveys?include_inactive=true')
      .then(res => res.json())
      .then(data => {
        setSurveys(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch surveys", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchSurveys();
  }, []);

  const handleToggleActive = async (survey: any) => {
    if (!survey.is_active) {
      const confirmed = window.confirm(
        "WARNING: Activating this survey will instantly DEACTIVATE all other currently active surveys, and PERMANENTLY LOCK this survey from future edits. Are you sure you want to proceed?"
      );
      if (!confirmed) return;
    }

    try {
      const res = await fetch(`/api/surveys/${survey.id}/toggle`, {
        method: 'PATCH',
      });
      if (res.ok) {
        fetchSurveys(); // Refresh to get updated statuses for all surveys
      } else {
        alert("Failed to toggle survey status.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while toggling.");
    }
  };

  const handleDelete = async (survey: any) => {
    const confirmMessage = survey.is_active 
      ? `CRITICAL WARNING: "${survey.title}" is currently ACTIVE! Deleting it will instantly remove it from the live site and PERMANENTLY DESTROY all respondent data collected so far. Type "DELETE" to confirm.`
      : `WARNING: Are you sure you want to permanently delete "${survey.title}"? This will also destroy all respondent data collected for this survey. This cannot be undone.`;

    if (survey.is_active) {
      const input = window.prompt(confirmMessage);
      if (input !== "DELETE") {
        alert("Deletion cancelled.");
        return;
      }
    } else {
      const confirmed = window.confirm(confirmMessage);
      if (!confirmed) return;
    }

    try {
      const res = await fetch(`/api/surveys/${survey.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchSurveys();
      } else {
        alert("Failed to delete survey.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while deleting.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('cyc_admin_auth');
    router.push('/admin/login');
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-cyc-primary)]"></div></div>;
  }

  return (
    <div className="max-w-6xl mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-cyc-secondary)]">Dashboard Overview</h1>
          <p className="text-gray-500 mt-1">Manage your surveys and view engagement metrics.</p>
        </div>
        <div className="flex space-x-4">
          <Link href="/admin/create" className="btn-primary flex items-center">
            <PlusCircle className="w-4 h-4 mr-2" />
            New Survey
          </Link>
          <button onClick={handleLogout} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded flex items-center transition-colors">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Survey Title</th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Responses</th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Est. Time</th>
              <th scope="col" className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {surveys.map((survey) => (
              <tr key={survey.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="text-sm font-semibold text-[var(--color-cyc-secondary)]">{survey.title}</div>
                  <div className="text-sm text-gray-500 line-clamp-1">{survey.description}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${survey.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {survey.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-1.5 text-[var(--color-cyc-primary)]" />
                    {survey.response_count || 0}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-1.5" />
                    {survey.estimated_minutes} min
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-3">
                    <button 
                      onClick={() => handleToggleActive(survey)}
                      className={`flex items-center ${survey.is_active ? 'text-orange-500 hover:text-orange-700' : 'text-green-600 hover:text-green-800'}`}
                      title={survey.is_active ? "Deactivate" : "Activate"}
                    >
                      <Power className="w-4 h-4 mr-1" />
                      {survey.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    
                    {!survey.has_been_published ? (
                      <Link href={`/admin/edit/${survey.id}`} className="text-[var(--color-cyc-primary)] hover:text-teal-700 flex items-center">
                        <Edit3 className="w-4 h-4 mr-1" />
                        Edit
                      </Link>
                    ) : (
                      <span className="text-gray-400 flex items-center cursor-not-allowed" title="Published surveys are permanently locked from editing">
                        <Lock className="w-4 h-4 mr-1" />
                        Locked
                      </span>
                    )}

                    <button 
                      onClick={() => handleDelete(survey)}
                      className="text-red-500 hover:text-red-700 ml-2"
                      title="Delete Survey"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {surveys.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No surveys found. Create one to get started!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

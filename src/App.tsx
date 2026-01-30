import React, { useState, Suspense } from 'react';
import { useUserStore } from './stores';
import { Dashboard } from './components/Dashboard/Dashboard';

import { useAuth } from './providers/AuthProvider';
import './App.scss';


const ChecklistEditor = React.lazy(() => import('./components/Editor/ChecklistEditor').then(module => ({ default: module.ChecklistEditor })));

type View = 'dashboard' | 'editor';

const App: React.FC = () => {
    const [currentView, setCurrentView] = useState<View>('dashboard');
    const [activeChecklistId, setActiveChecklistId] = useState<string | null>(null);
    const { isAuthenticated, isLoading, user } = useAuth();
    const setUser = useUserStore(state => state.setUser);

    React.useEffect(() => {
        if (isAuthenticated && user) {
            setUser({
                id: user.localAccountId || user.homeAccountId,
                name: user.name || 'User',
                email: user.username,
                role: 'estimator' // Default role
            });
        }
    }, [isAuthenticated, user, setUser]);

    const handleOpenChecklist = (id: string) => {
        setActiveChecklistId(id);
        setCurrentView('editor');
    };

    const handleBackToDashboard = () => {
        setActiveChecklistId(null);
        setCurrentView('dashboard');
    };

    if (isLoading || !isAuthenticated) {
        return (
            <div className="app-loading">
                <div className="spinner"></div>
                <span>Signing you in...</span>
            </div>
        );
    }

    return (
        <div className="pap-app">
            {currentView === 'dashboard' ? (
                <Dashboard onOpenChecklist={handleOpenChecklist} />
            ) : (
                <Suspense fallback={
                    <div className="app-loading">
                        <div className="spinner"></div>
                        <span>Loading Editor...</span>
                    </div>
                }>
                    <ChecklistEditor
                        checklistId={activeChecklistId!}
                        onBack={handleBackToDashboard}
                    />
                </Suspense>
            )}
        </div>
    );
};

export default App;

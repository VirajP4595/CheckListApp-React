import React, { useState, Suspense, useEffect } from 'react';
import { useUserStore } from './stores';
import { Dashboard } from './components/Dashboard/Dashboard';
// Auth provider removed - SPFx provides context
import './App.scss';

const ChecklistEditor = React.lazy(() => import(
    /* webpackChunkName: 'checklist-editor' */
    './components/Editor/ChecklistEditor'
).then(module => ({ default: module.ChecklistEditor })));

type View = 'dashboard' | 'editor';

interface AppProps {
    userDisplayName: string;
    userEmail: string;
    userId: string; // Azure AD Object ID
    siteUrl: string;
}

const App: React.FC<AppProps> = ({ userDisplayName, userEmail, userId, siteUrl }) => {
    const [currentView, setCurrentView] = useState<View>('dashboard');
    const [activeChecklistId, setActiveChecklistId] = useState<string | null>(null);
    const setUser = useUserStore(state => state.setUser);

    // Initialize state from URL query parameters
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const checklistId = params.get('checklistId');

        if (checklistId) {
            console.log('App: Found deep link checklistId', checklistId);
            setActiveChecklistId(checklistId);
            setCurrentView('editor');
        }
    }, []);

    // Initialize User Store from Props (SPFx Context)
    useEffect(() => {
        setUser({
            id: userId,
            name: userDisplayName,
            email: userEmail,
            role: 'estimator' // Default role
        });
    }, [userId, userDisplayName, userEmail, setUser]);

    const handleOpenChecklist = (id: string) => {
        setActiveChecklistId(id);
        setCurrentView('editor');
    };

    const handleBackToDashboard = () => {
        setActiveChecklistId(null);
        setCurrentView('dashboard');
    };

    return (
        <div className="pap-app">
            {currentView === 'dashboard' ? (
                <Dashboard onOpenChecklist={handleOpenChecklist} siteUrl={siteUrl} />
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

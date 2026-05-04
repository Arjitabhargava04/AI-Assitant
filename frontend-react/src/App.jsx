// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login    from './pages/Login';
import UserChat from './pages/UserChat';
import Admin    from './pages/Admin';

function Router() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="h-full flex items-center justify-center bg-bg">
      <div className="text-center">
        <div className="font-serif text-5xl text-b2 italic mb-4">𝑉</div>
        <div className="text-t3 text-sm">Loading...</div>
      </div>
    </div>
  );

  return (
    <Routes>
      <Route path="/login" element={
        user ? <Navigate to={user.isAdmin ? '/admin' : '/chat'} replace /> : <Login />
      }/>
      <Route path="/chat" element={
        !user ? <Navigate to="/login" replace /> :
        user.isAdmin ? <Navigate to="/admin" replace /> : <UserChat />
      }/>
      <Route path="/admin" element={
        !user ? <Navigate to="/login" replace /> :
        !user.isAdmin ? <Navigate to="/chat" replace /> : <Admin />
      }/>
      <Route path="*" element={<Navigate to="/login" replace />}/>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Router />
      </BrowserRouter>
    </AuthProvider>
  );
}

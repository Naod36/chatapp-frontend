import { useState, useEffect } from "react";
import AuthScreen from "./components/AuthScreen";
import ChatDashboard from "./components/ChatDashboard";
import { authService } from "./services/auth";

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (authService.isAuthenticated()) {
      setUser(authService.getCurrentUser());
    }
  }, []);

  const handleAuthenticated = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
  };

  if (!user) {
    return <AuthScreen onAuthSuccess={handleAuthenticated} />;
  }

  return <ChatDashboard user={user} onLogout={handleLogout} />;
}

export default App;
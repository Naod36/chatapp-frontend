import { useState, useEffect } from "react";
import AuthScreen from "./components/AuthScreen";
import ChatDashboard from "./components/ChatDashboard";
import { authService } from "./services/auth";

function App() {
  const [user, setUser] = useState(null);
  const [resetToken] = useState(() =>
    new URLSearchParams(window.location.search).get("reset_token"),
  );

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
    return (
      <AuthScreen
        onAuthSuccess={handleAuthenticated}
        resetToken={resetToken}
        onResetComplete={() =>
          window.history.replaceState({}, "", window.location.pathname)
        }
      />
    );
  }

  return <ChatDashboard user={user} onLogout={handleLogout} />;
}

export default App;

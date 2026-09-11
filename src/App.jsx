import { useState, useEffect } from "react";
import AuthScreen from "./components/AuthScreen";
import ChatDashboard from "./components/ChatDashboard";
import MobileAppGate from "./components/MobileAppGate";
import { authService } from "./services/auth";
import { isMobileDevice } from "./utils/device";

const MOBILE_CONTINUE_KEY = "flowchat_continue_on_mobile";

function App() {
  const [user, setUser] = useState(null);
  const [resetToken] = useState(() =>
    new URLSearchParams(window.location.search).get("reset_token"),
  );
  const [continueOnMobile, setContinueOnMobile] = useState(
    () => sessionStorage.getItem(MOBILE_CONTINUE_KEY) === "1",
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

  if (isMobileDevice() && !continueOnMobile) {
    return (
      <MobileAppGate
        onContinueAnyway={() => {
          sessionStorage.setItem(MOBILE_CONTINUE_KEY, "1");
          setContinueOnMobile(true);
        }}
      />
    );
  }

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

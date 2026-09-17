import { useState, useEffect } from "react";
import AuthScreen from "./components/AuthScreen";
import ChatDashboard from "./components/ChatDashboard";
import MobileAppGate from "./components/MobileAppGate";
import { authService } from "./services/auth";
import { apiFetch } from "./services/api";
import { SESSION_EXPIRED_EVENT, SESSION_EXPIRED_MESSAGE } from "./services/session.js";
import { isMobileDevice } from "./utils/device";

const MOBILE_CONTINUE_KEY = "flowchat_continue_on_mobile";

function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(authService.isAuthenticated);
  const [sessionMessage, setSessionMessage] = useState(null);
  const [resetToken] = useState(() =>
    new URLSearchParams(window.location.search).get("reset_token"),
  );
  const [continueOnMobile, setContinueOnMobile] = useState(
    () => sessionStorage.getItem(MOBILE_CONTINUE_KEY) === "1",
  );

  useEffect(() => {
    let disposed = false;
    const onSessionExpired = () => {
      setUser(null);
      setCheckingSession(false);
      setSessionMessage(SESSION_EXPIRED_MESSAGE);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    const cachedUser = authService.getCurrentUser();
    if (cachedUser.token) {
      const restoreSession = async () => {
        try {
          await apiFetch("/me", { signal: AbortSignal.timeout(10000) });
        } catch {
          if (!localStorage.getItem("chat_token")) return;
        }
        if (disposed) return;
        if (localStorage.getItem("chat_token") === cachedUser.token) {
          setUser(cachedUser);
        }
        setCheckingSession(false);
      };
      restoreSession();
    } else {
      setCheckingSession(false);
    }
    return () => {
      disposed = true;
      window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    };
  }, []);

  const handleAuthenticated = (userData) => {
    setSessionMessage(null);
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

  if (checkingSession) {
    return <div role="status" style={{ padding: 24 }}>Restoring session...</div>;
  }

  if (!user) {
    return (
      <AuthScreen
        initialError={sessionMessage}
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

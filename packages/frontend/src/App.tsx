import { AuthPage } from "./features/auth/AuthPage";
import { BackendStatus } from "./features/health/BackendStatus";

export default function App() {
  return (
    <>
      <AuthPage />
      <BackendStatus />
    </>
  );
}

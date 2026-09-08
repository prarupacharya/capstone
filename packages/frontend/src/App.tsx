import { HomePage } from "./features/home/HomePage";
import { BackendStatus } from "./features/health/BackendStatus";

export default function App() {
  return (
    <>
      <HomePage />
      <BackendStatus />
    </>
  );
}

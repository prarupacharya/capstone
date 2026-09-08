import { useEffect, useState } from "react";
import { getHealth } from "../../api/health";

type BackendState = "checking" | "connected" | "unavailable";

export function BackendStatus() {
  const [state, setState] = useState<BackendState>("checking");

  useEffect(() => {
    let active = true;

    getHealth()
      .then(() => active && setState("connected"))
      .catch(() => active && setState("unavailable"));

    return () => {
      active = false;
    };
  }, []);

  if (state === "checking") return <p role="status">Checking backend...</p>;
  if (state === "unavailable") return <p role="alert">Backend unavailable.</p>;
  return <p role="status">Backend connected.</p>;
}

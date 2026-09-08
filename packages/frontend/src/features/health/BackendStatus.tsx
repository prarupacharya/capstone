import { useEffect, useState } from "react";
import { getHealth } from "../../api/health";

type BackendState = "checking" | "connected" | "unavailable";

export function BackendStatus() {
  const [state, setState] = useState<BackendState>("checking");

  useEffect(() => {
    let active = true;

    getHealth()
      .then(
        (health) =>
          active &&
          setState(
            health.status === "up" && health.backend === "up" && health.database === "up"
              ? "connected"
              : "unavailable"
          )
      )
      .catch(() => active && setState("unavailable"));

    return () => {
      active = false;
    };
  }, []);

  if (state === "checking") return <p role="status">Checking backend...</p>;
  if (state === "unavailable") return <p role="alert">Backend unavailable.</p>;
  return <p role="status">Backend connected.</p>;
}

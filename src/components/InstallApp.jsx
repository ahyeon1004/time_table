import { useState, useSyncExternalStore } from "react";
import { DownloadSimple } from "@phosphor-icons/react";
import { canInstall, installApp, subscribeInstall } from "../lib/install.js";

export default function InstallApp() {
  const available = useSyncExternalStore(subscribeInstall, canInstall, () => false);
  const [error, setError] = useState("");
  if (!available && !error) return null;
  return (
    <div className="app-install">
      {available && <button className="today-button" onClick={() => {
        setError("");
        void installApp().catch(() => setError("설치 창을 열지 못했어요. 주소창의 설치 아이콘으로 다시 시도해 주세요."));
      }}><DownloadSimple size={17} />시간표 앱 설치</button>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

import { useState, useSyncExternalStore } from "react";
import { DownloadSimple } from "@phosphor-icons/react";
import { canInstall, installApp, needsAppleInstallHelp, subscribeInstall } from "../lib/install.js";

export default function InstallApp() {
  const available = useSyncExternalStore(subscribeInstall, canInstall, () => false);
  const appleHelp = useSyncExternalStore(subscribeInstall, needsAppleInstallHelp, () => false);
  const [error, setError] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  if (!available && !appleHelp && !error) return null;
  return (
    <div className="app-install">
      {available && <button className="today-button" onClick={() => {
        setError("");
        void installApp().catch(() => setError("설치 창을 열지 못했어요. 주소창의 설치 아이콘으로 다시 시도해 주세요."));
      }}><DownloadSimple size={17} />시간표 앱 설치</button>}
      {appleHelp && (
        <button className="today-button" aria-expanded={showInstructions} onClick={() => setShowInstructions(!showInstructions)}>
          <DownloadSimple size={17} />홈 화면에 추가
        </button>
      )}
      {appleHelp && showInstructions && (
        <p className="install-instructions">Safari에서 공유 → 홈 화면에 추가를 누르세요. ‘웹 앱으로 열기’가 보이면 켠 뒤 추가하세요.</p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

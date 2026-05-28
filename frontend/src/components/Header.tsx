import { useState } from "react";
import { useParty } from "../party/NeroPartyContext";

const NeroLogo = () => (
  <div className="flex items-center gap-2">
    <svg width="32" height="32" viewBox="0 0 120 150" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21.7036 41.3086C25.2768 31.3858 25.6261 19.7041 24.3513 8.98464C24.0326 6.28383 24.6047 4.10193 26.0674 2.43895C28.09 0.140606 31.3506 -0.631636 34.2434 0.545117C36.0024 1.25607 37.363 2.86798 38.9627 4.19182C40.9566 5.84663 44.0395 8.80077 48.2112 13.0542C69.0128 34.2787 85.7876 65.0336 71.9485 94.8508C68.0505 103.241 61.9768 112.373 58.2014 119.048C54.5976 125.428 51.8947 132.072 51.8518 139.463C51.8477 139.751 51.7981 140.037 51.7047 140.309C50.2746 144.53 47.4145 146.328 43.1242 145.702C42.8108 145.658 42.502 145.573 42.2049 145.451C19.8772 136.209 -0.440157 122.823 0.00725378 95.3902C0.19725 83.3775 4.08912 72.5844 10.4571 62.4104C14.8821 55.3315 19.0069 48.792 21.7036 41.3086ZM39.2936 25.2018C38.9382 33.9457 37.126 42.2422 33.8573 50.0913C30.9461 57.066 26.6436 63.8446 22.6414 70.2984C17.8363 78.0453 14.7963 85.9884 14.496 95.2369C13.9505 111.895 24.5168 120.739 38.3682 127.775C38.4125 127.798 38.461 127.811 38.5106 127.813C38.5602 127.816 38.6098 127.809 38.6564 127.792C38.703 127.774 38.7455 127.748 38.7813 127.713C38.8172 127.679 38.8455 127.637 38.8646 127.591C38.9096 127.477 39.2221 126.511 39.8023 124.693C43.7187 112.404 53.145 101.262 59.1207 88.0293C69.4296 65.1746 54.8243 41.5476 39.6614 25.0669C39.6325 25.0372 39.5956 25.0166 39.5552 25.0074C39.5149 24.9982 39.4727 25.0009 39.4338 25.0151C39.3949 25.0294 39.361 25.0546 39.3361 25.0877C39.3112 25.1208 39.2965 25.1604 39.2936 25.2018Z" fill="white"></path>
      <path d="M72.5518 16.767C75.3834 16.626 77.4304 18.1276 79.2507 20.5608C96.7917 43.9242 104.71 72.6443 93.6414 100.047C90.8875 106.874 87.6228 113.071 83.8474 118.636C79.502 125.04 69.4015 121.173 70.756 113.206C70.8949 112.376 71.563 111.03 72.7602 109.167C76.8992 102.707 80.0291 95.9526 82.1497 88.9044C87.9476 69.6412 81.3345 48.5883 70.1186 32.6838C68.7028 30.6735 66.1838 27.9523 65.6568 25.4026C64.7374 20.9285 68.0532 16.9815 72.5518 16.767Z" fill="white"></path>
      <path d="M101.027 129.284C96.663 135.18 91.5208 140.33 85.6003 144.735C79.1526 149.534 71.185 142.522 74.8808 135.37C75.2444 134.667 76.2618 133.664 77.933 132.361C82.3499 128.916 86.1641 125.02 89.3757 120.673C92.5913 116.325 95.1982 111.534 97.1962 106.3C97.9521 104.323 98.6119 103.056 99.1758 102.5C104.931 96.8741 113.971 102.433 111.274 110.008C108.802 116.959 105.386 123.384 101.027 129.284Z" fill="white"></path>
    </svg>
    <span className="text-3xl font-medium text-white">nero party</span>
  </div>
);

export function Header() {
  const { state, me, isHost, leaveParty, terminateRoom } = useParty();
  const [confirming, setConfirming] = useState(false);
  const code = state.party?.code ?? "—";
  const name = me?.name ?? "—";

  const copyCode = () => {
    if (state.party?.code) {
      navigator.clipboard.writeText(state.party.code).catch(() => {});
    }
  };

  const hostLabel = "Close Room";

  function handleHostAction() {
    setConfirming(true);
  }

  function handleConfirm() {
    setConfirming(false);
    if (isHost) {
      terminateRoom();
    } else {
      leaveParty();
    }
  }

  function handleCancel() {
    setConfirming(false);
  }

  return (
    <div className="px-6 pt-6 relative z-[101]">
      <header className="mx-auto w-[80%] flex items-center justify-between rounded-full border border-border bg-header px-6 py-3 relative">
        <NeroLogo />

        <div className="absolute left-1/2 -translate-x-1/2 text-sm">
          <button
            type="button"
            onClick={copyCode}
            aria-label={`Copy room code ${code}`}
            className="text-foreground hover:opacity-70 transition-opacity duration-300"
          >
            Room {code}
          </button>
          <span className="mx-2 text-muted-foreground">·</span>
          <span className="text-foreground">{name}</span>
        </div>

        <div className="absolute left-[58%] bottom-0 h-10 overflow-hidden">
          <img src="/dancing.gif" alt="" className="h-16 -mt-[8px]" />
        </div>

        <div className="flex items-center gap-4">
          {confirming ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Sure?</span>
              <button
                type="button"
                onClick={handleConfirm}
                className="font-medium text-muted-foreground transition-all duration-300 hover:scale-110 hover:text-foreground"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="text-muted-foreground transition-all duration-300 hover:scale-110 hover:text-foreground"
              >
                No
              </button>
            </div>
          ) : isHost ? (
            <button
              type="button"
              onClick={handleHostAction}
              className="text-sm text-muted-foreground hover:text-destructive transition-colors duration-300"
            >
              {hostLabel}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-sm text-muted-foreground hover:text-destructive transition-colors duration-300"
            >
              Leave Room
            </button>
          )}
        </div>
      </header>
    </div>
  );
}

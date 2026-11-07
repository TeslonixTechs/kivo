import { useEffect, useState } from "react";

export default function SplashScreen({ onComplete }) {
  const [phase, setPhase] = useState("motion");
  useEffect(() => {
    const burst = setTimeout(() => setPhase("burst"), 1500);
    const reveal = setTimeout(() => setPhase("reveal"), 2200);
    const finish = setTimeout(onComplete, 3900);
    return () => [burst, reveal, finish].forEach(clearTimeout);
  }, [onComplete]);
  return (
    <div className={`splash splash-${phase}`}>
      <div className="shape shape-one" /><div className="shape shape-two" /><div className="shape shape-three" /><div className="shape shape-four" />
      <div className="burst-ring" />
      <div className="splash-brand">
        <img src="/kivo-logo.png" alt="Kivo" />
        <h1>Kivo</h1>
        <p>Learn deeply. Remember longer.</p>
      </div>
    </div>
  );
}

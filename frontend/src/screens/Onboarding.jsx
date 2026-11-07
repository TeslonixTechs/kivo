import { useState } from "react";
import { ArrowRight, GraduationCap, Sparkles } from "lucide-react";
import Logo from "../components/Logo";

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState({ name: "", goal: "", level: "Intermediate" });
  const next = () => step === 0 && profile.name.trim() ? setStep(1) : step === 1 && profile.goal.trim() ? setStep(2) : null;
  const finish = () => onComplete(profile);
  return (
    <div className="onboarding">
      <div className="onboarding-brand"><Logo /></div>
      <div className="onboarding-panel">
        <div className="onboarding-progress">{[0, 1, 2].map((item) => <span key={item} className={item <= step ? "active" : ""} />)}</div>
        {step === 0 && <><div className="onboarding-icon"><Sparkles /></div><p className="eyebrow">WELCOME TO KIVO</p><h1>What should we call you?</h1><p>Make your learning space feel like yours.</p><input autoFocus value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} placeholder="Your name" /><button className="primary-button wide" disabled={!profile.name.trim()} onClick={next}>Continue <ArrowRight size={18} /></button></>}
        {step === 1 && <><div className="onboarding-icon"><GraduationCap /></div><p className="eyebrow">LEARNING GOAL</p><h1>What are you studying?</h1><p>Tell Kivo your main goal so your kits stay focused.</p><input autoFocus value={profile.goal} onChange={(event) => setProfile({ ...profile, goal: event.target.value })} placeholder="e.g. Medical school entrance exam" /><button className="primary-button wide" disabled={!profile.goal.trim()} onClick={next}>Continue <ArrowRight size={18} /></button></>}
        {step === 2 && <><div className="onboarding-icon"><GraduationCap /></div><p className="eyebrow">YOUR LEVEL</p><h1>Choose your challenge</h1><p>We’ll adapt explanations and questions to this level.</p><div className="level-options">{["Beginner", "Intermediate", "Advanced", "Expert"].map((level) => <button key={level} className={profile.level === level ? "selected" : ""} onClick={() => setProfile({ ...profile, level })}>{level}</button>)}</div><button className="primary-button wide" onClick={finish}>Enter Kivo <ArrowRight size={18} /></button></>}
      </div>
    </div>
  );
}
